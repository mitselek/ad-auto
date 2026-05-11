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

  if (isRunReset(tMs, lastTMs)) {
    peakRate = null;
    peakIp = null;
  }
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
