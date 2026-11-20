import { editorHtmlToText } from "./editor-content";

export type ObligationType = "payment" | "renewal" | "expiry" | "deadline";
export type ContractObligation = {
  id: string;
  type: ObligationType;
  title: string;
  dueDate: string;
  responsible: string;
  excerpt: string;
  createdAt: string;
};
export type ObligationSuggestion = Omit<ContractObligation, "id" | "createdAt">;

function isoDate(value: string): string | null {
  let year = 0, month = 0, day = 0;
  const iso = value.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  const local = value.match(/\b(\d{1,2})[./](\d{1,2})[./](20\d{2})\b/);
  const named = value.match(/\b(\d{1,2})\s+([\p{L}.]+)\s+(20\d{2})\b/u);
  if (iso) { year = Number(iso[1]); month = Number(iso[2]); day = Number(iso[3]); }
  else if (local) { day = Number(local[1]); month = Number(local[2]); year = Number(local[3]); }
  else if (named) {
    day = Number(named[1]); year = Number(named[3]);
    const token = named[2].toLocaleLowerCase().replace(/\.$/, "");
    const months = [
      ["қаңтар", "январ", "january", "jan"], ["ақпан", "феврал", "february", "feb"], ["наурыз", "март", "march", "mar"],
      ["сәуір", "апрел", "april", "apr"], ["мамыр", "май", "may"], ["маусым", "июн", "june", "jun"],
      ["шілде", "июл", "july", "jul"], ["тамыз", "август", "august", "aug"], ["қыркүйек", "сентябр", "september", "sep"],
      ["қазан", "октябр", "october", "oct"], ["қараша", "ноябр", "november", "nov"], ["желтоқсан", "декабр", "december", "dec"],
    ];
    month = months.findIndex(aliases => aliases.some(alias => token.startsWith(alias))) + 1;
    if (!month) return null;
  }
  else return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` : null;
}

function obligationType(line: string): ObligationType {
  if (/төлем|төле\w*|оплат\w*|платеж|аванс/i.test(line)) return "payment";
  if (/ұзарт\w*|продлен\w*|renew\w*|автоматическ\w* продл/i.test(line)) return "renewal";
  if (/мерзім\w*|аяқтал\w*|срок действия|истека\w*|expiry|expiration/i.test(line)) return "expiry";
  return "deadline";
}

function responsibleParty(line: string): string {
  const named = line.match(/(?:жауапты(?:\s+тұлға)?|ответственный|ответственн\w* лицо)\s*[:—-]\s*([^,.;\n]{2,80})/i)?.[1]?.trim();
  if (named) return named;
  if (/тапсырыс беруші|заказчик|покупател\w*/i.test(line)) return "Тапсырыс беруші / Заказчик";
  if (/жеткізуші|исполнитель|поставщик|орындаушы/i.test(line)) return "Жеткізуші / Исполнитель";
  return "";
}

export function extractObligationSuggestions(source: string): ObligationSuggestion[] {
  const lines = editorHtmlToText(source).split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const seen = new Set<string>();
  const suggestions: ObligationSuggestion[] = [];
  for (const line of lines) {
    const dueDate = isoDate(line);
    if (!dueDate) continue;
    const type = obligationType(line);
    const key = `${type}:${dueDate}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const title = line.replace(/\b(?:20\d{2}-\d{1,2}-\d{1,2}|\d{1,2}[./]\d{1,2}[./]20\d{2}|\d{1,2}\s+[\p{L}.]+\s+20\d{2})\b/gu, "[күн]").replace(/\s+/g, " ").slice(0, 160);
    suggestions.push({ type, title: title || type, dueDate, responsible: responsibleParty(line), excerpt: line.slice(0, 400) });
    if (suggestions.length >= 50) break;
  }
  return suggestions;
}
