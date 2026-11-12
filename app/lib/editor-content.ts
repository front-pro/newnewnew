const allowedTags = new Set(["p", "div", "br", "strong", "b", "em", "i", "u", "s", "ul", "ol", "li", "h1", "h2", "h3", "blockquote", "span", "font", "img"]);
const decodeEntities = (value: string) => value.replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Math.min(0x10ffff, Number(code)))).replace(/&#x([\da-f]+);/gi, (_, code: string) => String.fromCodePoint(Math.min(0x10ffff, parseInt(code, 16))));

export function sanitizeEditorHtml(value: string) {
  const source = value.replace(/<!--[\s\S]*?-->/g, "").replace(/<(script|style|iframe|object|svg|math)[^>]*>[\s\S]*?<\/\1\s*>/gi, "");
  return source.replace(/<(\/)?([a-z][\w-]*)([^>]*)>/gi, (whole, closing: string | undefined, rawTag: string, rawAttrs: string) => {
    const tag = rawTag.toLowerCase();
    if (!allowedTags.has(tag)) return "";
    if (closing) return tag === "br" || tag === "img" ? "" : tag === "font" ? "</span>" : `</${tag}>`;
    if (tag === "br") return "<br>";
    if (tag === "img") {
      const src = rawAttrs.match(/\bsrc\s*=\s*(["'])(.*?)\1/i)?.[2] || "";
      const alt = rawAttrs.match(/\balt\s*=\s*(["'])(.*?)\1/i)?.[2] || "";
      const width = rawAttrs.match(/\bstyle\s*=\s*(["'])[^"']*?\bwidth\s*:\s*(\d{1,3})%/i)?.[2];
      const naturalWidth = rawAttrs.match(/\bwidth\s*=\s*["']?(\d{1,4})/i)?.[1];
      const naturalHeight = rawAttrs.match(/\bheight\s*=\s*["']?(\d{1,4})/i)?.[1];
      if (!/^data:image\/(?:png|jpeg|gif);base64,[a-z\d+/]+=*$/i.test(src) || src.length > 4_200_000) return "";
      const dimensions = `${naturalWidth ? ` width="${Math.max(1, Math.min(3000, Number(naturalWidth)))}"` : ""}${naturalHeight ? ` height="${Math.max(1, Math.min(3000, Number(naturalHeight)))}"` : ""}`;
      return `<img src="${src}" alt="${alt.replace(/[&<>\"]/g, "")}"${dimensions} style="max-width:100%;height:auto;${width ? `width:${Math.max(10, Math.min(100, Number(width)))}%;` : ""}">`;
    }
    const styles = rawAttrs.match(/\bstyle\s*=\s*(["'])(.*?)\1/i)?.[2] || "";
    const align = styles.match(/(?:^|;)\s*text-align\s*:\s*(left|center|right|justify)\s*(?:;|$)/i)?.[1]?.toLowerCase();
    const rawFontSize = styles.match(/(?:^|;)\s*font-size\s*:\s*(\d{1,2})px\s*(?:;|$)/i)?.[1];
    const legacySize = rawAttrs.match(/\bsize\s*=\s*["']?([1-7])/i)?.[1];
    const fontSize = rawFontSize ? Math.max(10, Math.min(48, Number(rawFontSize))) : legacySize ? [10, 12, 14, 16, 20, 24, 32][Number(legacySize) - 1] : undefined;
    const safeStyle = [align ? `text-align:${align}` : "", fontSize ? `font-size:${fontSize}px` : ""].filter(Boolean).join(";");
    return tag === "font" ? `<span${safeStyle ? ` style="${safeStyle}"` : ""}>` : safeStyle ? `<${tag} style="${safeStyle}">` : `<${tag}>`;
  });
}

export function editorHtmlFromText(value: string) {
  if (/<(?:p|div|br|strong|b|em|i|u|s|ul|ol|li|h[1-3]|blockquote|img)\b/i.test(value)) return sanitizeEditorHtml(value);
  return value.split(/\r?\n/).map(line => line ? `<p>${line.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!)}</p>` : "<p><br></p>").join("");
}

export function editorHtmlToText(value: string) {
  return decodeEntities(value.replace(/<img\b[^>]*\balt\s*=\s*(["'])(.*?)\1[^>]*>/gi, " $2 ").replace(/<br\s*\/?>/gi, "\n").replace(/<\/(?:p|div|li|h[1-3]|blockquote)>/gi, "\n").replace(/<[^>]*>/g, "")).replace(/[\t ]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
