const leap = (year: number) => year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
const ordinal = (iso: string): number => {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new RangeError('invalid World calendar date');
  const year = Number(iso.slice(0, 4)), month = Number(iso.slice(5, 7)), day = Number(iso.slice(8, 10)),
    months = [31, leap(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > months[month - 1]) throw new RangeError('invalid World calendar date');
  const previous = year - 1;
  return previous * 365 + Math.floor(previous / 4) - Math.floor(previous / 100) + Math.floor(previous / 400)
    + months.slice(0, month - 1).reduce((sum, days) => sum + days, 0) + day - 1;
};
const unixOrigin = ordinal('1970-01-01'), lastDay = ordinal('9999-12-31');

/** Pure calendar arithmetic only. The caller must separately authenticate the
 * explicit origin and day; this creates no Native evidence or observation order. */
export const worldCalendarDateAtDay = (dayOne: string, day: number): string => {
  const origin = ordinal(dayOne);
  if (!Number.isSafeInteger(day) || day < 0) throw new RangeError('invalid World calendar day');
  const target = origin + day - 1;
  if (target < 0 || target > lastDay) throw new RangeError('World calendar day exceeds four-digit date range');
  return new Date((target - unixOrigin) * 86400000).toISOString().slice(0, 10);
};

/** Inverse under the same explicit origin. Day zero is valid where the owning
 * calendar admits it; dates earlier than day zero cannot form a TraitTime. */
export const worldCalendarDayFromDate = (dayOne: string, date: string): number => {
  const day = ordinal(date) - ordinal(dayOne) + 1;
  if (day < 0) throw new RangeError('World calendar date precedes day zero');
  return day;
};
