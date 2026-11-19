import type { Locale } from "./i18n";

const historyTimestampPattern = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})(?: · |$)/;

export function historyTimestamp(meta: string): number | null {
  const match = meta.match(historyTimestampPattern);
  if (!match) return null;
  const timestamp = Date.parse(`${match[1]}T${match[2]}:00Z`);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function formatHistoryTimestamp(timestamp: number, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);
}
