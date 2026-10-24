/** Local wall-clock time; callers resolve the account's timezone first. */
export const DEFAULT_DAILY_SUMMARY_TIME = '23:58';

export function dailySummaryTime(value?: string | null): string {
  return value && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
    ? value
    : DEFAULT_DAILY_SUMMARY_TIME;
}

export function isDailySummaryDue(localNow: Date, configuredTime?: string | null): boolean {
  const [hours, minutes] = dailySummaryTime(configuredTime).split(':').map(Number);
  return localNow.getHours() * 60 + localNow.getMinutes() >= hours * 60 + minutes;
}
