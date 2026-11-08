import { expect, it } from 'vitest';
import { worldCalendarDateAtDay, worldCalendarDayFromDate } from './WorldCalendarDate';

it('retains the explicit day-one origin, including valid day zero and year boundaries', () => {
  expect(worldCalendarDateAtDay('2031-01-01', 1)).toBe('2031-01-01');
  expect(worldCalendarDateAtDay('2031-01-01', 0)).toBe('2030-12-31');
  expect(worldCalendarDateAtDay('2031-12-31', 2)).toBe('2032-01-01');
  expect(worldCalendarDayFromDate('2031-01-01', '2030-12-31')).toBe(0);
  expect(worldCalendarDayFromDate('2031-01-01', '2032-01-01')).toBe(366);
});

it('uses Gregorian leap years across centuries without host-local time', () => {
  expect(worldCalendarDateAtDay('2000-02-28', 2)).toBe('2000-02-29');
  expect(worldCalendarDateAtDay('2000-02-28', 3)).toBe('2000-03-01');
  expect(worldCalendarDateAtDay('1900-02-28', 2)).toBe('1900-03-01');
  expect(worldCalendarDateAtDay('2026-01-01', 1462)).toBe('2030-01-01');
  expect(worldCalendarDayFromDate('2026-01-01', '2030-01-01')).toBe(1462);
});

it('handles the full four-digit Gregorian range, including years below one hundred', () => {
  expect(worldCalendarDateAtDay('0001-01-01', 1)).toBe('0001-01-01');
  expect(worldCalendarDateAtDay('0099-12-31', 2)).toBe('0100-01-01');
  expect(worldCalendarDayFromDate('0001-01-01', '9999-12-31')).toBe(3652059);
  expect(worldCalendarDateAtDay('0001-01-01', 3652059)).toBe('9999-12-31');
});

it('rejects invalid dates and unrepresentable or fractional day ordinals', () => {
  for (const date of ['0000-01-01', '2031-02-29', '1900-02-29', '2031-04-31', '2031-1-01', '2031-01-01T00:00:00Z']) {
    expect(() => worldCalendarDateAtDay(date, 1)).toThrow();
    expect(() => worldCalendarDayFromDate('2031-01-01', date)).toThrow();
  }
  for (const day of [-1, .5, NaN, Infinity, Number.MAX_SAFE_INTEGER]) expect(() => worldCalendarDateAtDay('2031-01-01', day)).toThrow();
  expect(() => worldCalendarDateAtDay('0001-01-01', 0)).toThrow();
  expect(() => worldCalendarDateAtDay('9999-12-31', 2)).toThrow();
  expect(() => worldCalendarDayFromDate('2031-01-01', '2030-12-30')).toThrow();
});
