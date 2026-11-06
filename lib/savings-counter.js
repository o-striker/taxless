// Savings counter: pure logic shared by the landing page board and /api/savings-counter.
// No tax math: Postgres sums stored estimates and decides whether the figure is current; this
// file only validates, formats, and sequences one whole-dollar number and one date.

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// One { as_of_date, total_estimated_savings } object -> { asOfDate, totalDollars }, or null when
// it is not a valid positive figure (null means: keep the static "$2,000+").
export function parseCounterRow(row) {
  if (!row || typeof row !== 'object') return null;
  const asOfDate = row.as_of_date;
  if (typeof asOfDate !== 'string' || !DATE_PATTERN.test(asOfDate)) return null;
  const raw = row.total_estimated_savings;
  if (typeof raw !== 'number' && typeof raw !== 'string') return null;
  const total = Number(raw);
  if (!Number.isFinite(total)) return null;
  const totalDollars = Math.floor(total);
  if (totalDollars <= 0) return null;
  return { asOfDate, totalDollars };
}

// The Supabase function returns an array of zero or one rows.
export function parseCounterResponse(json) {
  if (!Array.isArray(json) || json.length !== 1) return null;
  return parseCounterRow(json[0]);
}

// The digits shown for value, zero-padded to the width of the final total.
export function tileDigits(totalDollars, value) {
  return String(value).padStart(String(totalDollars).length, '0').split('');
}

// Tile indexes that have a comma before them (every third tile counted from the right).
export function commaPositions(digitCount) {
  const positions = [];
  for (let index = 1; index < digitCount; index++) {
    if ((digitCount - index) % 3 === 0) positions.push(index);
  }
  return positions;
}

// The count-up sequence: ease-out cubic from 0, ending exactly on the total, never decreasing.
export function countUpValues(totalDollars, durationMilliseconds = 1200, stepMilliseconds = 55) {
  const steps = Math.ceil(durationMilliseconds / stepMilliseconds);
  const values = [];
  for (let step = 0; step <= steps; step++) {
    const progress = step / steps;
    const eased = 1 - Math.pow(1 - progress, 3);
    values.push(step === steps ? totalDollars : Math.floor(totalDollars * eased));
  }
  return values;
}

// "2026-11-06" -> "November 6, 2026", from the date parts (never new Date(), which reads the
// string as UTC midnight and shows the previous day west of UTC).
export function formatAsOfDate(asOfDate) {
  const [, year, month, day] = DATE_PATTERN.exec(asOfDate);
  return `${MONTH_NAMES[Number(month) - 1]} ${Number(day)}, ${year}`;
}

export function formatDollars(totalDollars) {
  return '$' + totalDollars.toLocaleString('en-US');
}
