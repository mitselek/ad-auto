import { test, expect, describe } from 'vitest';
import { encodeBookmarklet, decodeBookmarklet, fmtExp, isRunReset, computeRate, isHigherRate, parseDecimalLike, updatePeak, gateCrunch, updateIpMult, isThresholdSet } from '../src/core.mjs';

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
