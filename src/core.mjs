export function encodeBookmarklet(body) {
  return 'javascript:' + encodeURIComponent(body) + 'void(0);';
}

export function decodeBookmarklet(line) {
  let s = line.trim();
  if (s.startsWith('// ')) s = s.slice(3).trim();
  if (!s.startsWith('javascript:')) throw new Error('not a bookmarklet');
  s = s.slice('javascript:'.length);
  if (!s.endsWith('void(0);')) throw new Error('missing void(0); suffix');
  s = s.slice(0, -'void(0);'.length);
  return decodeURIComponent(s);
}

export function fmtExp(v) {
  if (v == null) return '—';
  if (typeof v?.toExponential === 'function') {
    try { return v.toExponential(2); } catch { /* fall through */ }
  }
  return Number(v).toExponential(2);
}

export function isRunReset(tMs, lastTMs) {
  if (lastTMs == null) return false;
  return tMs < lastTMs - 50;
}

export function computeRate(gip, tMs) {
  if (tMs < 1) return null;
  const minutes = tMs / 60000;
  if (typeof gip?.div === 'function') return gip.div(minutes);
  return Number(gip) / minutes;
}

export function isHigherRate(rate, prev) {
  if (prev == null) return true;
  if (typeof rate?.gt === 'function') return rate.gt(prev);
  return Number(rate) > Number(prev);
}

export function updatePeak(prev, sample) {
  let { rate: peakRate, ip: peakIp, lastTMs } = prev;
  const { gip, tMs } = sample;

  if (tMs == null) return prev;

  lastTMs = tMs;

  if (gip == null) return { rate: peakRate, ip: peakIp, lastTMs };

  const rate = computeRate(gip, tMs);
  if (rate == null) return { rate: peakRate, ip: peakIp, lastTMs };

  if (isHigherRate(rate, peakRate)) {
    return { rate, ip: gip, lastTMs };
  }
  return { rate: peakRate, ip: peakIp, lastTMs };
}

export function gateCrunch(amount, gipResolver, DecimalCtor) {
  if (amount == null) return true;
  const a = String(amount).trim();
  if (a === '') return true;
  const gip = gipResolver();
  if (gip == null) return true;
  const threshold = parseDecimalLike(a, DecimalCtor);
  if (threshold == null) return true;
  if (typeof gip.gte === 'function') return gip.gte(threshold);
  return Number(gip) >= Number(threshold);
}

export function parseDecimalLike(s, DecimalCtor) {
  if (s == null) return null;
  const trimmed = String(s).trim();
  if (trimmed === '') return null;
  if (typeof DecimalCtor === 'function') {
    try { return new DecimalCtor(trimmed); } catch { return null; }
  }
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  return n;
}

export function updateIpMult(prev, sample, DecimalCtor) {
  if (sample == null || sample.count == null) {
    return { count: prev.count, amount: prev.amount, scaled: false };
  }
  if (prev.count == null || sample.count <= prev.count) {
    return { count: sample.count, amount: prev.amount, scaled: false };
  }
  const delta = sample.count - prev.count;
  const amount = sample.amount;
  if (amount == null || amount === '') {
    return { count: sample.count, amount, scaled: false };
  }
  if (typeof DecimalCtor !== 'function') {
    return { count: sample.count, amount, scaled: false };
  }
  let factor, base;
  try {
    base = new DecimalCtor(amount);
    factor = new DecimalCtor(2).pow(delta);
  } catch {
    return { count: sample.count, amount, scaled: false };
  }
  let newAmount;
  try {
    newAmount = base.times(factor).toString();
  } catch {
    return { count: sample.count, amount, scaled: false };
  }
  return { count: sample.count, amount: newAmount, scaled: true };
}

export function isThresholdSet(amount, DecimalCtor) {
  if (amount == null) return false;
  const s = String(amount).trim();
  if (s === '') return false;
  if (s === '0') return false;
  if (typeof DecimalCtor !== 'function') {
    const n = Number(s);
    return Number.isFinite(n) && n > 0;
  }
  let parsed;
  try {
    parsed = new DecimalCtor(s);
  } catch {
    return false;
  }
  if (typeof parsed?.gt === 'function') {
    try { return parsed.gt(0); } catch { return false; }
  }
  const n = Number(parsed);
  return Number.isFinite(n) && n > 0;
}

export function clampFps(value, def = 20, min = 1, max = 100) {
  if (value == null) return def;
  if (typeof value === 'string' && value.trim() === '') return def;
  const n = Number(value);
  if (!Number.isFinite(n)) return def;
  if (n < min) return min;
  if (n > max) return max;
  return Math.round(n);
}

export function trimWindow(timestamps, now, windowMs) {
  let i = 0;
  while (i < timestamps.length && now - timestamps[i] >= windowMs) i++;
  return i === 0 ? timestamps : timestamps.slice(i);
}

// Master toggle for all mechanics on a tab (used when clicking the already-active tab).
// states: [{ name, enabled }] for the tab; remembered: names enabled before the last
// "disable all" (or null/empty). If anything is on → turn all off, remembering the on-set.
// If all off → restore the remembered subset and clear memory; with no memory, enable all.
export function toggleTabEnabled(states, remembered) {
  const anyOn = states.some((s) => s.enabled);
  if (anyOn) {
    return {
      states: states.map((s) => ({ name: s.name, enabled: false })),
      remembered: states.filter((s) => s.enabled).map((s) => s.name),
    };
  }
  const hasMemory = Array.isArray(remembered) && remembered.length > 0;
  const set = hasMemory ? new Set(remembered) : null;
  return {
    states: states.map((s) => ({ name: s.name, enabled: set ? set.has(s.name) : true })),
    remembered: null,
  };
}

// Validate persisted tab memory on load: keep only names that still exist in config
// and belong to the tab they're filed under; drop tabs that end up empty.
export function sanitizeTabMemory(rawMemory, config) {
  const out = {};
  if (rawMemory == null || typeof rawMemory !== 'object') return out;
  for (const [tab, names] of Object.entries(rawMemory)) {
    if (!Array.isArray(names)) continue;
    const valid = names.filter((n) => config[n] && config[n].tab === tab);
    if (valid.length) out[tab] = valid;
  }
  return out;
}

// True when a tab has at least one mechanic and all of them are disabled.
export function isTabFullyPaused(config, tab) {
  const onTab = Object.values(config).filter((c) => c.tab === tab);
  return onTab.length > 0 && onTab.every((c) => !c.enabled);
}

// Pre-break, replicanti caps at Number.MAX_VALUE (shown as "Infinite" in-game).
export function isReplAtCap(amount) {
  if (amount == null) return false;
  if (typeof amount.gte === 'function') {
    try { return amount.gte(Number.MAX_VALUE); } catch { return false; }
  }
  const n = Number(amount);
  return n >= Number.MAX_VALUE;
}

// Tracks how long replicanti has been pinned at cap. prev: { since, galaxies };
// sample: { atCap, galaxies, now }. Dropping below cap clears the clock; a change
// in replicanti-galaxy count restarts it (a galaxy purchase resets replicanti to 1,
// but a fast regrow could hide the dip between samples).
export function updateReplStability(prev, sample) {
  const { atCap, galaxies, now } = sample;
  if (!atCap) return { since: null, galaxies };
  const galaxiesChanged = prev.galaxies != null && galaxies != null && galaxies !== prev.galaxies;
  if (prev.since == null || galaxiesChanged) return { since: now, galaxies };
  return { since: prev.since, galaxies };
}

export function shouldBreakInfinity({ broken, since, now, stableMs }) {
  if (broken) return false;
  if (since == null || now == null) return false;
  return now - since >= stableMs;
}

// The row's amount is the required stability window in seconds (blank = default).
export function stableMsFromAmount(amount, defSeconds = 10) {
  if (amount == null || String(amount).trim() === '') return defSeconds * 1000;
  const n = Number(amount);
  if (!Number.isFinite(n) || n < 0) return defSeconds * 1000;
  return n * 1000;
}

// EP-TT ordering gate: EP TT may fire only after Max EP Mult has had its turn
// this tick. "Had its turn" means it was attempted (so a throwing/no-op EP Mult,
// which spends no EP, doesn't starve EP TT) — not that it succeeded. When EP Mult
// is disabled there is nothing to defer to, so allow EP TT freely.
export function shouldFireEpTt({ epMultEnabled, epMultHadTurnThisTick }) {
  if (!epMultEnabled) return true;
  return epMultHadTurnThisTick;
}
