// Екі құжат мәтінін тармақ (clause) деңгейінде салыстыру.
// Тармақ: "1.1. Мәтін" немесе жай жол. Ұқсастық: сөз түбірлері жиыны бойынша Жаккар коэффициенті.
// Қазақ тілі жалғаулы тіл, сондықтан сөздің алғашқы 5 әрпі (түбір) салыстырылады.
const tokens = s => s.match(/[\p{L}\p{N}]+/gu) || [];
const stem = w => { w = w.toLowerCase(); return w.length > 5 ? w.slice(0, 5) : w; };
const clauses = t => String(t).split(/\r?\n/).map(s => s.trim()).filter(Boolean).map(s => {
  const m = s.match(/^(\d+(?:\.\d+)*)\.?\s+(.*)$/);
  const text = m ? m[2] : s, toks = tokens(text);
  return { n: m ? m[1] : '', text, toks, set: new Set(toks.map(stem)) }; // жиын бір рет есептеледі
});
const sim = (x, y, min = 0) => {
  if (!x.size || !y.size) return 0;
  const [s, l] = x.size <= y.size ? [x, y] : [y, x];
  if (s.size / l.size < min) return 0; // жылдам кесу: бұдан жоғары ұқсастық мүмкін емес
  let i = 0; s.forEach(w => l.has(w) && i++);
  return i / (x.size + y.size - i);
};
const norm = s => s.toLowerCase().replace(/\s+/g, ' ').trim();
const cut = (s, n = 140) => (s.length > n ? s.slice(0, n) + '…' : s);
const ref = c => (c ? (c.n ? c.n + '-тармақ' : 'жол') : 'Жоқ');


function compare(aText, bText) {
  const A = clauses(aText), B = clauses(bText);
  const usedA = new Set(), matched = new Map(); // B index -> A index
  // 1) дәл сәйкестік
  B.forEach((b, j) => {
    const i = A.findIndex((a, k) => !usedA.has(k) && norm(a.text) === norm(b.text));
    if (i >= 0) { usedA.add(i); matched.set(j, i); }
  });
  const changes = [];
  const add = (type, title, description, a, b) => changes.push({ id: changes.length + 1, type, title, description, a, b });
  // 2) жуық сәйкестік (өзгертілген тармақ)
  B.forEach((b, j) => {
    if (matched.has(j)) return;
    let best = -1, bs = 0;
    A.forEach((a, k) => { if (usedA.has(k)) return; const s = sim(a.text, b.text); if (s > bs) { bs = s; best = k; } });
    if (best >= 0 && bs >= 0.45) {
      usedA.add(best); matched.set(j, best);
      add('CHANGED', 'Өзгертілген тармақ', `«${cut(A[best].text, 70)}» → «${cut(b.text, 70)}» (ұқсастық ${Math.round(bs * 100)}%)`, ref(A[best]), ref(b));
    } else {
      add('NEW_CLAUSE', 'Жаңа тармақ', cut(b.text), 'Жоқ', ref(b));
    }
  });
  // 3) жоғалған тармақтар
  A.forEach((a, k) => { if (!usedA.has(k)) add('LOST_FUNCTION', 'Жоғалған функция (Lost Function)', cut(a.text), ref(a), 'Жоқ (Жоғалған)'); });
  // 4) B ішінде қайталанатын / қабаттасатын тармақтар
  for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) {
    const s = sim(B[i].text, B[j].text);
    if (s >= 0.6 && norm(B[i].text) !== norm(B[j].text))
      add('CONFLICT', 'Overlapping / қайталанатын функция', `Екі тармақ мазмұны ${Math.round(s * 100)}% сәйкес: «${cut(B[i].text, 60)}» және «${cut(B[j].text, 60)}»`, ref(B[i]), ref(B[j]));
  }
  const count = t => changes.filter(c => c.type === t).length;
  const metrics = { total: changes.length, conflicts: count('CONFLICT'), lost: count('LOST_FUNCTION'), news: count('NEW_CLAUSE'), changed: count('CHANGED') };
  return {
    summary: `A құжаты (${A.length} тармақ) мен B құжаты (${B.length} тармақ) салыстырылды: ${metrics.total} өзгеріс табылды.`,
    metrics, changes
  };
}

module.exports = { compare };
