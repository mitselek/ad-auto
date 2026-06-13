// ad-auto recorder — ground-truth instrumentation for the TT / EP-Mult autobuyers.
//
// Wraps the exact Antimatter Dimensions methods those autobuyers call and logs ONLY
// the invocations that actually changed state (or threw), with a sequence number and
// before/after snapshots. This captures what really happened — call order and effects —
// instead of relying on a description.
//
// USAGE (paste this whole file into the AD DevTools console, AFTER mounting the panel):
//   1. Run it. It prints a confirmation and starts recording silently.
//   2. Enable the autobuyers you want to observe (for the EP ordering: Max EP Mult + TT from EP).
//   3. Let it run through a few eternities.
//   4. __autoRec.copy()   -> copies the full JSON report to the clipboard (paste it anywhere).
//      __autoRec.dump()   -> returns the report object (also: console.log(JSON.stringify(__autoRec.dump(), null, 2))).
//      __autoRec.log      -> the raw change-event array.
//      __autoRec.stop()   -> un-patches the game methods (dump/copy still work afterwards).
//
// Reading the EP ordering: find a tick where both `epMult` and `TT.ep` fired — the `epMult`
// entry has the lower `seq`, and its `ep` AFTER equals the `TT.ep` `ep` BEFORE, proving the
// multiplier took its EP first. No-op ticks (the vast majority) are filtered out by design.
//
// This is a manual diagnostic tool — not part of the built bookmarklet, not inlined.

(() => {
  const W = window;
  if (W.__autoRec) W.__autoRec.stop(); // re-running restarts cleanly

  const s = (v) => {                    // stringify value / Decimal safely
    if (v == null) return null;
    try { return typeof v === 'object' ? v.toString() : v; } catch { return null; }
  };
  const g = (f) => { try { return f(); } catch { return null; } };
  const snap = () => ({
    am:     g(() => s(W.Currency.antimatter.value)),
    ip:     g(() => s(W.Currency.infinityPoints.value)),
    ep:     g(() => s(W.Currency.eternityPoints.value)),
    ttTot:  g(() => s(W.TimeTheorems.totalPurchased())),
    ttAm:   g(() => s(W.TimeTheoremPurchaseType.am.amount)),
    ttIp:   g(() => s(W.TimeTheoremPurchaseType.ip.amount)),
    ttEp:   g(() => s(W.TimeTheoremPurchaseType.ep.amount)),
    epMult: g(() => s(W.EternityUpgrade.epMult.boughtAmount)),
  });
  const changed = (a, b) => Object.keys(a).some((k) => a[k] !== b[k]);

  const log = [], MAX = 4000, startSnap = snap();
  let seq = 0;
  const restores = [];
  const wrap = (obj, method, label) => {
    if (obj == null || typeof obj[method] !== 'function') { console.warn('[autoRec] missing:', label); return; }
    const orig = obj[method];
    const hadOwn = Object.prototype.hasOwnProperty.call(obj, method);
    obj[method] = function (...args) {
      const before = snap();
      let result, threw = null;
      try { result = orig.apply(this, args); } catch (e) { threw = String((e && e.message) || e); }
      const after = snap();
      if ((threw || changed(before, after)) && log.length < MAX)
        log.push({ seq: seq++, t: Math.round(performance.now()), call: label, args: args.map(s), before, after, result: s(result), threw });
      if (threw) throw new Error(threw); // preserve original throw semantics
      return result;
    };
    restores.push(() => { if (hadOwn) obj[method] = orig; else delete obj[method]; });
  };

  const TTP = W.TimeTheoremPurchaseType, EU = W.EternityUpgrade;
  wrap(TTP && TTP.am, 'purchase', 'TT.am');
  wrap(TTP && TTP.ip, 'purchase', 'TT.ip');
  wrap(TTP && TTP.ep, 'purchase', 'TT.ep');
  wrap(EU && EU.epMult, 'buyMax', 'epMult');

  const meta = () => {
    const a = W.__auto;
    if (!a || !a.config) return null;
    const out = {};
    for (const k of ['amTT', 'ipTT', 'buyMaxEPMult', 'epTT'])
      if (a.config[k]) out[k] = { enabled: a.config[k].enabled, period: a.config[k].period, fires: a.stats?.[k]?.fires, errs: a.stats?.[k]?.errs };
    return out;
  };
  const dump = () => ({ recordedAt: new Date().toISOString(), startSnap, endSnap: snap(), autobuyers: meta(), changeCount: log.length, changes: log });

  W.__autoRec = {
    get log() { return log; },
    dump,
    async copy() {
      const json = JSON.stringify(dump(), null, 2);
      try { await navigator.clipboard.writeText(json); console.log('[autoRec] copied', log.length, 'change events to clipboard'); }
      catch { console.log('[autoRec] clipboard blocked — copy this:\n', json); }
      return json;
    },
    stop() { restores.forEach((r) => r()); console.log('[autoRec] stopped;', log.length, 'change events recorded (dump/copy still work)'); },
  };
  console.log('%c[autoRec] recording. Enable the TT/EP-Mult autobuyers, let it run, then __autoRec.copy().', 'color:#9c9');
})();
