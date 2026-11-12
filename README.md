# KT құжаттар платформасы

Жеке пайдаланушылар мен компанияларға мәтіндік құжаттарды және PDF/DOCX-тен алынған мәтінді сақтау, нұсқалау, салыстыру және рұқсатпен бөлісуге арналған Next.js қолданбасы. Компанияға арналған жұмыс кеңістігі жеке кабинеттен бөлек ашылады.

Жаңа интерфейс, профиль және PDF/DOCX қолдауы: [workspace guide](docs/workspace-guide.md).

Өнім талаптары мен қалған іске асыру жұмыстары: [docs/platform-requirements.md](docs/platform-requirements.md). Өндірістік іске қосу, email adapter, дерек сақтау, backup және restore нұсқаулығы: [docs/operations.md](docs/operations.md).

## Іске қосу

Node.js 22.5 немесе жаңарақ нұсқа қажет.

```bash
npm ci --include=dev
npm run dev
```

Өндірістік құрастыру мен сервер:

```bash
npm run build
npm start
```

Dev және production құрастырулары Turbopack қолданады. Tailwind стильдері
бұрынғы `@tailwindcss/turbopack` loader арқылы жиналады.

Жаңартудан кейін dev серверді `Ctrl+C` арқылы тоқтатып, жоба папкасында
төмендегі командаларды орындаңыз. Бұл Windows PowerShell үшін де жарайды:

```bash
git pull
npm ci --include=dev
npm run dev
```

Браузерде `http://localhost:3000` ашыңыз. Қате сақталса, серверді тоқтатып,
`.next` құрастыру кэшін өшіріп, қайта іске қосыңыз:

```bash
node -e "require('node:fs').rmSync('.next', { recursive: true, force: true })"
npm run dev
```

Басқа ноутбукте де тәуелділіктерді сол компьютерде орнатып, серверді сол жерде
іске қосу керек. `localhost` әрқашан браузер ашылған компьютерді білдіреді.
`npm run dev` жұмыс істейтін терминалды ашық қалдырып, `Ready` хабарламасын күтіңіз.

`ERR_CONNECTION_REFUSED` болса, сервер жауап бермей тұр. Егер терминалда
`Another next dev server is already running` және PID көрсетілсе, алдымен бұрынғы
серверді оның терминалында `Ctrl+C` арқылы тоқтатыңыз. Windows-та ол терминал
табылмаса, қате хабарламасында берілген `taskkill /PID … /F` командасын көрсетілген
нақты PID-пен орындаңыз. Содан кейін кэшті тазалау және іске қосу командаларын
қайталаңыз. `npm run dev -- --port 3000` портты нақты белгілейді.

## Негізгі API

- `POST /api/auth/register`, `POST /api/auth/verify`, `POST /api/auth/verify/resend`
- `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- `POST /api/auth/password-reset`, `POST /api/auth/password-reset/confirm`
- `GET/POST /api/auth/sessions` — белсенді сессияларды қарау және ағымдағы сессиядан басқасын тоқтату
- `GET/POST /api/workspaces`, `/api/workspaces/:id/members`, `/api/workspaces/:id/invitations`, `/api/workspaces/:id/audit`
- `GET/POST /api/documents`, `/api/documents/:id`, `/api/documents/:id/shares`, `/api/documents/:id/comments`
- `POST /api/analysis/run`; салыстыру қазіргі кодтағы deterministic мәтіндік эвристикаға сүйенеді, сыртқы ЖИ моделін пайдаланбайды.

Маршруттардың рұқсатын сервер қайта тексереді. Компания әкімшісі мүшелік пен рөлді басқарады, бірақ құжат иесі оны бөлек бөліспесе компания мазмұнын автоматты көрмейді.

## Сақтау және email

SQLite файлы әдепкіде `.data/agent.sqlite` ішінде сақталады. Бұрыннан бар `agent.json` алғашқы іске қосылғанда бір рет импортталады және түпнұсқасы өшірілмейді. Бірнеше API жазбасы SQLite транзакциясында орындалады. Backup/restore командалары [operations нұсқаулығында](docs/operations.md) берілген.

Өндірістік ортада email растау мен құпиясөзді қайта орнату үшін `KT_EMAIL_DELIVERY_URL` және `KT_EMAIL_DELIVERY_TOKEN` керек. Email жеткізу қызметіне жіберілетін JSON пішімі мен қауіпсіздік талаптары operations құжатында сипатталған. `KT_EMAIL_DEV_TOKENS=1` тек тест ортасына арналған.

## Тексеру командалары

```bash
npx tsc --noEmit
npm run lint
npm run test:documents
npm run test:store
npm run test:ui
```

## Іске асу шегі

Қазіргі құжат сақтау қабаты транзакциялық, бірақ домен объектілері әлі бір JSON payload ішінде; толық нормаланған multi-tenant схема жасалмаған. MFA/SSO/SCIM, топтар, бекіту маршруттары, upload сканері, retention және provider-интеграциялары толық іске асқан деп саналмайды. Нақты күй мен басымдықтар талаптар құжатында көрсетілген.
