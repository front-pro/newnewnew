// Серверде жасалатын интерфейс (HTML файлсыз). Барлық деректі /api арқылы алады.
const express = require('express');
const PORT = process.env.PORT || 3000;
const BASE = `http://localhost:${PORT}`;

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cookies = req => Object.fromEntries((req.headers.cookie || '').split(';').filter(Boolean).map(c => {
  const i = c.indexOf('='); return [c.slice(0, i).trim(), decodeURIComponent(c.slice(i + 1))];
}));
const call = async (token, method, url, body) => {
  const r = await fetch(BASE + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || ('Қате ' + r.status));
  return d;
};

// ---------- UI helpers ----------
const TONE = {
  blue: 'bg-blue-50 text-blue-700 border-blue-200', red: 'bg-rose-50 text-rose-700 border-rose-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200', green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  violet: 'bg-violet-50 text-violet-700 border-violet-200', slate: 'bg-slate-100 text-slate-600 border-slate-200'
};
const BTN = {
  primary: 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-600/20',
  ghost: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200',
  green: 'bg-emerald-600 hover:bg-emerald-700 text-white'
};
const badge = (t, tone = 'blue') => `<span class="font-mono text-[11px] font-semibold px-2 py-0.5 rounded-md border ${TONE[tone]}">${esc(t)}</span>`;
const btn = (label, kind = 'primary', attrs = '') => `<button ${attrs} class="${BTN[kind]} font-medium text-sm px-4 py-2 rounded-xl transition">${label}</button>`;
const flash = (msg, tone = 'blue') => msg ? `<div class="border ${TONE[tone] || TONE.blue} px-4 py-3 rounded-xl text-sm font-mono">${esc(msg)}</div>` : '';
const head = (title, sub, right = '') => `<div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
  <div><h1 class="text-2xl font-bold">${title}</h1><p class="text-sm text-slate-500 mt-0.5">${sub}</p></div>${right}</div>`;
const locked = (t, d) => `<div class="card p-12 text-center space-y-3"><div class="text-4xl">🔒</div><h3 class="text-lg font-bold">${t}</h3>
  <p class="text-sm text-slate-500 max-w-md mx-auto">${d}</p><a href="/login" class="inline-block ${BTN.primary} text-sm px-4 py-2 rounded-xl">Жүйеге кіру</a></div>`;

const page = (title, inner) => `<!DOCTYPE html><html lang="kk"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
<script src="https://cdn.tailwindcss.com/3.4.17"></script>
<script>tailwind.config={theme:{extend:{fontFamily:{sans:['Inter','sans-serif'],mono:['JetBrains Mono','monospace']}}}}</script>
<style>body{background:#f3f7fd;background-image:radial-gradient(#cddbf0 1px,transparent 1px);background-size:22px 22px;color:#0f172a}
.card{background:#fff;border:1px solid #e2e8f0;border-radius:1rem;box-shadow:0 1px 2px rgba(15,23,42,.04)}</style></head>
<body class="font-sans antialiased min-h-screen">${inner}</body></html>`;

const TABS = [['compare', 'Талдау (A/B)'], ['templates', 'Үлгілер'], ['editor', 'Редактор'], ['history', 'Тарих'], ['users', 'Пайдаланушылар']];
const shell = (me, tab, body, fl = '') => page('KT Neural Document Agent', `
<header class="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-slate-200 px-4 md:px-6 py-3 flex flex-col md:flex-row items-center justify-between gap-3">
  <div class="flex items-center gap-5 flex-wrap justify-center">
    <a href="/compare" class="flex items-center gap-2"><span class="bg-gradient-to-br from-blue-600 to-cyan-500 text-white font-mono font-bold px-2.5 py-1.5 rounded-lg text-sm">KT</span>
      <b class="text-slate-800">Neural Agent</b><span class="font-mono text-[11px] text-emerald-600 bg-emerald-50 border border-emerald-200 rounded px-1.5">● online</span></a>
    <nav class="flex gap-1 text-sm font-medium flex-wrap justify-center">
      ${TABS.filter(t => t[0] !== 'users' || me.role === 'admin').map(([id, l]) =>
        `<a href="/${id}" class="px-3 py-1.5 rounded-lg transition ${tab === id ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}">${l}</a>`).join('')}
    </nav>
  </div>
  <form method="POST" action="/logout" class="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg pl-3 pr-1.5 py-1.5">
    <div class="leading-tight text-right"><p class="text-xs font-semibold">${esc(me.name)}</p><p class="font-mono text-[11px] text-blue-700">${esc(me.role)}</p></div>
    ${btn(me.role === 'guest' ? 'Кіру' : 'Шығу', 'ghost', 'class="!py-1 !px-3 !text-xs"')}
  </form>
</header>
<main class="max-w-6xl mx-auto p-4 md:p-6 space-y-6">${fl}${body}</main>
<footer class="border-t border-slate-200 bg-white/70 py-4 text-center font-mono text-xs text-slate-400">KT Neural Document Agent v2.0</footer>`);

// ---------- Routes ----------
module.exports = app => {
  app.use(express.urlencoded({ extended: false, limit: '2mb' }));
  const setCookies = (res, sid, guest) => res.setHeader('Set-Cookie', [
    `sid=${sid}; Path=/; HttpOnly; SameSite=Lax${sid ? '' : '; Max-Age=0'}`,
    `guest=${guest ? 1 : ''}; Path=/; SameSite=Lax${guest ? '' : '; Max-Age=0'}`]);
  const fl = req => flash(req.query.msg, req.query.t);

  // --- Кіру / тіркелу / қонақ ---
  app.get('/login', (req, res) => {
    const inp = 'w-full border border-slate-300 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-sm outline-none bg-white';
    const demo = [['admin@kt.kz', 'Admin123', 'red'], ['employee@kt.kz', 'Employee123', 'blue'], ['user@kt.kz', 'User12345', 'green']];
    res.send(page('Кіру · KT Neural Agent', `<div class="min-h-screen flex items-center justify-center p-4"><div class="w-full max-w-md space-y-5">
      <div class="text-center space-y-2"><span class="inline-block bg-gradient-to-br from-blue-600 to-cyan-500 text-white font-mono font-bold px-4 py-2.5 rounded-xl text-xl">KT</span>
        <h1 class="text-2xl font-bold">Neural Document Agent</h1><p class="text-sm text-slate-500">Толық мүмкіндіктер үшін авторизация қажет</p></div>
      ${flash(req.query.err, 'red')}
      <form method="POST" action="/login" class="card p-6 space-y-3"><h2 class="font-semibold">Кіру</h2>
        <input class="${inp}" type="email" name="email" placeholder="Email" required>
        <input class="${inp}" type="password" name="password" placeholder="Құпиясөз" required>${btn('Жүйеге кіру', 'primary', 'class="w-full"')}</form>
      <form method="POST" action="/register" class="card p-6 space-y-3"><h2 class="font-semibold">Тіркелу</h2>
        <input class="${inp}" name="name" placeholder="Аты-жөні" required>
        <input class="${inp}" type="email" name="email" placeholder="Email" required>
        <input class="${inp}" type="password" name="password" placeholder="Құпиясөз (кемінде 8 таңба)" required>${btn('Тіркелу', 'ghost', 'class="w-full"')}</form>
      <form method="POST" action="/guest"><button class="w-full border-2 border-dashed border-slate-300 hover:border-blue-400 hover:bg-white rounded-xl py-2.5 text-sm font-medium transition">
        👤 Қонақ ретінде жалғастыру<span class="block text-xs font-normal text-slate-400">Талдау бар, сақтау мен экспорт жоқ</span></button></form>
      <div class="card p-4 space-y-1.5"><p class="text-xs font-semibold text-slate-500">Демо аккаунттар:</p>
        ${demo.map(([e, p, t]) => `<div class="flex justify-between items-center font-mono text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2"><span>${e} / ${p}</span>${badge(e.split('@')[0], t)}</div>`).join('')}</div>
    </div></div>`));
  });
  const authPost = kind => async (req, res) => {
    try {
      const b = req.body;
      const d = await call(null, 'POST', '/api/auth/' + kind, kind === 'login' ? { email: b.email, password: b.password } : b);
      setCookies(res, d.token, false); res.redirect('/compare');
    } catch (e) { res.redirect('/login?err=' + encodeURIComponent(e.message)); }
  };
  app.post('/login', authPost('login'));
  app.post('/register', authPost('register'));
  app.post('/guest', (req, res) => { setCookies(res, '', true); res.redirect('/compare'); });
  app.post('/logout', (req, res) => { setCookies(res, '', false); res.redirect('/login'); });

  // --- Қорғау: кірмеген адам /login-ге ---
  const guard = async (req, res, next) => {
    const c = cookies(req); req.token = c.sid || null;
    if (!c.sid && !c.guest) return res.redirect('/login');
    try { req.me = c.sid ? await call(c.sid, 'GET', '/api/auth/me') : { name: 'Қонақ', role: 'guest' }; } catch { req.me = { role: 'guest' }; }
    if (c.sid && !req.me.email) { setCookies(res, '', false); return res.redirect('/login'); }
    next();
  };
  const h = (tab, fn) => async (req, res) => {
    try { await fn(req, res); } catch (e) { res.send(shell(req.me, tab, '', flash(e.message, 'red'))); }
  };
  app.get('/', (req, res) => res.redirect('/compare'));

  // --- Талдау ---
  const SAMPLE_A = `1.1. Департамент ұйымның құрылымдық бөлімшесі болып табылады.\n2.1. Құжаттарды қағаз және электронды түрде архивтеуді қамтамасыз ету.\n3.1. Ақпараттық жүйелердің қауіпсіздігін тексеру жүргізіледі.\n3.2. Ақпараттық жүйелерді әзірлеу ұйымдастырылады.`;
  const SAMPLE_B = `1.1. Департамент ұйымның құрылымдық бөлімшесі болып табылады.\n2.1. Жасанды интеллект негізіндегі құжаттарды автоматты талдауды қамтамасыз ету.\n3.1. Ақпараттық жүйелердің қауіпсіздігін тексеру және әзірлеу жүргізіледі.\n3.2. Ақпараттық жүйелердің қауіпсіздігін тексеру жүргізіледі.`;
  const dz = (t, n, v) => `<div class="card p-5 space-y-3"><div class="flex justify-between items-center gap-2"><h3 class="font-semibold text-sm">${t}</h3>
    <label class="text-xs text-blue-600 cursor-pointer hover:underline">📎 Файлды таңдау (.txt, .md, .csv)<input type="file" accept=".txt,.md,.csv,text/plain,text/markdown,text/csv" class="hidden" onchange="const f=this.files[0];if(f)f.text().then(x=>{this.closest('.card').querySelector('textarea').value=x;this.closest('.card').querySelector('[data-filename]').textContent=f.name})"></label></div>
    <p data-filename class="text-xs text-slate-400">Файл таңдалмаған — мәтінді төменде енгізуге де болады.</p>
    <textarea name="${n}" required spellcheck="false" class="w-full h-56 border border-slate-200 rounded-xl p-3 font-mono text-xs outline-none focus:border-blue-500 resize-y">${esc(v)}</textarea></div>`;
  const compareHtml = (me, r, a = SAMPLE_A, b = SAMPLE_B) => {
    const tn = { CONFLICT: 'red', LOST_FUNCTION: 'amber', NEW_CLAUSE: 'blue', CHANGED: 'violet' };
    const M = r && [['Барлық өзгерістер', r.metrics.total, ''], ['Қақтығыстар', r.metrics.conflicts, 'text-rose-600'], ['Жоғалған функциялар', r.metrics.lost, 'text-amber-600'], ['Жаңа / өзгерген', r.metrics.news + r.metrics.changed, 'text-blue-600']];
    return head('Құжаттарды семантикалық салыстыру', '«Дейін» және «Кейін» редакцияларын ЖИ арқылы талдау',
        btn('⚡ Талдауды іске қосу', 'primary', 'form="cmp"')) +
      (me.role === 'guest' ? `<div class="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl text-sm"><b>Қонақ режимі:</b> талдау жұмыс істейді, бірақ нәтиже сақталмайды, экспорт пен редактор жабық. <a class="underline" href="/login">Кіру / Тіркелу</a></div>` : '') +
      `<form id="cmp" method="POST" action="/compare" class="grid md:grid-cols-2 gap-6">${dz('Құжат A (Редакция «Дейін»)', 'a', a)}${dz('Құжат B (Редакция «Кейін»)', 'b', b)}</form>` +
      (r ? `<div class="card p-6 space-y-6"><div class="flex flex-col md:flex-row justify-between gap-4 pb-4 border-b border-slate-100">
        <div><div class="flex items-center gap-2"><h2 class="text-xl font-bold">Талдау қорытындысы</h2>${r.isSaved ? badge('Сақталды', 'green') : badge('Уақытша режим', 'slate')}</div>
        <p class="text-sm text-slate-600 mt-1">${esc(r.summary)}</p></div>
        <form method="POST" action="/export/${r.id}">${btn('📥 Экспорттау', 'ghost')}</form></div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">${M.map(([l, v, c]) => `<div class="bg-slate-50 border border-slate-200 rounded-xl p-4"><span class="text-xs text-slate-500">${l}</span><p class="font-mono text-3xl font-bold mt-1 ${c}">${v}</p></div>`).join('')}</div>
        <div class="space-y-3"><h3 class="font-semibold">Source Trace &amp; Agent Insight</h3>${r.changes.map(c => `<div class="border border-slate-200 rounded-xl p-4 space-y-3">
          <div class="flex items-center gap-2 flex-wrap">${badge(c.type, tn[c.type])}<h4 class="font-semibold">${esc(c.title)}</h4></div>
          <p class="text-sm text-slate-600">${esc(c.description)}</p>
          <div class="font-mono text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-500">📍 A: ${esc(c.a)} ➔ 📍 B: ${esc(c.b)}</div></div>`).join('')}</div></div>` : '');
  };
  app.get('/compare', guard, h('compare', (req, res) => res.send(shell(req.me, 'compare', compareHtml(req.me, null), fl(req)))));
  app.post('/compare', guard, h('compare', async (req, res) => {
    const r = await call(req.token, 'POST', '/api/analysis/run', { a: req.body.a, b: req.body.b });
    res.send(shell(req.me, 'compare', compareHtml(req.me, r, req.body.a, req.body.b)));
  }));
  app.post('/export/:id', guard, async (req, res) => {
    try {
      const d = await call(req.token, 'GET', `/api/analysis/${Number(req.params.id)}/export`);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="analysis-${Number(req.params.id)}.csv"`);
      res.send('\ufeff' + d.csv);
    }
    catch (e) { res.redirect('/compare?t=amber&msg=' + encodeURIComponent(e.message)); }
  });

  // --- Үлгілер ---
  const enc = encodeURIComponent;
  app.get('/templates', guard, h('templates', async (req, res) => {
    const intro = head('Құжат үлгілерінің кітапханасы', 'Үлгіні редакторда ашыңыз, жүктеңіз немесе өз үлгіңізді қосыңыз');
    if (req.me.role === 'guest') return res.send(shell(req.me, 'templates', intro + locked('Үлгілер кітапханасы жабық', 'Үлгілерді көру үшін тіркеліңіз немесе кіріңіз.')));
    const list = await call(req.token, 'GET', '/api/templates');
    const canWrite = ['employee', 'admin'].includes(req.me.role);
    const card = t => t.locked
      ? `<div class="card p-5 space-y-2 opacity-60">${badge('Құлыпталған 🔒', 'red')}<h3 class="font-bold">${esc(t.title)}</h3><p class="text-xs text-slate-500">Тек қызметкерлерге қолжетімді.</p></div>`
      : `<div class="card p-5 space-y-3 flex flex-col">${badge(t.access === 'public' ? 'Жалпы · Public' : 'Корпоративтік · Employee', t.access === 'public' ? 'green' : 'blue')}
        <h3 class="font-bold">${esc(t.title)}</h3><p class="text-xs text-slate-500">${esc(t.desc)}</p>
        <details class="text-xs"><summary class="cursor-pointer text-blue-600">Қарап шығу</summary>
          <pre class="mt-2 whitespace-pre-wrap font-mono bg-slate-50 border border-slate-200 rounded-lg p-3 max-h-48 overflow-auto">${esc(t.body)}</pre></details>
        <div class="flex gap-2 flex-wrap mt-auto">
          <a href="/templates/${t.id}/open" class="${BTN.ghost} text-sm px-4 py-2 rounded-xl">Үлгіні ашу</a>
          <form method="POST" action="/templates/${t.id}/use">${btn('Үлгіні өзгерту')}</form>
          <a href="/templates/${t.id}/download" class="${BTN.ghost} text-sm px-4 py-2 rounded-xl">⬇ .txt</a>
          ${canWrite && (req.me.role === 'admin' || t.owner === req.me.email) ? `<form method="POST" action="/templates/${t.id}/delete">${btn('Жою', 'ghost')}</form>` : ''}
        </div></div>`;
    const inp = 'w-full border border-slate-300 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-sm outline-none bg-white';
    const create = canWrite ? `<form method="POST" action="/templates" class="card p-5 space-y-3"><h2 class="font-semibold">➕ Жаңа үлгі қосу</h2>
      <div class="grid md:grid-cols-3 gap-3"><input class="${inp}" name="title" placeholder="Атауы" required>
        <input class="${inp}" name="desc" placeholder="Қысқаша сипаттама">
        <select name="access" class="${inp}"><option value="public">Жалпы (барлығына)</option><option value="employee">Тек қызметкерлерге</option></select></div>
      <textarea name="body" required placeholder="Үлгі мәтіні..." class="${inp} h-32 font-mono"></textarea>${btn('Үлгіні сақтау', 'green')}</form>` : '';
    res.send(shell(req.me, 'templates', intro + `<div class="grid md:grid-cols-3 gap-6">${list.map(card).join('')}</div>` + create, fl(req)));
  }));
  app.post('/templates', guard, async (req, res) => {
    try { await call(req.token, 'POST', '/api/templates', req.body); res.redirect('/templates?t=green&msg=' + enc('Үлгі қосылды')); }
    catch (e) { res.redirect('/templates?t=red&msg=' + enc(e.message)); }
  });
  app.post('/templates/:id/use', guard, async (req, res) => {
    try { await call(req.token, 'POST', `/api/templates/${Number(req.params.id)}/use`); res.redirect('/editor?tpl=' + Number(req.params.id)); }
    catch (e) { res.redirect('/templates?t=red&msg=' + enc(e.message)); }
  });
  app.get('/templates/:id/open', guard, async (req, res) => {
    try {
      const t = await call(req.token, 'GET', `/api/templates/${Number(req.params.id)}`);
      res.send(shell(req.me, 'templates', head(esc(t.title), esc(t.desc)) +
        `<div class="card p-6 space-y-4"><pre class="whitespace-pre-wrap font-mono text-sm">${esc(t.body)}</pre>
        <div class="flex gap-2"><form method="POST" action="/templates/${t.id}/use">${btn('Үлгіні өзгерту')}</form><a href="/templates" class="${BTN.ghost} text-sm px-4 py-2 rounded-xl">Үлгілерге қайту</a></div></div>`, fl(req)));
    } catch (e) { res.redirect('/templates?t=red&msg=' + enc(e.message)); }
  });
  app.post('/templates/:id/delete', guard, async (req, res) => {
    try { await call(req.token, 'DELETE', `/api/templates/${Number(req.params.id)}`); res.redirect('/templates?t=green&msg=' + enc('Үлгі жойылды')); }
    catch (e) { res.redirect('/templates?t=red&msg=' + enc(e.message)); }
  });
  app.get('/templates/:id/download', guard, async (req, res) => {
    try {
      const t = await call(req.token, 'GET', `/api/templates/${Number(req.params.id)}`);
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="template-${t.id}.txt"`);
      res.send('\ufeff' + t.body);
    } catch (e) { res.redirect('/templates?t=red&msg=' + enc(e.message)); }
  });

  // --- Редактор ---
  const DOC = `1. ЖАЛПЫ ЕРЕЖЕЛЕР\n1.1. Осы Департамент туралы ереже ұйымның құрылымдық бөлімшесінің мәртебесін белгілейді.\n\n2. НЕГІЗГІ МІНДЕТТЕРІ\n2.1. Құжаттарды автоматты семантикалық талдауды қамтамасыз ету.`;
  app.get('/editor', guard, h('editor', async (req, res) => {
    const intro = head('Құжат редакторы', 'Мәтінді сақтаған сайын жаңа нұсқа жасалады');
    if (req.me.role === 'guest') return res.send(shell(req.me, 'editor', intro + locked('Редактор жабық', 'Құжаттарды өңдеу және сақтау үшін жүйеге кіріңіз.')));
    let text = DOC, note = '', ver = 0;
    if (req.query.tpl) { const t = await call(req.token, 'GET', '/api/templates/' + Number(req.query.tpl)); text = t.body; note = `«${t.title}» үлгісі негізінде ашылды. Сақтау үшін төмендегі батырманы басыңыз.`; }
    else { const d = await call(req.token, 'GET', '/api/documents/me'); ver = d.version; if (d.text) text = d.text; }
    res.send(shell(req.me, 'editor', head('Құжат редакторы', 'Мәтінді сақтаған сайын жаңа нұсқа жасалады', ver ? badge('соңғы нұсқа: v' + ver + '.0', 'slate') : '') +
      `<form id="editor-form" method="POST" action="/editor" class="space-y-3"><div class="rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm">
        <div class="px-4 py-2 bg-slate-50 border-b border-slate-200 font-mono text-xs text-slate-500">Құжат редакторы</div>
        <textarea id="editor-text" name="text" spellcheck="false" class="w-full h-96 p-5 font-mono text-sm leading-relaxed outline-none resize-y">${esc(text)}</textarea></div>
        <div class="flex gap-2 flex-wrap">${btn('💾 Серверге сақтау', 'green')}<button type="button" id="download-edited" class="${BTN.ghost} font-medium text-sm px-4 py-2 rounded-xl">⬇ Өзгертілген файлды жүктеу</button></div></form>
        <script>document.getElementById('download-edited').addEventListener('click',()=>{const text=document.getElementById('editor-text').value;const blob=new Blob([text],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='edited-document.txt';a.click();URL.revokeObjectURL(url)})</script>`, fl(req) + flash(note, 'violet')));
  }));
  app.post('/editor', guard, async (req, res) => {
    try { const d = await call(req.token, 'POST', '/api/documents', { text: req.body.text }); res.redirect('/editor?t=green&msg=' + enc(`Сақталды! Жаңа нұсқа: v${d.version}.0`)); }
    catch (e) { res.redirect('/editor?t=red&msg=' + enc(e.message)); }
  });

  // --- Тарих ---
  app.get('/history', guard, h('history', async (req, res) => {
    let body;
    if (req.me.role === 'guest') body = locked('Тарих қолжетімсіз', 'Қонақтардың тарихы сақталмайды. Жүйеге кіріңіз.');
    else {
      const rows = await call(req.token, 'GET', '/api/history');
      body = rows.length ? `<div class="card overflow-hidden divide-y divide-slate-100">${rows.map(r => `<div class="p-4"><div class="flex items-center gap-2 flex-wrap">${badge(r.type, r.tone)}<b class="text-sm">${esc(r.title)}</b></div><p class="font-mono text-xs text-slate-400 mt-1">${esc(r.meta)}</p></div>`).join('')}</div>`
        : '<div class="card p-12 text-center text-sm text-slate-500">Тарих бос. Талдауды іске қосыңыз.</div>';
    }
    res.send(shell(req.me, 'history', head('Әрекеттер тарихы', 'Сақталған талдаулар мен нұсқалар журналы') + body, fl(req)));
  }));

  // --- Пайдаланушылар (тек әкімші) ---
  app.get('/users', guard, h('users', async (req, res) => {
    if (req.me.role !== 'admin') throw new Error('403 Forbidden: бұл бөлім тек әкімшіге арналған');
    const list = await call(req.token, 'GET', '/api/users');
    res.send(shell(req.me, 'users', head('Пайдаланушыларды басқару', 'Аккаунттарға рөл беру (RBAC)') +
      `<div class="card overflow-hidden divide-y divide-slate-100">${list.map(u => `<form method="POST" action="/users/role" class="p-4 flex flex-col md:flex-row justify-between md:items-center gap-2">
        <div><p class="font-medium text-sm">${esc(u.name)}</p><p class="font-mono text-xs text-slate-400">${esc(u.email)}</p></div>
        <input type="hidden" name="email" value="${esc(u.email)}"><div class="flex gap-2">
        <select name="role" ${u.email === req.me.email ? 'disabled' : ''} class="font-mono text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-blue-700">
          ${['user', 'employee', 'admin'].map(r => `<option ${u.role === r ? 'selected' : ''}>${r}</option>`).join('')}</select>
        ${u.email === req.me.email ? '' : btn('Сақтау', 'ghost', 'class="!py-1 !text-xs"')}</div></form>`).join('')}</div>`, fl(req)));
  }));
  app.post('/users/role', guard, async (req, res) => {
    try { await call(req.token, 'PATCH', `/api/users/${encodeURIComponent(req.body.email)}/role`, { role: req.body.role }); res.redirect('/users?t=green&msg=' + encodeURIComponent('Рөл жаңартылды')); }
    catch (e) { res.redirect('/users?t=red&msg=' + encodeURIComponent(e.message)); }
  });
};
