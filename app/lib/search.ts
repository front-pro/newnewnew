export function matchesSearch(query: string, values: (string | undefined)[], locale = "kk") {
  const normalize = (value: string) => value.normalize("NFKC").toLocaleLowerCase(locale).replace(/\s+/g, " ").trim();
  const tokens = normalize(query).split(" ").filter(Boolean);
  const content = normalize(values.filter(Boolean).join(" "));
  return tokens.every(token => content.includes(token));
}
