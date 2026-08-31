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
