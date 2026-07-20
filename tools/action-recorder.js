// ad-auto action-recorder — records your MANUAL play and emits a DRAFT Automator script.
//
// Wraps the exact Antimatter Dimensions methods that manual clicks funnel through, and
// records each action ONLY when it actually succeeded / changed state (return value,
// or a before/after guard). It then assembles those events, in the order they happened,
// into a first-draft in-game Automator (DSL) script you can paste and refine.
//
// This is a LITERAL TRANSCRIPT, not a smart loop-detector: actions come out in call
// order. Consecutive single time-study buys coalesce into one `studies purchase 11,21,..`
// line; a run of identical prestiges collapses to one line + a `# xN` comment.
//
// USAGE (paste this whole file into the AD DevTools console, AFTER mounting the panel):
//   1. Run it. It prints a confirmation and starts recording silently.
//   2. Do your actions by hand (crunch, eternate, buy studies, toggle black hole, ...).
//   3. __actRec.script()  -> returns the assembled Automator DSL text (string).
//      __actRec.copy()    -> copies that script to the clipboard (fallback: console.log).
//      __actRec.lines     -> the raw recorded-event array (for debugging).
//      __actRec.stop()    -> un-patches the game methods (script/copy still work after).
//      __actRec.reset()   -> clears the recorded lines.
//
// KEY CAVEAT — the Automator is DECLARATIVE; this is only a first-draft transcript:
//   * There is NO wait/until/if structure here. The recorder cannot know your intent —
//     you must add `wait <cmp>`, `until <cmp> { }`, `while`, `pause`, etc. BY HAND.
//   * Granular dimension buying and "max all" are NOT recordable and NOT part of the DSL —
//     the autobuyers handle those in a real script. Only the prestige/study/celestial/
//     autobuyer actions listed below are transcribed.
//   * Hooks catch autobuyer/automator-driven actions too, not just your clicks, so record
//     with autobuyers off (or expect their firings to appear inline).
//
// Not part of the built bookmarklet, not inlined — a manual authoring aid only.

(() => {
  const W = window;
  if (W.__actRec) W.__actRec.stop(); // re-running restarts cleanly

  const s = (v) => {                  // stringify value / Decimal safely
    if (v == null) return null;
    try { return typeof v === 'object' ? v.toString() : v; } catch { return null; }
  };
  const g = (f) => { try { return f(); } catch { return null; } };
  // Normalize a Decimal/number for the DSL: strip the `e+` that Decimal.toString() emits
  // (1e+100) down to the sign-less `1e100` form the hand-written scripts use. Both parse.
  const num = (v) => { const t = s(v); return t == null ? t : String(t).replace('e+', 'e'); };

  // ---- recorded-event buffer -------------------------------------------------
  // Each entry: { kind: 'study'|'line', id?, text? }. Studies are kept as their own
  // kind so consecutive ones can be coalesced at emit time; everything else is a line.
  const lines = [], MAX = 4000;
  let seq = 0;
  const pushLine = (text) => { if (lines.length < MAX) lines.push({ seq: seq++, kind: 'line', text }); };
  const pushStudy = (id) => { if (lines.length < MAX) lines.push({ seq: seq++, kind: 'study', id }); };
  // Autobuyer settings emit one line per intermediate value during a slider drag. Coalesce
  // AT RECORD TIME: if the previous buffered entry is an `auto <same-prestige> ...` line,
  // overwrite it rather than appending — so a drag leaves just its final value and can't
  // flood the buffer past MAX and drop later real actions.
  const pushAuto = (text) => {
    const m = /^auto (infinity|eternity|reality) /.exec(text);
    const last = lines[lines.length - 1];
    if (m && last && last.kind === 'line' && typeof last.text === 'string' && last.text.startsWith('auto ' + m[1] + ' ')) {
      last.text = text;
      return;
    }
    pushLine(text);
  };

  const restores = [];
  // Wrap obj[method]; call rec(result, args, this) AFTER the original runs so it can
  // inspect return value / post-call state and decide what (if anything) to record.
  const wrap = (obj, method, label, rec) => {
    if (obj == null || typeof obj[method] !== 'function') { console.warn('[actRec] missing:', label); return; }
    const orig = obj[method];
    const hadOwn = Object.prototype.hasOwnProperty.call(obj, method);
    obj[method] = function (...args) {
      let result, threw = null;
      try { result = orig.apply(this, args); } catch (e) { threw = String((e && e.message) || e); }
      if (!threw) { try { rec(result, args, this); } catch (e) { console.warn('[actRec] rec failed:', label, e); } }
      if (threw) throw new Error(threw); // preserve original throw semantics
      return result;
    };
    restores.push(() => { if (hadOwn) obj[method] = orig; else delete obj[method]; });
  };

  // Prestige funnels re-enter each other: a reality resets the eternity+infinity layers,
  // an eternity resets infinity, and entering dilation / an EC triggers an internal
  // eternity. Wrapping them naively would emit phantom nested lines (one manual Reality ->
  // `reality` plus stray `eternity`/`infinity`). wrapPrestige records only the OUTERMOST
  // call via a shared depth counter. `decide.pre(args, this)` (optional) snapshots BEFORE
  // the original runs; `decide.rec(result, args, this, before)` decides what to record.
  let prestigeDepth = 0;
  const wrapPrestige = (obj, method, label, decide) => {
    if (obj == null || typeof obj[method] !== 'function') { console.warn('[actRec] missing:', label); return; }
    const orig = obj[method];
    const hadOwn = Object.prototype.hasOwnProperty.call(obj, method);
    obj[method] = function (...args) {
      const outer = prestigeDepth === 0;
      const before = outer && decide.pre ? g(() => decide.pre(args, this)) : null;
      prestigeDepth++;
      let result, threw = null;
      try { result = orig.apply(this, args); }
      catch (e) { threw = String((e && e.message) || e); }
      finally { prestigeDepth--; }
      if (!threw && outer) { try { decide.rec(result, args, this, before); } catch (e) { console.warn('[actRec] rec failed:', label, e); } }
      if (threw) throw new Error(threw); // preserve original throw semantics
      return result;
    };
    restores.push(() => { if (hadOwn) obj[method] = orig; else delete obj[method]; });
  };

  // ---- prestige funnels ------------------------------------------------------
  // eternity() returns a boolean (true = completed). Dilation/EC entry route through here
  // too, but with switchingDilation/enteringEC set (recorded by their own hooks), so skip
  // when a special condition is present. The depth guard also suppresses these nested calls.
  wrapPrestige(W, 'eternity', 'eternity', {
    rec: (result, args) => {
      const special = args[2] || {};
      if (result === true && !special.switchingDilation && !special.enteringEC) pushLine('eternity');
    },
  });

  // Big Crunch: bigCrunchReset returns undefined and clears IP before we could inspect it,
  // so snapshot Player.canCrunch BEFORE the call. A forced call, or one where a crunch was
  // actually pending, is real; a forced=false autobuyer tick while !canCrunch is a no-op
  // and must not emit a phantom `infinity`.
  wrapPrestige(W, 'bigCrunchReset', 'infinity', {
    pre: () => ({ canCrunch: g(() => W.Player && W.Player.canCrunch) }),
    rec: (result, args, self, before) => {
      if (args[0] === true || (before && before.canCrunch)) pushLine('infinity');
    },
  });

  // Reality: beginProcessReality is the funnel both paths reach AFTER the availability
  // guard (isRealityAvailable / !GlyphSelection.active), so reaching it implies a real
  // reality is proceeding.
  wrapPrestige(W, 'beginProcessReality', 'reality', { rec: () => pushLine('reality') });

  // ---- time studies ----------------------------------------------------------
  // Single-study buy. Wrap the shared prototype so every NormalTimeStudyState instance is
  // covered; read the id from `this.id`. Record only on a true return (actual purchase).
  const nts = g(() => W.NormalTimeStudyState && W.NormalTimeStudyState.prototype)
           || g(() => W.TimeStudy(11).constructor.prototype); // fallback if class not on window
  wrap(nts, 'purchase', 'studies purchase', function (result) {
    if (result === true) pushStudy(this && this.id);
  });

  // Unlock Dilation — the singleton dilation time study. Its own line, not the id-list.
  wrap(g(() => W.TimeStudy && W.TimeStudy.dilation), 'purchase', 'unlock dilation', (result) => {
    if (result === true) pushLine('unlock dilation');
  });

  // Unlock an Eternity Challenge — purchase its EC time study. MEDIUM confidence: exact
  // class name (ECTimeStudyState) is unverified, so hook via a captured instance's
  // prototype and read n from this.id. Guarded, so a missing accessor is harmless.
  const ects = g(() => W.TimeStudy && W.TimeStudy.eternityChallenge(1).constructor.prototype);
  wrap(ects, 'purchase', 'unlock ec', function (result) {
    if (result === true && this && this.id != null) pushLine('unlock ec' + this.id);
  });

  // ---- dilation / EC entry ---------------------------------------------------
  // Both trigger an internal eternity; wrapPrestige's depth guard suppresses that nested
  // `eternity` so only `start dilation` / `start ecN` is recorded.
  wrapPrestige(W, 'startDilatedEternity', 'start dilation', {
    rec: (result) => { if (result === true) pushLine('start dilation'); },
  });

  // Enter an Eternity Challenge — wrap the shared prototype, read n from this.id.
  const ecs = g(() => W.EternityChallengeState && W.EternityChallengeState.prototype)
           || g(() => W.EternityChallenge(1).constructor.prototype);
  wrapPrestige(ecs, 'start', 'start ec', {
    rec: (result, args, self) => { if (result === true && self && self.id != null) pushLine('start ec' + self.id); },
  });

  // ---- black hole ------------------------------------------------------------
  // DSL polarity is inverted vs the flag: `blackhole on` = UNPAUSED (arePaused false).
  // Read arePaused AFTER the toggle resolves; only emit if the flag actually flipped.
  {
    const BH = g(() => W.BlackHoles);
    let last = g(() => BH && BH.arePaused);
    wrap(BH, 'togglePause', 'blackhole', () => {
      const now = g(() => BH.arePaused);
      if (now !== last) { pushLine('blackhole ' + (now ? 'off' : 'on')); last = now; }
    });
  }

  // ---- Enslaved store game time ----------------------------------------------
  {
    const EN = g(() => W.Enslaved);
    const isStoring = () => g(() => W.player.celestials.enslaved.isStoring);
    let last = isStoring();
    // on/off — toggleStoreBlackHole no-ops when !canModifyGameTimeStorage, so confirm flip.
    wrap(EN, 'toggleStoreBlackHole', 'storegametime on/off', () => {
      const now = isStoring();
      if (now !== last) { pushLine('storegametime ' + (now ? 'on' : 'off')); last = now; }
    });
    // use (release stored time)
    wrap(EN, 'useStoredTime', 'storegametime use', () => { pushLine('storegametime use'); });
  }

  // ---- study respec toggle (LOW confidence) ----------------------------------
  // `player.respec` is a bare boolean field, no method to wrap. Install a setter that
  // records only the OFF->ON transition (the DSL only expresses turning it ON). If the
  // property is non-configurable this quietly fails — harmless.
  g(() => {
    const p = W.player;
    if (!p) { console.warn('[actRec] missing: player (respec)'); return; }
    let val = p.respec;
    const ok = Object.defineProperty(p, 'respec', {
      configurable: true,
      enumerable: true,
      get() { return val; },
      set(v) { if (v && !val) pushLine('studies respec'); val = v; },
    });
    restores.push(() => {
      try { Object.defineProperty(p, 'respec', { configurable: true, enumerable: true, writable: true, value: val }); } catch {}
    });
    return ok;
  });

  // ---- study preset load (MEDIUM confidence) ---------------------------------
  // load()/respecAndLoad() are Vue component instance methods, not globals. Patch the
  // shared methods on the component definition so `this` binds per instance at call time
  // and we can read this.saveslot. If the component isn't reachable we warn and skip.
  {
    const presetName = (slot) => g(() => {
      const n = W.player.timestudy.presets[slot - 1].name;
      return n && String(n).length ? n : null;
    });
    // Try to locate the component definition. AD registers global components; the exact
    // registry is version-dependent, so this is best-effort and guarded.
    const comp = g(() => {
      const app = W.ui && W.ui.view; // not always present
      return null; // no reliable global handle in most builds
    });
    // Preferred: delegated click listener on the save/load buttons, reading the slot from
    // the clicked element's Vue instance. This survives without a component-def handle.
    const onClick = (ev) => {
      const btn = ev.target && ev.target.closest && ev.target.closest('.c-tt-save-load-btn');
      if (!btn) return;
      const vm = btn.__vue__ || (btn.__vueParentComponent && btn.__vueParentComponent.proxy);
      const slot = vm && (vm.saveslot != null ? vm.saveslot : g(() => vm.$props && vm.$props.saveslot));
      if (slot == null) return;
      // We can't tell load vs respecAndLoad from the click target alone; assume plain load.
      // (Respec+Load is a hover menu option; if used, add `studies respec` by hand.)
      const name = presetName(slot);
      pushLine(name ? ('studies load name ' + name) : ('studies load id ' + slot));
    };
    if (W.document && W.document.addEventListener) {
      W.document.addEventListener('click', onClick, true);
      restores.push(() => W.document.removeEventListener('click', onClick, true));
    } else {
      console.warn('[actRec] no document — study preset load not recorded');
    }
  }

  // ---- autobuyer changes (LOW confidence) ------------------------------------
  // The instances are Autobuyer.bigCrunch / .eternity / .reality (NOT 'Autobuyer.infinity').
  // We wrap toggle() for on/off, and (re)define the value/mode setters to re-emit the full
  // `auto <prestige> ...` line after each change. Setters are accessor descriptors on the
  // class prototypes — capture the original set fn and write through. All guarded.
  const AB = g(() => W.Autobuyer);
  const CRUNCH = g(() => W.AUTO_CRUNCH_MODE), ETERN = g(() => W.AUTO_ETERNITY_MODE), REAL = g(() => W.AUTO_REALITY_MODE);

  // `x highest` is a bare DSL keyword (lexer: /x[ \t]+highest/) — no numeric prefix, so we
  // emit it as-is; the multiplier factor isn't expressible in the DSL.
  const emitAuto = (kw, a) => {
    if (!a) return;
    const active = g(() => a.isActive);
    if (kw === 'infinity') {
      const m = g(() => a.mode);
      if (CRUNCH && m === CRUNCH.AMOUNT) pushAuto('auto infinity ' + num(g(() => a.amount)) + ' ip');
      else if (CRUNCH && m === CRUNCH.TIME) pushAuto('auto infinity ' + num(g(() => a.time)) + 's');
      else if (CRUNCH && m === CRUNCH.X_HIGHEST) pushAuto('auto infinity x highest');
      else pushAuto('auto infinity ' + (active ? 'on' : 'off'));
    } else if (kw === 'eternity') {
      const m = g(() => a.mode);
      if (ETERN && m === ETERN.AMOUNT) pushAuto('auto eternity ' + num(g(() => a.amount)) + ' ep');
      else if (ETERN && m === ETERN.TIME) pushAuto('auto eternity ' + num(g(() => a.time)) + 's');
      else if (ETERN && m === ETERN.X_HIGHEST) pushAuto('auto eternity x highest');
      else pushAuto('auto eternity ' + (active ? 'on' : 'off'));
    } else { // reality — DSL only expresses RM mode; any other mode -> on/off only
      const m = g(() => a.mode);
      if (REAL && m === REAL.RM) pushAuto('auto reality ' + num(g(() => a.rm)) + ' rm');
      else pushAuto('auto reality ' + (active ? 'on' : 'off'));
    }
  };

  const wireAutobuyer = (a, kw) => {
    if (!a) { console.warn('[actRec] missing autobuyer:', kw); return; }
    // on/off via toggle()
    wrap(a, 'toggle', 'auto ' + kw + ' toggle', () => pushAuto('auto ' + kw + ' ' + (g(() => a.isActive) ? 'on' : 'off')));
    // value/mode setters — redefine on the OWN instance, delegating to the prototype's
    // original setter so game state still updates, then re-emit the assembled line.
    // Numeric drags fire repeatedly; pushAuto coalesces a same-prestige run to its last value.
    const proto = g(() => Object.getPrototypeOf(a));
    for (const prop of ['mode', 'amount', 'time', 'xHighest', 'rm']) {
      const desc = proto && g(() => Object.getOwnPropertyDescriptor(proto, prop));
      if (!desc || typeof desc.set !== 'function') continue; // property not on this autobuyer type
      const origSet = desc.set, origGet = desc.get;
      const ok = g(() => {
        Object.defineProperty(a, prop, {
          configurable: true,
          enumerable: !!desc.enumerable,
          get() { return origGet ? origGet.call(this) : undefined; },
          set(v) { origSet.call(this, v); emitAuto(kw, a); },
        });
        return true;
      });
      if (ok) restores.push(() => { try { delete a[prop]; } catch {} });
    }
    // toggleMode() (Reality cycles AUTO_REALITY_MODE; others may have it too)
    if (typeof g(() => a.toggleMode) === 'function') wrap(a, 'toggleMode', 'auto ' + kw + ' mode', () => emitAuto(kw, a));
  };
  wireAutobuyer(g(() => AB && AB.bigCrunch), 'infinity');
  wireAutobuyer(g(() => AB && AB.eternity), 'eternity');
  wireAutobuyer(g(() => AB && AB.reality), 'reality');

  // ---- script assembly -------------------------------------------------------
  const script = () => {
    const out = [];
    let pendingStudies = [];
    const flushStudies = () => {
      if (pendingStudies.length) { out.push('studies purchase ' + pendingStudies.join(',')); pendingStudies = []; }
    };
    for (const e of lines) {
      if (e.kind === 'study') { if (e.id != null) pendingStudies.push(e.id); continue; }
      flushStudies();
      out.push(e.text);
    }
    flushStudies();

    // Collapse consecutive identical lines into one + `# xN` comment.
    const collapsed = [];
    for (const line of out) {
      const prev = collapsed[collapsed.length - 1];
      if (prev && prev.text === line) { prev.count++; continue; }
      collapsed.push({ text: line, count: 1 });
    }
    const body = collapsed.map((c) => c.count > 1 ? (c.text + '    # x' + c.count) : c.text);

    const header = [
      '// DRAFT Automator script — recorded transcript, NOT ready to run as-is.',
      '// Add wait/until/if structure, loops, and autobuyer setup by hand.',
      '',
    ];
    return header.concat(body).join('\n');
  };

  W.__actRec = {
    get lines() { return lines; },
    script,
    async copy() {
      const text = script();
      try { await W.navigator.clipboard.writeText(text); console.log('[actRec] copied draft script to clipboard (' + lines.length + ' events)'); }
      catch { console.log('[actRec] clipboard blocked — copy this:\n' + text); }
      return text;
    },
    reset() { lines.length = 0; seq = 0; console.log('[actRec] cleared'); },
    stop() { restores.forEach((r) => r()); console.log('[actRec] stopped;', lines.length, 'events recorded (script/copy still work)'); },
  };
  console.log('%c[actRec] recording. Do your actions, then __actRec.copy() for a draft Automator script.', 'color:#9c9');
})();
