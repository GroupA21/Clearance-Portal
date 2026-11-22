// Graduation Clearance Portal – Vercel serverless API using Supabase (Postgres + Storage). No npm dependencies.
const crypto = require('crypto');

const SB_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
const ADMIN_ID = 'ADMIN';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'GroupA21';
const SECRET = process.env.SECRET || crypto.createHash('sha256').update('ugc-a21|' + ADMIN_PASSWORD).digest('hex');

const UNITS = ['dept', 'faculty', 'library', 'bursary', 'affairs', 'admission', 'sports'];
const FILE_KEYS = ['dept', 'faculty', 'fees', 'levy', 'alumni', 'other', 'adm', 'pass', 'id'];
const REQUIRED_FILES = ['fees', 'levy', 'alumni', 'pass', 'id'];
const MATRIC = /^(?!ADMIN$)[A-Z0-9]{4,12}$/;
const MAX_FILE_B64 = 4.2 * 1024 * 1024;   // ≈ 3 MB file (Vercel request limit is 4.5 MB)
const SEED = [
  ['E056116', 'OLANIYAN TAOFEEQ'], ['E055992', 'ADENIJI ISRAEL TOMIWA'], ['E053971', 'ODEDIRAN AMOS OLUWATIMILEHIN'],
  ['E055198', 'SOLOMON SUCCESS OSAREMEN'], ['E053243', 'ADEKOYA ADEMOLA'], ['E053433', 'ODIASE TEGUOLO AMANDA']
];

// ---------- Supabase REST ----------
const enc = encodeURIComponent;
const H = extra => Object.assign({ apikey: SB_KEY }, SB_KEY.startsWith('eyJ') ? { Authorization: 'Bearer ' + SB_KEY } : {}, extra);
async function db(method, table, { q = '', body, prefer } = {}) {
  const r = await fetch(`${SB_URL}/rest/v1/${table}${q ? '?' + q : ''}`, {
    method, headers: H(Object.assign({ 'Content-Type': 'application/json' }, prefer ? { Prefer: prefer } : {})),
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch {}
  if (!r.ok) { const e = new Error('Database error: ' + ((j && j.message) || r.status)); e.pg = j && j.code; throw e; }
  return j;
}
const objUrl = (id, k) => `${SB_URL}/storage/v1/object/documents/${enc(id)}/${k}`;
let seeded = false;
async function ensureSeed() {
  if (seeded) return;
  await db('POST', 'students', { q: 'on_conflict=matric', prefer: 'resolution=ignore-duplicates,return=minimal',
    body: SEED.map(([m, n]) => ({ matric: m, name: n, faculty: 'Science', dept: 'Computer Science', level: 'Final Year (400 Level)', seed: true })) });
  seeded = true;
}
const toStu = r => ({ name: r.name, faculty: r.faculty, dept: r.dept, level: r.level, seed: !!r.seed });
const getStudent = async id => { const r = await db('GET', 'students', { q: `select=*&matric=eq.${enc(id)}` }); return r.length ? toStu(r[0]) : null; };
function toApp(r, files) {
  const names = {}, meta = {}; (files || []).forEach(f => { names[f.doc_key] = f.name; meta[f.doc_key] = { type: f.type, size: f.size }; });
  return { data: Object.assign({}, r.data, { files: names }), fileMeta: meta, units: r.units, submittedAt: r.submitted_at, approvedAt: r.approved_at };
}
async function getApp(id, withFiles = true) {
  const r = await db('GET', 'apps', { q: `select=*&matric=eq.${enc(id)}` }); if (!r.length) return null;
  const f = withFiles ? await db('GET', 'files', { q: `select=*&matric=eq.${enc(id)}` }) : [];
  return toApp(r[0], f);
}
const getSettings = async () => { const r = await db('GET', 'settings', { q: 'select=*&id=eq.1' }); return { strict: !!(r[0] && r[0].strict) }; };

// ---------- helpers ----------
const sha = s => crypto.createHash('sha256').update(s).digest();
const safeEq = (a, b) => crypto.timingSafeEqual(sha(String(a)), sha(String(b)));
const b64u = b => Buffer.from(b).toString('base64url');
const sign = p => { const x = b64u(JSON.stringify(p)); return x + '.' + crypto.createHmac('sha256', SECRET).update(x).digest('base64url'); };
function verify(tok) {
  if (!tok || typeof tok !== 'string') return null;
  const [p, s] = tok.split('.'); if (!p || !s) return null;
  const good = crypto.createHmac('sha256', SECRET).update(p).digest('base64url');
  if (s.length !== good.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(good))) return null;
  try { const d = JSON.parse(Buffer.from(p, 'base64url').toString()); return d.exp > Date.now() ? d : null; } catch { return null; }
}
const auth = (req, role) => { const d = verify((req.headers.authorization || '').replace(/^Bearer /, '')); return d && d.r === role ? d : null; };
const tokenFor = (r, id) => sign({ r, id, exp: Date.now() + 12 * 3600 * 1000 });
const clean = (v, max = 120) => String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max);
const surname = s => s.name.split(' ')[0].toLowerCase();
function overall(app) {
  if (!app) return 'none';
  const v = UNITS.map(u => app.units[u].status);
  if (v.every(s => s === 'approved')) return 'cleared';
  if (v.includes('rejected')) return 'rejected';
  return 'pending';
}
class HttpError extends Error { constructor(code, msg) { super(msg); this.code = code; } }
const fail = (code, msg) => { throw new HttpError(code, msg); };
async function limited(req, bucket, max, sec) {
  const ip = ((req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || 'x';
  return (await db('POST', 'rpc/incr_rate', { body: { p_key: `${bucket}:${ip}`, p_sec: sec } })) > max;
}
async function body(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body || '{}'); } catch { fail(400, 'Bad request.'); } }
  const chunks = []; for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString() || '{}'); } catch { fail(400, 'Bad request.'); }
}
const saveApp = (id, a) => db('POST', 'apps', { q: 'on_conflict=matric', prefer: 'resolution=merge-duplicates,return=minimal',
  body: { matric: id, data: a.data, units: a.units, submitted_at: a.submittedAt, approved_at: a.approvedAt } });

// ---------- routes ----------
async function route(req, res, p, q) {
  const m = req.method;
  const json = (o, c = 200) => { res.statusCode = c; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(o)); };
  if (!SB_URL || !SB_KEY) fail(500, 'Database not connected yet. Add the Supabase URL and service key to this Vercel project (see README).');
  await ensureSeed();

  if (p === 'login' && m === 'POST') {
    if (await limited(req, 'login', 30, 300)) fail(429, 'Too many attempts. Try again in a few minutes.');
    const b = await body(req), id = clean(b.matric, 20).toUpperCase(), pw = clean(b.password, 60).toLowerCase();
    const s = await getStudent(id);
    if (!s) {
      if ((await getSettings()).strict) fail(404, 'Matriculation number not found in student records. Contact your department.');
      if (!MATRIC.test(id)) fail(400, 'Enter a valid matriculation number (letters and digits only, e.g. E056116).');
      return json({ needsSetup: true });
    }
    if (pw !== surname(s)) fail(401, 'Invalid matriculation number or password.');
    return json({ token: tokenFor('student', id) });
  }

  if (p === 'setup' && m === 'POST') {
    if (await limited(req, 'setup', 20, 600)) fail(429, 'Too many attempts. Try again later.');
    const b = await body(req), id = clean(b.matric, 20).toUpperCase(), pw = clean(b.password, 60).toLowerCase();
    if ((await getSettings()).strict) fail(403, 'Registration is closed. Contact your department.');
    if (!MATRIC.test(id)) fail(400, 'Invalid or already registered matriculation number.');
    const name = clean(b.name, 80).replace(/\s+/g, ' ').toUpperCase();
    if (!name || !clean(b.faculty) || !clean(b.dept) || !clean(b.level)) fail(400, 'Please fill in all fields.');
    if (name.split(' ')[0].toLowerCase() !== pw) fail(400, 'Password must be your surname (the first name written above).');
    try { await db('POST', 'students', { prefer: 'return=minimal', body: { matric: id, name, faculty: clean(b.faculty), dept: clean(b.dept), level: clean(b.level), seed: false } }); }
    catch (e) { if (e.pg === '23505') fail(400, 'Invalid or already registered matriculation number.'); throw e; }
    return json({ token: tokenFor('student', id) });
  }

  if (p === 'admin/login' && m === 'POST') {
    if (await limited(req, 'admin', 5, 60)) fail(429, 'Too many attempts. Try again in a minute.');
    const b = await body(req);
    if (safeEq(clean(b.id, 20).toUpperCase(), ADMIN_ID) & safeEq(String(b.password || ''), ADMIN_PASSWORD)) return json({ token: tokenFor('admin', ADMIN_ID) });
    fail(401, 'Invalid admin ID or password.');
  }

  // ----- student -----
  if (p === 'me' && m === 'GET') {
    const a = auth(req, 'student'), s = a && await getStudent(a.id); if (!s) fail(401, 'Please log in.');
    return json({ student: s, app: await getApp(a.id) });
  }

  if (p === 'upload' && m === 'POST') {
    const a = auth(req, 'student'), s = a && await getStudent(a.id); if (!s) fail(401, 'Please log in.');
    const st = overall(await getApp(a.id, false)); if (st === 'pending' || st === 'cleared') fail(409, 'Your request is already submitted.');
    const b = await body(req), k = b.key, f = String(b.b64 || '');
    if (!FILE_KEYS.includes(k)) fail(400, 'Invalid document type.');
    if (!f.length || f.length > MAX_FILE_B64) fail(400, `"${clean(b.name, 60)}" is empty or larger than 3 MB. Use a smaller file.`);
    const buf = Buffer.from(f, 'base64');
    const r = await fetch(objUrl(a.id, k), { method: 'POST', headers: H({ 'Content-Type': 'application/octet-stream', 'x-upsert': 'true' }), body: buf });
    if (!r.ok) fail(500, 'File storage error. Check that the "documents" bucket exists (run supabase.sql).');
    await db('POST', 'files', { q: 'on_conflict=matric,doc_key', prefer: 'resolution=merge-duplicates,return=minimal',
      body: { matric: a.id, doc_key: k, name: clean(b.name, 100) || k, type: clean(b.type, 60), size: buf.length } });
    return json({ ok: true });
  }

  if (p === 'apply' && m === 'POST') {
    const a = auth(req, 'student'), s = a && await getStudent(a.id); if (!s) fail(401, 'Please log in.');
    const id = a.id, old = await getApp(id, false), st = overall(old);
    if (st === 'pending' || st === 'cleared') fail(409, 'Your request is already submitted.');
    const d = (await body(req)).data || {};
    const data = { phone: clean(d.phone, 20), email: clean(d.email, 100), project: clean(d.project, 200), supervisor: clean(d.supervisor, 100), libcard: clean(d.libcard, 40), hostel: clean(d.hostel, 80) };
    if (!/^[0-9+ ]{10,15}$/.test(data.phone)) fail(400, 'Enter a valid phone number.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email)) fail(400, 'Enter a valid email address.');
    if (!data.project || !data.supervisor) fail(400, 'Project title and supervisor are required.');
    const have = (await db('GET', 'files', { q: `select=doc_key&matric=eq.${enc(id)}` })).map(x => x.doc_key);
    for (const k of REQUIRED_FILES) if (!have.includes(k)) fail(400, 'Please upload all required documents (receipts, passport photo, school ID).');
    const units = old ? old.units : {};
    UNITS.forEach(u => { if (!units[u] || units[u].status === 'rejected') units[u] = { status: 'pending', reason: '' }; });
    await saveApp(id, { data, units, submittedAt: new Date().toISOString(), approvedAt: null });
    return json({ ok: true });
  }

  // ----- admin -----
  if (p.startsWith('admin/')) {
    if (!auth(req, 'admin')) fail(401, 'Admin login required.');
    if (p === 'admin/data' && m === 'GET') {
      const [st, ap, fl, se] = await Promise.all([db('GET', 'students', { q: 'select=*' }), db('GET', 'apps', { q: 'select=*' }), db('GET', 'files', { q: 'select=*' }), getSettings()]);
      const students = {}; st.forEach(r => students[r.matric] = toStu(r));
      const apps = {}; ap.forEach(r => apps[r.matric] = toApp(r, fl.filter(f => f.matric === r.matric)));
      return json({ students, apps, settings: se });
    }
    if (p === 'admin/file' && m === 'GET') {
      const id = q.get('id') || '', k = q.get('key');
      if (!/^[A-Z0-9]+$/.test(id) || !FILE_KEYS.includes(k)) fail(404, 'File not found.');
      const fm = await db('GET', 'files', { q: `select=*&matric=eq.${enc(id)}&doc_key=eq.${k}` }); if (!fm.length) fail(404, 'File not found.');
      const r = await fetch(objUrl(id, k), { headers: H() }); if (!r.ok) fail(404, 'File not found.');
      const buf = Buffer.from(await r.arrayBuffer()), t = fm[0].type || '';
      const ok = /^image\/(png|jpe?g|gif|webp)$/.test(t) || t === 'application/pdf';
      res.statusCode = 200; res.setHeader('Content-Type', ok ? t : 'application/octet-stream');
      res.setHeader('Content-Disposition', ok ? 'inline' : 'attachment'); res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Cache-Control', 'no-store');
      return res.end(buf);
    }
    const b = m === 'POST' ? await body(req) : {};
    if (p === 'admin/unit' && m === 'POST') {
      const app = await getApp(String(b.id || ''), false);
      if (!app || !UNITS.includes(b.unit) || !['approved', 'rejected', 'pending'].includes(b.status)) fail(400, 'Invalid request.');
      app.units[b.unit] = { status: b.status, reason: b.status === 'rejected' ? clean(b.reason, 200) || 'Rejected – please update your record.' : '' };
      if (overall(app) === 'cleared') { if (!app.approvedAt) app.approvedAt = new Date().toISOString(); } else app.approvedAt = null;
      await db('PATCH', 'apps', { q: `matric=eq.${enc(b.id)}`, prefer: 'return=minimal', body: { units: app.units, approved_at: app.approvedAt } });
      return json({ ok: true });
    }
    if (p === 'admin/approve-all' && m === 'POST') {
      const app = await getApp(String(b.id || ''), false); if (!app) fail(404, 'Not found.');
      UNITS.forEach(u => app.units[u] = { status: 'approved', reason: '' });
      await db('PATCH', 'apps', { q: `matric=eq.${enc(b.id)}`, prefer: 'return=minimal', body: { units: app.units, approved_at: new Date().toISOString() } });
      return json({ ok: true });
    }
    if (p === 'admin/settings' && m === 'POST') { await db('PATCH', 'settings', { q: 'id=eq.1', prefer: 'return=minimal', body: { strict: !!b.strict } }); return json({ ok: true }); }
    if (p === 'admin/students' && m === 'POST') {
      let skipped = 0; const rows = [];
      String(b.csv || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean).forEach(l => {
        const c = l.split(/[,\t;]/).map(x => clean(x)), id = (c[0] || '').toUpperCase();
        if (id.includes('MATRIC')) return;
        if (!MATRIC.test(id) || !c[1]) { skipped++; return; }
        rows.push({ matric: id, name: c[1].replace(/\s+/g, ' ').toUpperCase(), faculty: c[2] || 'Science', dept: c[3] || 'Computer Science', level: c[4] || 'Final Year (400 Level)' });
      });
      if (rows.length) await db('POST', 'students', { q: 'on_conflict=matric', prefer: 'resolution=merge-duplicates,return=minimal', body: rows });
      return json({ added: rows.length, skipped });
    }
    if (p === 'admin/clear-students' && m === 'POST') {
      const ids = (await db('GET', 'apps', { q: 'select=matric' })).map(x => x.matric);
      const keep = ids.length ? `&matric=not.in.(${ids.map(enc).join(',')})` : '';
      await db('DELETE', 'students', { q: `seed=eq.false${keep}`, prefer: 'return=minimal' });
      return json({ ok: true });
    }
    if (p === 'admin/reset' && m === 'POST') {
      const files = await db('GET', 'files', { q: 'select=matric,doc_key' });
      for (let i = 0; i < files.length; i += 100) {
        await fetch(`${SB_URL}/storage/v1/object/documents`, { method: 'DELETE', headers: H({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ prefixes: files.slice(i, i + 100).map(f => `${f.matric}/${f.doc_key}`) }) });
      }
      await db('DELETE', 'files', { q: 'matric=not.is.null', prefer: 'return=minimal' });
      await db('DELETE', 'apps', { q: 'matric=not.is.null', prefer: 'return=minimal' });
      return json({ ok: true });
    }
  }
  fail(404, 'Not found.');
}

module.exports = async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('X-Frame-Options', 'DENY');
  const url = new URL(req.url, 'http://x');
  const p = (url.searchParams.get('path') ?? url.pathname.replace(/^\/api\/?/, '')).replace(/^\/+|\/+$/g, '').replace(/^index$/, '');
  try { await route(req, res, p, url.searchParams); }
  catch (e) {
    if (res.writableEnded) return;
    const code = e instanceof HttpError ? e.code : 500;
    res.statusCode = code; res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: e instanceof HttpError ? e.message : 'Server error. ' + (e.message || '') }));
  }
};
  
