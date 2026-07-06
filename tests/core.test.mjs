import { test, expect, describe } from 'vitest';
import { encodeBookmarklet, decodeBookmarklet, fmtExp, isRunReset, computeRate, isHigherRate, parseDecimalLike, updatePeak, gateCrunch, updateIpMult, isThresholdSet, clampFps, trimWindow, toggleTabEnabled, sanitizeTabMemory, isTabFullyPaused, shouldFireEpTt, isReplAtCap, updateReplStability, hasBeenStableFor, stableMsFromAmount } from '../src/core.mjs';

describe('encodeBookmarklet', () => {
  test('wraps body with javascript: prefix and void(0); suffix', () => {
    expect(encodeBookmarklet('alert(1);')).toBe('javascript:alert(1)%3Bvoid(0);');
  });

  test('percent-encodes spaces, newlines, and reserved chars', () => {
    expect(encodeBookmarklet('a b\n${x}')).toBe('javascript:a%20b%0A%24%7Bx%7Dvoid(0);');
  });
});

describe('decodeBookmarklet', () => {
  test('round-trips with encodeBookmarklet for an arbitrary body', () => {
    const body = '(() => {\n  const x = `tpl ${1+1}`;\n  console.log(x);\n})();';
    const encoded = encodeBookmarklet(body);
    expect(decodeBookmarklet(encoded)).toBe(body);
  });

  test('strips leading "// " comment prefix', () => {
    const body = 'console.log(1);';
    const encoded = encodeBookmarklet(body);
    expect(decodeBookmarklet('// ' + encoded)).toBe(body);
  });

  test('throws on non-bookmarklet input', () => {
    expect(() => decodeBookmarklet('hello world')).toThrow(/not a bookmarklet/);
  });
});

describe('fmtExp', () => {
  test('returns em-dash for null', () => {
    expect(fmtExp(null)).toBe('—');
  });
  test('returns em-dash for undefined', () => {
    expect(fmtExp(undefined)).toBe('—');
  });
  test('formats a plain number in exponential with 2 decimals', () => {
    expect(fmtExp(1234)).toBe('1.23e+3');
  });
  test('delegates to value.toExponential when available (Decimal-like)', () => {
    const fake = { toExponential: (d) => `fake-${d}` };
    expect(fmtExp(fake)).toBe('fake-2');
  });
  test('stringifies non-finite numbers without crashing', () => {
    expect(fmtExp(Infinity)).toBe('Infinity');
    expect(fmtExp(NaN)).toBe('NaN');
  });
});

describe('isRunReset', () => {
  test('false when lastTMs is null', () => {
    expect(isRunReset(500, null)).toBe(false);
  });
  test('false when lastTMs is undefined', () => {
    expect(isRunReset(500, undefined)).toBe(false);
  });
  test('true when tMs is sharply less than lastTMs', () => {
    expect(isRunReset(0, 9000)).toBe(true);
  });
  test('false when within 50ms slop', () => {
    expect(isRunReset(9000, 9020)).toBe(false);
    expect(isRunReset(9000, 9049)).toBe(false);
  });
  test('true exactly outside slop', () => {
    expect(isRunReset(9000, 9051)).toBe(true);
  });
});

describe('computeRate', () => {
  test('returns null when tMs < 1', () => {
    expect(computeRate(100, 0)).toBe(null);
    expect(computeRate(100, 0.5)).toBe(null);
  });
  test('rate = gip / (tMs/60000) for plain number gip', () => {
    expect(computeRate(60, 60000)).toBe(60);
    expect(computeRate(120, 60000)).toBe(120);
    expect(computeRate(60, 30000)).toBe(120);
  });
  test('delegates to gip.div when present (Decimal-like)', () => {
    const fake = { div: (m) => `div-by-${m}` };
    expect(computeRate(fake, 60000)).toBe('div-by-1');
  });
});

describe('isHigherRate', () => {
  test('true when prev is null', () => {
    expect(isHigherRate(1, null)).toBe(true);
    expect(isHigherRate(0, null)).toBe(true);
  });
  test('plain-number comparison', () => {
    expect(isHigherRate(5, 4)).toBe(true);
    expect(isHigherRate(4, 5)).toBe(false);
    expect(isHigherRate(5, 5)).toBe(false);
  });
  test('delegates to rate.gt when present', () => {
    const fake = { gt: (p) => p === 'lower' };
    expect(isHigherRate(fake, 'lower')).toBe(true);
    expect(isHigherRate(fake, 'higher')).toBe(false);
  });
});

describe('parseDecimalLike', () => {
  test('returns null for empty or whitespace input', () => {
    expect(parseDecimalLike('')).toBe(null);
    expect(parseDecimalLike('   ')).toBe(null);
    expect(parseDecimalLike(null)).toBe(null);
    expect(parseDecimalLike(undefined)).toBe(null);
  });
  test('returns Number for a numeric string when no DecimalCtor', () => {
    expect(parseDecimalLike('1234')).toBe(1234);
    expect(parseDecimalLike(' 5.5 ')).toBe(5.5);
  });
  test('returns null for unparseable strings', () => {
    expect(parseDecimalLike('abc')).toBe(null);
    expect(parseDecimalLike('1e')).toBe(null);
  });
  test('uses DecimalCtor when provided', () => {
    class FakeDecimal { constructor(s) { this.s = s; } }
    const out = parseDecimalLike('1.5e500', FakeDecimal);
    expect(out).toBeInstanceOf(FakeDecimal);
    expect(out.s).toBe('1.5e500');
  });
  test('returns null if DecimalCtor throws', () => {
    class Throwing { constructor() { throw new Error('boom'); } }
    expect(parseDecimalLike('anything', Throwing)).toBe(null);
  });
});

describe('updatePeak', () => {
  test('first valid sample establishes the peak', () => {
    const next = updatePeak(
      { rate: null, ip: null, lastTMs: null },
      { gip: 60, tMs: 60000 }
    );
    expect(next.rate).toBe(60);
    expect(next.ip).toBe(60);
    expect(next.lastTMs).toBe(60000);
  });

  test('higher rate replaces the previous peak', () => {
    const next = updatePeak(
      { rate: 30, ip: 30, lastTMs: 60000 },
      { gip: 120, tMs: 60000 }
    );
    expect(next).toEqual({ rate: 120, ip: 120, lastTMs: 60000 });
  });

  test('lower rate does not replace the peak', () => {
    const next = updatePeak(
      { rate: 60, ip: 60, lastTMs: 60000 },
      { gip: 30, tMs: 60000 }
    );
    expect(next.rate).toBe(60);
    expect(next.ip).toBe(60);
    expect(next.lastTMs).toBe(60000);
  });

  test('equal rate keeps the peak', () => {
    const next = updatePeak(
      { rate: 60, ip: 60, lastTMs: 60000 },
      { gip: 60, tMs: 60000 }
    );
    expect(next).toEqual({ rate: 60, ip: 60, lastTMs: 60000 });
  });

  test('run reset preserves peak; lower-rate new sample does not displace it', () => {
    const next = updatePeak(
      { rate: 60, ip: 60, lastTMs: 9000 },
      { gip: 0.5, tMs: 1000 }
    );
    // new rate = 0.5 / (1000/60000) = 30, which is < 60 → peak survives
    expect(next.rate).toBe(60);
    expect(next.ip).toBe(60);
    expect(next.lastTMs).toBe(1000);
  });

  test('run reset with tMs<1 preserves peak', () => {
    const next = updatePeak(
      { rate: 60, ip: 60, lastTMs: 9000 },
      { gip: 5, tMs: 0 }
    );
    // computeRate returns null when tMs<1 → peak path skipped, peak unchanged
    expect(next).toEqual({ rate: 60, ip: 60, lastTMs: 0 });
  });

  test('higher rate after run reset displaces peak', () => {
    const next = updatePeak(
      { rate: 60, ip: 60, lastTMs: 9000 },
      { gip: 5, tMs: 1000 }
    );
    // new rate = 300, which is > 60 → peak updated to new sample
    expect(next).toEqual({ rate: 300, ip: 5, lastTMs: 1000 });
  });

  test('null gip only updates lastTMs', () => {
    const next = updatePeak(
      { rate: 60, ip: 60, lastTMs: 5000 },
      { gip: null, tMs: 6000 }
    );
    expect(next).toEqual({ rate: 60, ip: 60, lastTMs: 6000 });
  });

  test('null tMs returns prev unchanged', () => {
    const prev = { rate: 60, ip: 60, lastTMs: 5000 };
    expect(updatePeak(prev, { gip: 5, tMs: null })).toEqual(prev);
  });

  test('tMs<1 without reset updates lastTMs but not peak', () => {
    const next = updatePeak(
      { rate: 60, ip: 60, lastTMs: 0 },
      { gip: 5, tMs: 0 }
    );
    expect(next).toEqual({ rate: 60, ip: 60, lastTMs: 0 });
  });
});

describe('gateCrunch', () => {
  test('returns true when amount is null', () => {
    expect(gateCrunch(null, () => 9999)).toBe(true);
  });
  test('returns true when amount is empty or whitespace', () => {
    expect(gateCrunch('', () => 9999)).toBe(true);
    expect(gateCrunch('   ', () => 9999)).toBe(true);
  });
  test('returns true when gip is unavailable', () => {
    expect(gateCrunch('100', () => null)).toBe(true);
  });
  test('plain number gip >= amount → fire', () => {
    expect(gateCrunch('100', () => 100)).toBe(true);
    expect(gateCrunch('100', () => 150)).toBe(true);
  });
  test('plain number gip < amount → block', () => {
    expect(gateCrunch('100', () => 50)).toBe(false);
  });
  test('Decimal-like gip uses .gte for comparison', () => {
    const calls = [];
    const fakeGip = { gte: (t) => { calls.push(t); return true; } };
    expect(gateCrunch('100', () => fakeGip)).toBe(true);
    expect(calls.length).toBe(1);
    expect(calls[0]).toBe(100);
  });
  test('invalid amount string disables the gate', () => {
    expect(gateCrunch('abc', () => 10)).toBe(true);
  });
  test('uses DecimalCtor for amounts that overflow Number', () => {
    class FakeDecimal { constructor(s) { this.value = s; } }
    const fakeGip = { gte: function(t) { return t instanceof FakeDecimal && t.value === '1e500'; } };
    expect(gateCrunch('1e500', () => fakeGip, FakeDecimal)).toBe(true);
  });
});

describe('updateIpMult', () => {
  class FakeDecimal {
    constructor(s) {
      if (s === 'BOOM') throw new Error('boom');
      this._chain = String(s);
    }
    times(other) {
      const next = new FakeDecimal('placeholder');
      next._chain = `(${this._chain})*(${other._chain})`;
      return next;
    }
    pow(n) {
      const next = new FakeDecimal('placeholder');
      next._chain = `(${this._chain})^${n}`;
      return next;
    }
    toString() { return this._chain; }
  }

  test('sample.count null returns prev unchanged', () => {
    const prev = { count: 5, amount: '1e60' };
    const next = updateIpMult(prev, { count: null, amount: '1e60' });
    expect(next).toEqual({ count: 5, amount: '1e60', scaled: false });
  });

  test('first observation (prev.count null) records baseline, no scale', () => {
    const next = updateIpMult(
      { count: null, amount: '1e60' },
      { count: 5, amount: '1e60' }
    );
    expect(next).toEqual({ count: 5, amount: '1e60', scaled: false });
  });

  test('unchanged count is a no-op', () => {
    const next = updateIpMult(
      { count: 5, amount: '1e60' },
      { count: 5, amount: '1e60' }
    );
    expect(next).toEqual({ count: 5, amount: '1e60', scaled: false });
  });

  test('decreased count records the drop without scaling', () => {
    const next = updateIpMult(
      { count: 5, amount: '1e60' },
      { count: 2, amount: '1e60' }
    );
    expect(next).toEqual({ count: 2, amount: '1e60', scaled: false });
  });

  test('+1 delta with parseable amount scales by 2', () => {
    const next = updateIpMult(
      { count: 5, amount: '1e60' },
      { count: 6, amount: '1e60' },
      FakeDecimal
    );
    expect(next.count).toBe(6);
    expect(next.scaled).toBe(true);
    expect(next.amount).toBe('(1e60)*((2)^1)');
  });

  test('+3 delta passes delta through to .pow', () => {
    const next = updateIpMult(
      { count: 5, amount: '1e60' },
      { count: 8, amount: '1e60' },
      FakeDecimal
    );
    expect(next.count).toBe(8);
    expect(next.scaled).toBe(true);
    expect(next.amount).toBe('(1e60)*((2)^3)');
  });

  test('+1 delta with null amount advances count, does not scale', () => {
    const next = updateIpMult(
      { count: 5, amount: null },
      { count: 6, amount: null },
      FakeDecimal
    );
    expect(next).toEqual({ count: 6, amount: null, scaled: false });
  });

  test('+1 delta with empty-string amount advances count, does not scale', () => {
    const next = updateIpMult(
      { count: 5, amount: '' },
      { count: 6, amount: '' },
      FakeDecimal
    );
    expect(next).toEqual({ count: 6, amount: '', scaled: false });
  });

  test('+1 delta with undefined DecimalCtor advances count, does not scale', () => {
    const next = updateIpMult(
      { count: 5, amount: '1e60' },
      { count: 6, amount: '1e60' }
    );
    expect(next).toEqual({ count: 6, amount: '1e60', scaled: false });
  });

  test('+1 delta where DecimalCtor throws on construction advances count, does not scale', () => {
    const next = updateIpMult(
      { count: 5, amount: 'BOOM' },
      { count: 6, amount: 'BOOM' },
      FakeDecimal
    );
    expect(next).toEqual({ count: 6, amount: 'BOOM', scaled: false });
  });
});

describe('isThresholdSet', () => {
  class FakeDecimal {
    constructor(s) {
      if (s === 'BOOM') throw new Error('boom');
      this._s = String(s);
    }
    gt(other) {
      const n = Number(this._s);
      const o = typeof other === 'object' && other !== null ? Number(other._s) : Number(other);
      return n > o;
    }
  }

  test('null returns false', () => {
    expect(isThresholdSet(null)).toBe(false);
  });

  test('undefined returns false', () => {
    expect(isThresholdSet(undefined)).toBe(false);
  });

  test('empty string returns false', () => {
    expect(isThresholdSet('')).toBe(false);
  });

  test('whitespace string returns false', () => {
    expect(isThresholdSet('   ')).toBe(false);
  });

  test('"0" returns false (shortcut)', () => {
    expect(isThresholdSet('0')).toBe(false);
  });

  test('positive numeric string with DecimalCtor returns true', () => {
    expect(isThresholdSet('1e60', FakeDecimal)).toBe(true);
  });

  test('negative numeric string with DecimalCtor returns false', () => {
    expect(isThresholdSet('-1e60', FakeDecimal)).toBe(false);
  });

  test('unparseable string with throwing DecimalCtor returns false', () => {
    expect(isThresholdSet('BOOM', FakeDecimal)).toBe(false);
  });

  test('positive numeric string without DecimalCtor returns true', () => {
    expect(isThresholdSet('5')).toBe(true);
  });

  test('"0" without DecimalCtor returns false', () => {
    expect(isThresholdSet('0')).toBe(false);
  });

  test('unparseable string without DecimalCtor returns false', () => {
    expect(isThresholdSet('abc')).toBe(false);
  });
});

describe('clampFps', () => {
  test('passes a normal in-range value through (rounded to int)', () => {
    expect(clampFps(20)).toBe(20);
    expect(clampFps(30)).toBe(30);
    expect(clampFps('45')).toBe(45);
    expect(clampFps(20.6)).toBe(21);
  });
  test('clamps below min up to 1', () => {
    expect(clampFps(0)).toBe(1);
    expect(clampFps(-5)).toBe(1);
  });
  test('clamps above max down to 100', () => {
    expect(clampFps(101)).toBe(100);
    expect(clampFps(99999)).toBe(100);
  });
  test('keeps the exact bounds', () => {
    expect(clampFps(1)).toBe(1);
    expect(clampFps(100)).toBe(100);
  });
  test('falls back to default 20 for non-numeric / blank / nullish', () => {
    expect(clampFps(NaN)).toBe(20);
    expect(clampFps('')).toBe(20);
    expect(clampFps('   ')).toBe(20);
    expect(clampFps(null)).toBe(20);
    expect(clampFps(undefined)).toBe(20);
    expect(clampFps('abc')).toBe(20);
  });
});

describe('trimWindow', () => {
  test('returns empty for an empty buffer', () => {
    expect(trimWindow([], 1000, 1000)).toEqual([]);
  });
  test('keeps all entries when all are within the window', () => {
    expect(trimWindow([900, 950, 990], 1000, 1000)).toEqual([900, 950, 990]);
  });
  test('drops entries at or older than windowMs ago', () => {
    // now-0 = 1000 (>= window, drop), now-500 = 500 (keep), now-900 = 100 (keep)
    expect(trimWindow([0, 500, 900], 1000, 1000)).toEqual([500, 900]);
  });
  test('treats the exact boundary as expired (strict)', () => {
    expect(trimWindow([0], 1000, 1000)).toEqual([]);
  });
  test('length equals the count of ticks in the trailing window', () => {
    const buf = [0, 100, 600, 800, 950];
    // now=1000, window=1000: 0 -> 1000 expired; 100,600,800,950 survive
    expect(trimWindow(buf, 1000, 1000).length).toBe(4);
  });
});

describe('toggleTabEnabled', () => {
  test('mixed state: disables all and remembers the enabled subset', () => {
    const out = toggleTabEnabled(
      [{ name: 'a', enabled: true }, { name: 'b', enabled: false }, { name: 'c', enabled: true }],
      null
    );
    expect(out.states).toEqual([
      { name: 'a', enabled: false },
      { name: 'b', enabled: false },
      { name: 'c', enabled: false },
    ]);
    expect(out.remembered).toEqual(['a', 'c']);
  });

  test('all enabled: disables all and remembers all', () => {
    const out = toggleTabEnabled(
      [{ name: 'a', enabled: true }, { name: 'b', enabled: true }],
      null
    );
    expect(out.states).toEqual([
      { name: 'a', enabled: false },
      { name: 'b', enabled: false },
    ]);
    expect(out.remembered).toEqual(['a', 'b']);
  });

  test('all disabled with a remembered set: restores exactly that subset and clears memory', () => {
    const out = toggleTabEnabled(
      [{ name: 'a', enabled: false }, { name: 'b', enabled: false }, { name: 'c', enabled: false }],
      ['a', 'c']
    );
    expect(out.states).toEqual([
      { name: 'a', enabled: true },
      { name: 'b', enabled: false },
      { name: 'c', enabled: true },
    ]);
    expect(out.remembered).toBe(null);
  });

  test('all disabled with no memory: enables all (so the tab is usable)', () => {
    const out = toggleTabEnabled(
      [{ name: 'a', enabled: false }, { name: 'b', enabled: false }],
      null
    );
    expect(out.states).toEqual([
      { name: 'a', enabled: true },
      { name: 'b', enabled: true },
    ]);
    expect(out.remembered).toBe(null);
  });

  test('all disabled with an empty remembered array is treated as no memory: enables all', () => {
    const out = toggleTabEnabled(
      [{ name: 'a', enabled: false }, { name: 'b', enabled: false }],
      []
    );
    expect(out.states).toEqual([
      { name: 'a', enabled: true },
      { name: 'b', enabled: true },
    ]);
    expect(out.remembered).toBe(null);
  });

  test('remembered names no longer present in the tab are ignored on restore', () => {
    const out = toggleTabEnabled(
      [{ name: 'a', enabled: false }, { name: 'b', enabled: false }],
      ['a', 'gone']
    );
    expect(out.states).toEqual([
      { name: 'a', enabled: true },
      { name: 'b', enabled: false },
    ]);
    expect(out.remembered).toBe(null);
  });

  test('does not mutate the input states array or its objects', () => {
    const input = [{ name: 'a', enabled: true }, { name: 'b', enabled: false }];
    const snapshot = JSON.parse(JSON.stringify(input));
    toggleTabEnabled(input, null);
    expect(input).toEqual(snapshot);
  });

  test('empty tab: no-op with no memory', () => {
    const out = toggleTabEnabled([], null);
    expect(out.states).toEqual([]);
    expect(out.remembered).toBe(null);
  });
});

describe('sanitizeTabMemory', () => {
  const config = {
    maxAll: { tab: 'AD' },
    galaxy: { tab: 'AD' },
    crunch: { tab: 'AD' },
    buyMaxID: { tab: 'Infinity' },
  };

  test('returns empty object for nullish or non-object input', () => {
    expect(sanitizeTabMemory(null, config)).toEqual({});
    expect(sanitizeTabMemory(undefined, config)).toEqual({});
    expect(sanitizeTabMemory('nope', config)).toEqual({});
    expect(sanitizeTabMemory(42, config)).toEqual({});
  });

  test('keeps only names that exist in config and belong to that tab', () => {
    const out = sanitizeTabMemory({ AD: ['maxAll', 'galaxy'] }, config);
    expect(out).toEqual({ AD: ['maxAll', 'galaxy'] });
  });

  test('drops names that do not exist in config', () => {
    const out = sanitizeTabMemory({ AD: ['maxAll', 'ghost'] }, config);
    expect(out).toEqual({ AD: ['maxAll'] });
  });

  test('drops names whose config tab does not match the memory key', () => {
    // buyMaxID belongs to Infinity, not AD → dropped
    const out = sanitizeTabMemory({ AD: ['maxAll', 'buyMaxID'] }, config);
    expect(out).toEqual({ AD: ['maxAll'] });
  });

  test('omits tabs that end up with no valid names', () => {
    const out = sanitizeTabMemory({ AD: ['ghost'], Infinity: ['buyMaxID'] }, config);
    expect(out).toEqual({ Infinity: ['buyMaxID'] });
  });

  test('skips non-array values (e.g. persisted null memory)', () => {
    const out = sanitizeTabMemory({ AD: null, Infinity: ['buyMaxID'] }, config);
    expect(out).toEqual({ Infinity: ['buyMaxID'] });
  });

  test('does not mutate the input', () => {
    const raw = { AD: ['maxAll', 'ghost'] };
    const snap = JSON.parse(JSON.stringify(raw));
    sanitizeTabMemory(raw, config);
    expect(raw).toEqual(snap);
  });
});

describe('isTabFullyPaused', () => {
  const config = {
    maxAll: { tab: 'AD', enabled: false },
    galaxy: { tab: 'AD', enabled: false },
    buyMaxID: { tab: 'Infinity', enabled: true },
    buyMaxTD: { tab: 'Eternity', enabled: false },
  };

  test('true when every mechanic on the tab is disabled', () => {
    expect(isTabFullyPaused(config, 'AD')).toBe(true);
    expect(isTabFullyPaused(config, 'Eternity')).toBe(true);
  });

  test('false when at least one mechanic on the tab is enabled', () => {
    expect(isTabFullyPaused(config, 'Infinity')).toBe(false);
  });

  test('false when one of several is enabled', () => {
    const mixed = { a: { tab: 'X', enabled: false }, b: { tab: 'X', enabled: true } };
    expect(isTabFullyPaused(mixed, 'X')).toBe(false);
  });

  test('false for a tab with no mechanics (nothing to pause)', () => {
    expect(isTabFullyPaused(config, 'Nonexistent')).toBe(false);
  });
});

describe('shouldFireEpTt', () => {
  test('EP Mult disabled: EP TT may always fire (nothing to defer to)', () => {
    expect(shouldFireEpTt({ epMultEnabled: false, epMultHadTurnThisTick: false })).toBe(true);
    expect(shouldFireEpTt({ epMultEnabled: false, epMultHadTurnThisTick: true })).toBe(true);
  });

  test('EP Mult enabled and it had its turn this tick: EP TT may fire', () => {
    expect(shouldFireEpTt({ epMultEnabled: true, epMultHadTurnThisTick: true })).toBe(true);
  });

  test('EP Mult enabled but did not get its turn this tick: EP TT is held', () => {
    expect(shouldFireEpTt({ epMultEnabled: true, epMultHadTurnThisTick: false })).toBe(false);
  });
});

describe('isReplAtCap', () => {
  const dec = (n) => ({ gte: (x) => n >= x });

  test('true when a Decimal-like amount is at or above Number.MAX_VALUE', () => {
    expect(isReplAtCap(dec(Number.MAX_VALUE))).toBe(true);
    expect(isReplAtCap(dec(Infinity))).toBe(true);
  });

  test('false when below cap', () => {
    expect(isReplAtCap(dec(1e300))).toBe(false);
    expect(isReplAtCap(1e300)).toBe(false);
  });

  test('handles plain numbers at cap', () => {
    expect(isReplAtCap(Number.MAX_VALUE)).toBe(true);
    expect(isReplAtCap(Infinity)).toBe(true);
  });

  test('false for null, undefined, and non-numeric values', () => {
    expect(isReplAtCap(null)).toBe(false);
    expect(isReplAtCap(undefined)).toBe(false);
    expect(isReplAtCap('nope')).toBe(false);
  });

  test('false when the Decimal comparison throws', () => {
    expect(isReplAtCap({ gte: () => { throw new Error('boom'); } })).toBe(false);
  });
});

describe('updateReplStability', () => {
  const empty = { since: null, galaxies: null };

  test('starts the clock when replicanti first hits cap', () => {
    const out = updateReplStability(empty, { atCap: true, galaxies: 5, now: 1000 });
    expect(out).toEqual({ since: 1000, galaxies: 5 });
  });

  test('keeps the original since while cap and galaxy count hold', () => {
    const s1 = updateReplStability(empty, { atCap: true, galaxies: 5, now: 1000 });
    const s2 = updateReplStability(s1, { atCap: true, galaxies: 5, now: 4000 });
    expect(s2).toEqual({ since: 1000, galaxies: 5 });
  });

  test('clears the clock when replicanti drops below cap', () => {
    const s1 = updateReplStability(empty, { atCap: true, galaxies: 5, now: 1000 });
    const s2 = updateReplStability(s1, { atCap: false, galaxies: 5, now: 2000 });
    expect(s2.since).toBe(null);
  });

  test('restarts the clock when a replicanti galaxy is bought between samples', () => {
    const s1 = updateReplStability(empty, { atCap: true, galaxies: 5, now: 1000 });
    const s2 = updateReplStability(s1, { atCap: true, galaxies: 6, now: 3000 });
    expect(s2).toEqual({ since: 3000, galaxies: 6 });
  });

  test('galaxy count of 0 is tracked (not treated as missing)', () => {
    const s1 = updateReplStability(empty, { atCap: true, galaxies: 0, now: 1000 });
    const s2 = updateReplStability(s1, { atCap: true, galaxies: 1, now: 2000 });
    expect(s2.since).toBe(2000);
  });

  test('missing galaxy probe never restarts the clock', () => {
    const s1 = updateReplStability(empty, { atCap: true, galaxies: null, now: 1000 });
    const s2 = updateReplStability(s1, { atCap: true, galaxies: null, now: 5000 });
    expect(s2.since).toBe(1000);
  });
});

describe('hasBeenStableFor', () => {
  test('false while no stability clock is running', () => {
    expect(hasBeenStableFor({ since: null, now: 5000, stableMs: 1000 })).toBe(false);
  });

  test('false when now is missing', () => {
    expect(hasBeenStableFor({ since: 1000, now: null, stableMs: 1000 })).toBe(false);
  });

  test('false before the window elapses, true at and after it', () => {
    expect(hasBeenStableFor({ since: 1000, now: 1999, stableMs: 1000 })).toBe(false);
    expect(hasBeenStableFor({ since: 1000, now: 2000, stableMs: 1000 })).toBe(true);
    expect(hasBeenStableFor({ since: 1000, now: 9000, stableMs: 1000 })).toBe(true);
  });
});

describe('stableMsFromAmount', () => {
  test('converts seconds to ms', () => {
    expect(stableMsFromAmount(5)).toBe(5000);
    expect(stableMsFromAmount('30')).toBe(30000);
  });

  test('blank or missing amount falls back to the default', () => {
    expect(stableMsFromAmount(null)).toBe(10000);
    expect(stableMsFromAmount('')).toBe(10000);
    expect(stableMsFromAmount('  ')).toBe(10000);
  });

  test('non-numeric or negative amounts fall back to the default', () => {
    expect(stableMsFromAmount('abc')).toBe(10000);
    expect(stableMsFromAmount(-3)).toBe(10000);
  });

  test('zero means fire immediately at cap', () => {
    expect(stableMsFromAmount(0)).toBe(0);
  });
});
