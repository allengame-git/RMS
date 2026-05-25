import { describe, it, expect } from 'vitest';

describe('dataYear validation', () => {
  const isValidDataYear = (dataYear: string): boolean => {
    return /^\d{4}$/.test(dataYear) && parseInt(dataYear) >= 1900 && parseInt(dataYear) <= 2100;
  };

  it('accepts valid year', () => {
    expect(isValidDataYear('2024')).toBe(true);
    expect(isValidDataYear('1900')).toBe(true);
    expect(isValidDataYear('2100')).toBe(true);
  });

  it('rejects path traversal', () => {
    expect(isValidDataYear('../2024')).toBe(false);
    expect(isValidDataYear('../../../../tmp')).toBe(false);
  });

  it('rejects absolute path', () => {
    expect(isValidDataYear('/etc')).toBe(false);
  });

  it('rejects non-numeric', () => {
    expect(isValidDataYear('abcd')).toBe(false);
    expect(isValidDataYear('')).toBe(false);
  });

  it('rejects out of range', () => {
    expect(isValidDataYear('1899')).toBe(false);
    expect(isValidDataYear('2101')).toBe(false);
  });
});
