/**
 * Local-calendar-day formatting. `Date#toISOString()` is UTC — near midnight
 * that's the wrong calendar day in most timezones, which matters wherever a
 * write needs "today" fixed at capture time rather than sync time (an
 * offline-queued item, per 2.1, can sync well after the moment it was
 * captured).
 */
export function localDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** "WED 26 AUG" — the all-caps date kicker used above the Today tab's headline (design-reference). Built manually rather than via `toLocaleDateString` so the format doesn't drift by locale/engine. */
export function formatDateKicker(date: Date = new Date()): string {
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}
