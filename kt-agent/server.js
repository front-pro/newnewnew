const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const { compare } = require('./compare');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '2mb' }));
require('./pages')(app); // интерфейс (HTML файлсыз)

// ---------- RBAC ----------
const BASE = ['doc.upload', 'analysis.run'];
const USER = [...BASE, 'analysis.export', 'analysis.save', 'doc.edit', 'template.read.public', 'history.read.own'];
const PERMS = {
  guest: BASE,
  user: USER,
  employee: [...USER, 'template.read.employee', 'template.write'],
  admin: [...USER, 'template.read.employee', 'template.write', 'user.manage']
};

// ---------- Data (in memory) ----------
const hash = (pass, salt) => crypto.scryptSync(pass, salt, 32).toString('hex');
const mkUser = (name, email, pass, role) => {
  const salt = crypto.randomBytes(8).toString('hex');
  return { name, email, salt, hash: hash(pass, salt), role };
};
let users = [
  mkUser('Әкімші', 'admin@kt.kz', 'Admin123', 'admin'),
  mkUser('Қызметкер', 'employee@kt.kz', 'Employee123', 'employee'),
  mkUser('Пайдаланушы', 'user@kt.kz', 'User12345', 'user')
];
const sessions = new Map();   // token -> email
const analyses = new Map();   // id -> { owner, result }
const versions = new Map();   // email -> doc version
const log = [];               // history rows
let nextId = 1;
const pub = u => ({ name: u.name, email: u.email, role: u.role });
const now = () => new Date().toISOString().slice(0, 16).replace('T', ' ');

const SEED = [
  { id: 1, title: 'Қызметтік жазба үлгісі', desc: 'Ішкі хат алмасуға арналған стандартты формат.', access: 'public', owner: 'system',
    body: `ҚЫЗМЕТТІК ЖАЗБА\n\nКімге: [лауазымы, аты-жөні]\nКімнен: [лауазымы, аты-жөні]\nКүні: [күн.ай.жыл]\n\n1. Мәселенің мәні: [қысқаша сипаттаңыз]\n2. Ұсыныс: [не істеу керек]\n3. Қосымшалар: [құжаттар тізімі]` },
  { id: 2, title: 'Еңбек шартына қосымша келісім', desc: 'Кадрлық өзгерістерді тіркеуге арналған келісім.', access: 'public', owner: 'system',
    body: `ЕҢБЕК ШАРТЫНА ҚОСЫМША КЕЛІСІМ № [нөмірі]\n\n1.1. Осы келісім [күні] жасалған еңбек шартына өзгеріс енгізеді.\n1.2. Қызметкер [лауазымы] қызметіне ауыстырылады.\n2.1. Жалақы мөлшері [сома] теңге болып белгіленеді.\n2.2. Қалған шарттар өзгеріссіз қалады.` },
  { id: 3, title: 'Бөлімше ережесі және функциялар матрицасы', desc: 'Қайта құрылымдау кезіндегі ішкі департамент регламенті (тек қызметкерлерге).', access: 'employee', owner: 'system',
    body: `[БӨЛІМШЕ АТАУЫ] ТУРАЛЫ ЕРЕЖЕ\n\n1.1. Бөлімше ұйымның құрылымдық бөлімшесі болып табылады.\n1.2. Бөлімше өз қызметінде заңнаманы және ішкі регламентті басшылыққа алады.\n2.1. Құжаттарды автоматты талдауды қамтамасыз ету.\n2.2. Нормативтік құжаттар редакцияларындағы қақтығыстарды анықтау.\n3.1. Құжаттарды архивтеу және сақтау.` }
];

// ---------- Сақтау (data.json): қайта қосқанда деректер жоғалмайды ----------
const DB = 'data.json';
const docs = new Map();      // email -> соңғы сақталған құжат мәтіні
let templates = SEED;
try {
  const d = JSON.parse(fs.readFileSync(DB, 'utf8'));
  users = d.users; log.push(...d.log); nextId = d.nextId;
  d.analyses.forEach(([k, v]) => analyses.set(k, v));
  d.versions.forEach(([k, v]) => versions.set(k, v));
  (d.docs || []).forEach(([k, v]) => docs.set(k, v));
  if (d.templates) templates = d.templates;
} catch {}
const save = () => fs.writeFileSync(DB, JSON.stringify({ users, log, nextId, analyses: [...analyses], versions: [...versions], docs: [...docs], templates }));

// ---------- Middleware ----------
app.use((req, res, next) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const u = users.find(x => x.email === sessions.get(token));
  req.user = u || { name: 'Қонақ', email: null, role: 'guest' };
  next();
});
const need = perm => (req, res, next) =>
  PERMS[req.user.role].includes(perm)
    ? next()
    : res.status(req.user.email ? 403 : 401).json({ error: `403 Forbidden: «${perm}» рұқсаты жоқ. Жүйеге кіріңіз` });

// ---------- Auth ----------
app.post('/api/auth/register', (req, res) => {
  const { name = '', email = '', password = '' } = req.body;
  const e = email.trim().toLowerCase();
  if (!name.trim()) return res.status(400).json({ error: 'Атыңызды енгізіңіз' });
  if (!/^\S+@\S+\.\S+$/.test(e)) return res.status(400).json({ error: 'Email форматы дұрыс емес' });
  if (password.length < 8) return res.status(400).json({ error: 'Құпиясөз кемінде 8 таңба болуы керек' });
  if (users.some(u => u.email === e)) return res.status(409).json({ error: '409: Бұл email тіркелген' });
  const u = mkUser(name.trim(), e, password, 'user'); // жаңа аккаунт әрқашан "user"
  users.push(u);
  save();
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, u.email);
  res.status(201).json({ token, user: pub(u) });
});

app.post('/api/auth/login', (req, res) => {
  const { email = '', password = '' } = req.body;
  const u = users.find(x => x.email === email.trim().toLowerCase());
  const ok = u && crypto.timingSafeEqual(Buffer.from(hash(password, u.salt)), Buffer.from(u.hash));
  if (!ok) return res.status(401).json({ error: '401: Email немесе құпиясөз қате' });
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, u.email);
  res.json({ token, user: pub(u) });
});

app.get('/api/auth/me', (req, res) => res.json(pub(req.user)));

// ---------- Analysis ----------
app.post('/api/analysis/run', need('analysis.run'), (req, res) => {
  const a = String(req.body.a || ''), b = String(req.body.b || '');
  if (!a.trim() || !b.trim()) return res.status(400).json({ error: 'Екі құжаттың мәтінін енгізіңіз (A және B)' });
  if (a.length > 200000 || b.length > 200000) return res.status(413).json({ error: 'Құжат тым үлкен (макс. 200 000 таңба)' });
  const id = nextId++;
  const saved = !!req.user.email;
  const result = { id, ...compare(a, b), isSaved: saved };
  if (saved) {
    analyses.set(id, { owner: req.user.email, result });
    log.push({ owner: req.user.email, type: 'ЖИ талдауы', tone: 'blue', title: `Салыстыру #${id}`, meta: `${now()} · ${result.metrics.total} өзгеріс анықталды` });
  }
  save();
  res.json(result);
});

app.get('/api/analysis/:id/export', need('analysis.export'), (req, res) => {
  const a = analyses.get(Number(req.params.id));
  if (!a || a.owner !== req.user.email) return res.status(404).json({ error: '404: Талдау табылмады' });
  const q = v => `"${String(v).replace(/"/g, '""')}"`;
  const csv = ['type,title,a,b,description', ...a.result.changes.map(c => [c.type, c.title, c.a, c.b, c.description].map(q).join(','))].join('\n');
  res.json({ message: `Есеп #${req.params.id} экспортқа дайын`, csv });
});

// ---------- Documents & history ----------
app.post('/api/documents', need('doc.edit'), (req, res) => {
  const text = String(req.body.text || '');
  if (!text.trim()) return res.status(400).json({ error: 'Құжат мәтіні бос' });
  if (text.length > 200000) return res.status(413).json({ error: 'Құжат тым үлкен' });
  const v = (versions.get(req.user.email) || 0) + 1;
  versions.set(req.user.email, v);
  docs.set(req.user.email, text);
  log.push({ owner: req.user.email, type: 'Редактор', tone: 'green', title: 'Департамент ережесі', meta: `${now()} · v${v}.0` });
  save();
  res.json({ version: v });
});

app.get('/api/documents/me', need('doc.edit'), (req, res) =>
  res.json({ text: docs.get(req.user.email) || '', version: versions.get(req.user.email) || 0 }));

// ---------- Templates ----------
const canSee = (u, t) => t.access === 'public' || PERMS[u.role].includes('template.read.employee');
const findTpl = (req, res) => {
  const t = templates.find(x => x.id === Number(req.params.id));
  if (!t) { res.status(404).json({ error: '404: Үлгі табылмады' }); return null; }
  if (!canSee(req.user, t)) { res.status(403).json({ error: '403 Forbidden: бұл үлгі тек қызметкерлерге қолжетімді' }); return null; }
  return t;
};
app.get('/api/templates', need('template.read.public'), (req, res) =>
  res.json(templates.map(t => canSee(req.user, t) ? t : { id: t.id, title: t.title, desc: t.desc, access: t.access, owner: t.owner, locked: true })));
app.get('/api/templates/:id', need('template.read.public'), (req, res) => { const t = findTpl(req, res); if (t) res.json(t); });
app.post('/api/templates/:id/use', need('template.read.public'), (req, res) => {
  const t = findTpl(req, res); if (!t) return;
  log.push({ owner: req.user.email, type: 'Үлгі', tone: 'violet', title: t.title, meta: `${now()} · редакторда ашылды` });
  save(); res.json(t);
});
app.post('/api/templates', need('template.write'), (req, res) => {
  const { title = '', desc = '', body = '', access = 'public' } = req.body;
  if (title.trim().length < 3) return res.status(400).json({ error: 'Атауы кемінде 3 таңба болуы керек' });
  if (!body.trim()) return res.status(400).json({ error: 'Үлгі мәтіні бос' });
  if (!['public', 'employee'].includes(access)) return res.status(400).json({ error: 'Қолжетімділік түрі қате' });
  const t = { id: Math.max(0, ...templates.map(x => x.id)) + 1, title: title.trim(), desc: desc.trim(), access, owner: req.user.email, body };
  templates.push(t);
  log.push({ owner: req.user.email, type: 'Үлгі', tone: 'violet', title: t.title, meta: `${now()} · жаңа үлгі қосылды` });
  save(); res.status(201).json(t);
});
app.delete('/api/templates/:id', need('template.write'), (req, res) => {
  const t = templates.find(x => x.id === Number(req.params.id));
  if (!t) return res.status(404).json({ error: '404: Үлгі табылмады' });
  if (req.user.role !== 'admin' && t.owner !== req.user.email) return res.status(403).json({ error: '403 Forbidden: тек өз үлгіңізді жоя аласыз' });
  templates = templates.filter(x => x !== t);
  save(); res.json({ ok: true });
});

app.get('/api/history', need('history.read.own'), (req, res) =>
  res.json(log.filter(r => r.owner === req.user.email).reverse()));

// ---------- Users (admin) ----------
app.get('/api/users', need('user.manage'), (req, res) => res.json(users.map(pub)));

app.patch('/api/users/:email/role', need('user.manage'), (req, res) => {
  const { role } = req.body;
  if (!['user', 'employee', 'admin'].includes(role)) return res.status(400).json({ error: 'Рөл қате' });
  if (req.params.email === req.user.email) return res.status(400).json({ error: 'Өз рөліңізді өзгертуге болмайды' });
  const u = users.find(x => x.email === req.params.email);
  if (!u) return res.status(404).json({ error: '404: Пайдаланушы табылмады' });
  u.role = role;
  save();
  res.json(pub(u));
});

app.listen(PORT, () => console.log(`http://localhost:${PORT}`));
