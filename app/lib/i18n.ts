import { messages } from "./messages";

export type Locale = "kk" | "ru" | "en";
export const isLocale = (value: unknown): value is Locale => value === "kk" || value === "ru" || value === "en";
export function roleKey(role: string) {
  return role === "admin" ? "Әкімші" : role === "employee" ? "Қызметкер" : role === "user" ? "Пайдаланушы" : role;
}

export function createTranslator(locale: Locale) {
  return (key: string, values: Record<string, string | number> = {}) => {
    const message = locale === "kk" ? key : messages[key]?.[locale === "ru" ? 0 : 1] ?? key;
    return message.replace(/\{(\w+)\}/g, (match, name: string) => Object.hasOwn(values, name) ? String(values[name]) : match);
  };
}

type Translator = ReturnType<typeof createTranslator>;

export function analysisSummary(summary: string, tr: Translator) {
  const match = summary.match(/^A құжаты \((\d+) тармақ\) мен B құжаты \((\d+) тармақ\) салыстырылды: (\d+) өзгеріс табылды\.$/);
  return match ? tr("A құжаты ({a} тармақ) мен B құжаты ({b} тармақ) салыстырылды: {total} өзгеріс табылды.", { a: match[1], b: match[2], total: match[3] }) : summary;
}

export function analysisReference(reference: string, tr: Translator) {
  const match = reference.match(/^(\d+(?:\.\d+)*)-тармақ$/);
  return match ? tr("{clause}-тармақ", { clause: match[1] }) : tr(reference);
}

export function analysisDescription(description: string, tr: Translator) {
  return description
    .replace(/\(ұқсастық (\d+)%\)$/, (_, percent: string) => tr("(ұқсастық {percent}%)", { percent }))
    .replace(/^Екі тармақ мазмұны (\d+)% сәйкес: /, (_, percent: string) => tr("Екі тармақ мазмұны {percent}% сәйкес: ", { percent }));
}
