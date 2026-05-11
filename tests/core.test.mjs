import { test, expect, describe } from 'vitest';
import { encodeBookmarklet, decodeBookmarklet, fmtExp, isRunReset, computeRate, isHigherRate, parseDecimalLike, updatePeak, gateCrunch } from '../src/core.mjs';

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

  test('run reset clears peak then applies the new sample', () => {
    const next = updatePeak(
      { rate: 60, ip: 60, lastTMs: 9000 },
      { gip: 5, tMs: 1000 }
    );
    // rate = 5 / (1000/60000) = 300
    expect(next.rate).toBe(300);
    expect(next.ip).toBe(5);
    expect(next.lastTMs).toBe(1000);
  });

  test('run reset with tMs<1 clears peak and leaves rate null', () => {
    const next = updatePeak(
      { rate: 60, ip: 60, lastTMs: 9000 },
      { gip: 5, tMs: 0 }
    );
    expect(next.rate).toBe(null);
    expect(next.ip).toBe(null);
    expect(next.lastTMs).toBe(0);
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
