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
