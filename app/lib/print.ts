export function printDocument(title: string, text: string) {
  const preview = window.open("", "_blank", "width=900,height=700");
  if (!preview) throw new Error("Басып шығару терезесін ашуға рұқсат беріңіз.");
  preview.document.title = title;
  const style = preview.document.createElement("style"); style.textContent = "body{font:12pt/1.65 Arial,sans-serif;color:#172033;padding:32px;max-width:800px;margin:auto}h1{font-size:20pt}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit}@media print{body{padding:0;color:#000}}@page{margin:20mm}";
  const heading = preview.document.createElement("h1"); heading.textContent = title;
  const content = preview.document.createElement("pre"); content.textContent = text;
  preview.document.head.append(style); preview.document.body.replaceChildren(heading, content);
  preview.document.fonts.ready.then(() => { preview.focus(); preview.print(); });
}
