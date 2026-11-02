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
  (d.docs || []).forEach(([k, v]) => docs.set(k, typeof v === 'string' ? [{ id: 1, title: 'Құжат', text: v, version: versions.get(k) || 1, updated: now() }] : v));
  if (d.templates) templates = d.templates;
  (d.sessions || []).forEach(([k, v]) => sessions.set(k, v));
} catch {}
const save = () => { // атомдық жазу: алдымен уақытша файл, содан кейін rename
  const tmp = DB + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify({ users, log, nextId, analyses: [...analyses], versions: [...versions], docs: [...docs], templates, sessions: [...sessions] }));
  fs.renameSync(tmp, DB);
};

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
  save();
  res.status(201).json({ token, user: pub(u) });
});

const fails = new Map(); // email -> { n, t }: сәтсіз кіру әрекеттерін шектеу
app.post('/api/auth/login', (req, res) => {
  const { email = '', password = '' } = req.body;
  const key = email.trim().toLowerCase(), f = fails.get(key) || { n: 0, t: 0 };
  if (f.n >= 5 && Date.now() - f.t < 60000) return res.status(429).json({ error: '429: Тым көп сәтсіз әрекет. 1 минуттан кейін қайталаңыз' });
  const u = users.find(x => x.email === email.trim().toLowerCase());
  const ok = u && crypto.timingSafeEqual(Buffer.from(hash(password, u.salt)), Buffer.from(u.hash));
  if (!ok) { fails.set(key, { n: (Date.now() - f.t < 60000 ? f.n : 0) + 1, t: Date.now() }); return res.status(401).json({ error: '401: Email немесе құпиясөз қате' }); }
  fails.delete(key);
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, u.email);
  save();
  res.json({ token, user: pub(u) });
});

app.post('/api/auth/logout', (req, res) => {
  sessions.delete((req.headers.authorization || '').replace('Bearer ', ''));
  save(); res.json({ ok: true });
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
// ---------- Documents (әр пайдаланушының бірнеше құжаты) ----------
const myDocs = email => docs.get(email) || [];
app.get('/api/documents', need('doc.edit'), (req, res) =>
  res.json(myDocs(req.user.email).map(({ id, title, version, updated }) => ({ id, title, version, updated })).reverse()));
app.get('/api/documents/me', need('doc.edit'), (req, res) => { // ескі нұсқамен үйлесімділік: соңғы құжат
  const l = myDocs(req.user.email).slice(-1)[0];
  res.json(l ? { id: l.id, text: l.text, version: l.version } : { text: '', version: 0 });
});
app.get('/api/documents/:id', need('doc.edit'), (req, res) => {
  const d = myDocs(req.user.email).find(x => x.id === Number(req.params.id));
  if (!d) return res.status(404).json({ error: '404: Құжат табылмады' });
  res.json(d);
});
app.post('/api/documents', need('doc.edit'), (req, res) => {
  const { id, title = '', text = '' } = req.body;
  if (!title.trim() || title.length > 120) return res.status(400).json({ error: 'Құжат атауын енгізіңіз (макс. 120 таңба)' });
  if (!String(text).trim()) return res.status(400).json({ error: 'Құжат мәтіні бос' });
  if (text.length > 200000) return res.status(413).json({ error: 'Құжат тым үлкен' });
  const list = [...myDocs(req.user.email)];
  let d = id ? list.find(x => x.id === Number(id)) : null;
  if (id && !d) return res.status(404).json({ error: '404: Құжат табылмады' });
  if (d) { d.title = title.trim(); d.text = text; d.version += 1; d.updated = now(); }
  else { d = { id: Math.max(0, ...list.map(x => x.id)) + 1, title: title.trim(), text, version: 1, updated: now() }; list.push(d); }
  docs.set(req.user.email, list);
  log.push({ owner: req.user.email, type: 'Редактор', tone: 'green', title: d.title, meta: `${now()} · v${d.version}.0` });
  save();
  res.json({ id: d.id, version: d.version });
});
app.delete('/api/documents/:id', need('doc.edit'), (req, res) => {
  const list = myDocs(req.user.email);
  if (!list.some(x => x.id === Number(req.params.id))) return res.status(404).json({ error: '404: Құжат табылмады' });
  docs.set(req.user.email, list.filter(x => x.id !== Number(req.params.id)));
  save(); res.json({ ok: true });
});
// ---------- Templates ----------
const canSee = (u, t) => t.access === 'public' || PERMS[u.role].includes('template.read.employee');
const findTpl = (req, res) => {
  const t = templates.find(x => x.id === Number(req.params.id));
  if (!t) { res.status(404).json({ error: '404: Үлгі табылмады' }); return null; }
  if (!canSee(req.user, t)) { res.status(403).json({ error: '403 Forbidden: бұл үлгі тек қызметкерлерге қолжетімді' }); return null; }
  return t;
};

app.listen(PORT, () => console.log(`http://localhost:${PORT}`));
