/* =====================================================================
   PROJECT HUB DATA CLIENT — server when available, browser storage otherwise.
   All schedule and commercial maths runs in the browser on these records.
   ===================================================================== */
const HUB_LOCAL = 'cgi-hub-v11-local', HUB_TOKEN = 'cgi-hub-token';
const PH = { mode: 'loading', project: { id: 1, ...(PROJECT_SEED.project || {}) }, rec: Object.fromEntries(Object.keys(ENTITIES).map(k => [k, []])), files: [], settings: null, error: null };
const isoToday = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
const D0 = s => { if (!s) return null; const d = new Date(String(s).slice(0, 10) + 'T00:00:00'); return isNaN(d) ? null : d; };
const iso = d => d ? new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10) : null;
const daysBetween = (a, b) => Math.round((D0(b) - D0(a)) / 864e5);
const isWork = d => d.getDay() !== 0 && d.getDay() !== 6;
function addWork(s, n) { const d = D0(s); if (!d) return null; let k = Math.round(n || 0); while (!isWork(d)) d.setDate(d.getDate() + 1); while (k > 0) { d.setDate(d.getDate() + 1); if (isWork(d)) k--; } return iso(d); }
const nextWork = s => { const d = D0(s); d.setDate(d.getDate() + 1); while (!isWork(d)) d.setDate(d.getDate() + 1); return iso(d); };
const isClosed = (ent, r) => Object.entries(ENTITIES[ent].closed || {}).some(([f, v]) => v.includes(r[f]));
const titleOf = (ent, r) => r ? (r[ENTITIES[ent].title] ?? r.title ?? r.name ?? `#${r.id}`) : '—';
const byId = (ent, id) => PH.rec[ent].find(r => String(r.id) === String(id));

function localSeed() {
  const rec = Object.fromEntries(Object.keys(ENTITIES).map(k => [k, []])); let id = 1;
  const add = (k, d) => { const r = { id: id++, source: 'seed', created_at: new Date().toISOString(), ...d }; rec[k].push(r); return r; };
  for (const g of REQS.groups) for (const it of g.items) add('requirements', { ref: it.id.toUpperCase(), area: it.area, text: it.text, source: it.source, status: 'Open' });
  REQS.deliverables.forEach((t, i) => add('deliverables', { ref: `DEL-${String(i + 1).padStart(3, '0')}`, title: t, status: 'Outstanding' }));
  (REGISTER.actions || []).forEach(a => add('actions', { title: a.text, status: a.done ? 'Closed' : 'Open', priority: 'High', source: 'RF Lab' }));
  add('rfis', { ref: 'RFI-001', title: 'Definition of 200–300 Mbps', question: REQS.openQuestion, raised_to: 'WUC', status: 'Draft' });
  (PROJECT_SEED.cost_codes || []).forEach(c => add('cost_codes', c));
  const sup = {}; (PROJECT_SEED.suppliers || []).forEach(s => { sup[s.name] = add('suppliers', s).id; });
  for (const q of PROJECT_SEED.supplier_quotes || []) {
    const { lines, supplier, key, ...rest } = q; const qr = add('supplier_quotes', { ...rest, supplier_id: sup[supplier] });
    for (const [part_number, description, quantity, unit_price, discount_pct, cost_code] of lines) add('quote_lines', { quote_id: qr.id, part_number, description, quantity, unit_price, discount_pct, cost_code });
  }
  for (const [wbs, title, duration_days, predecessors, ms] of PROJECT_SEED.tasks || []) add('tasks', { wbs, title, duration_days, predecessors, is_milestone: ms, progress: 0 });
  return { rec, nextId: id, project: { id: 1, ...(PROJECT_SEED.project || {}) } };
}
function loadLocal() {
  let s = null; try { s = JSON.parse(localStorage.getItem(HUB_LOCAL) || 'null'); } catch (e) {}
  if (!s || !s.rec) s = localSeed();
  for (const k of Object.keys(ENTITIES)) s.rec[k] = s.rec[k] || [];
  PH.rec = s.rec; PH.project = s.project; PH.nextId = s.nextId;
}
const saveLocal = () => { if (PH.mode !== 'local') return; try { localStorage.setItem(HUB_LOCAL, JSON.stringify({ rec: PH.rec, project: PH.project, nextId: PH.nextId })); } catch (e) {} };
function coerce(ent, data) {
  const out = {};
  for (const f of ENTITIES[ent].fields) { if (!(f.k in data)) continue; let v = data[f.k];
    if (v === '' || v == null) { out[f.k] = null; continue; }
    if (['number', 'money', 'pct'].includes(f.t)) { v = parseFloat(String(v).replace(/[\sR,%]/g, '')); if (!isFinite(v)) throw new Error(`${f.label}: not a number`); }
    else if (f.t === 'bool') v = v === true || v === 1 || v === '1' || v === 'on' ? 1 : 0;
    else if (f.t === 'ref') v = +v;
    out[f.k] = v; }
  return out;
}

const API = {
  pid: 1,
  async req(path, opts = {}, raw = false) {
    const tok = localStorage.getItem(HUB_TOKEN) || '';
    const r = await fetch(path, { ...opts, headers: { ...(raw ? {} : { 'Content-Type': 'application/json' }), ...(tok ? { 'X-Hub-Token': tok } : {}), ...(opts.headers || {}) } });
    if (r.status === 401) { const t = prompt('This hub needs its access token (HUB_TOKEN in the server settings):'); if (t) { localStorage.setItem(HUB_TOKEN, t); return this.req(path, opts, raw); } }
    const body = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(body.error || `${r.status} ${r.statusText}`);
    return body;
  },
  async init() {
    try {
      const health = await this.req('/api/health'); const projects = await this.req('/api/projects');
      this.pid = projects[0].id; const all = await this.req(`/api/projects/${this.pid}/all`);
      Object.assign(PH, { mode: 'server', project: all.project, rec: all.records, files: all.files, settings: health.settings, server: health, error: null });
    } catch (e) { PH.mode = 'local'; PH.error = String(e.message || e); loadLocal(); }
    return PH;
  },
  async create(ent, data) {
    let r; if (PH.mode === 'server') r = await this.req(`/api/projects/${this.pid}/r/${ent}`, { method: 'POST', body: JSON.stringify(data) });
    else { for (const f of ENTITIES[ent].fields) if (f.req && (data[f.k] == null || data[f.k] === '')) throw new Error(`${f.label} is required`);
      r = { id: PH.nextId++, source: 'manual', created_at: new Date().toISOString(), ...Object.fromEntries(ENTITIES[ent].fields.filter(f => 'default' in f).map(f => [f.k, f.default])), ...coerce(ent, data) }; }
    PH.rec[ent].push(r); saveLocal(); return r;
  },
  async update(ent, id, data) {
    let r; if (PH.mode === 'server') r = await this.req(`/api/projects/${this.pid}/r/${ent}/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
    else r = { ...byId(ent, id), ...coerce(ent, data), updated_at: new Date().toISOString() };
    const i = PH.rec[ent].findIndex(x => String(x.id) === String(id)); if (i >= 0) PH.rec[ent][i] = r; saveLocal(); return r;
  },
  async remove(ent, id) {
    if (PH.mode === 'server') await this.req(`/api/projects/${this.pid}/r/${ent}/${id}`, { method: 'DELETE' });
    PH.rec[ent] = PH.rec[ent].filter(x => String(x.id) !== String(id)); saveLocal();
  },
  async bulk(ent, items) {
    if (!items.length) return [];
    if (PH.mode === 'server') { const rs = await this.req(`/api/projects/${this.pid}/bulk/${ent}`, { method: 'POST', body: JSON.stringify({ items }) }); for (const r of rs) { const i = PH.rec[ent].findIndex(x => x.id === r.id); if (i >= 0) PH.rec[ent][i] = r; } return rs; }
    for (const it of items) { const r = byId(ent, it.id); Object.assign(r, coerce(ent, it)); } saveLocal(); return items;
  },
  async patchProject(d) { if (PH.mode === 'server') PH.project = await this.req(`/api/projects/${this.pid}`, { method: 'PATCH', body: JSON.stringify(d) }); else { Object.assign(PH.project, d); saveLocal(); } return PH.project; },
  async upload(file, ent, id) {
    if (PH.mode !== 'server') throw new Error('Attachments need the hub server (run_all.bat).');
    const f = await this.req(`/api/projects/${this.pid}/files?name=${encodeURIComponent(file.name)}&entity=${ent || ''}&id=${id || ''}`, { method: 'POST', body: file, headers: { 'Content-Type': file.type || 'application/octet-stream' } }, true);
    PH.files.push(f); return f;
  },
  fileUrl(f) { const t = localStorage.getItem(HUB_TOKEN); return `/api/files/${f.id}${t ? '?token=' + encodeURIComponent(t) : ''}`; },
  needServer() { if (PH.mode !== 'server') throw new Error('The tracker needs the hub server. Start it with run_all.bat.'); },
  captures() { this.needServer(); return this.req(`/api/projects/${this.pid}/captures`); },
  captureText(text, kind) { this.needServer(); return this.req(`/api/projects/${this.pid}/captures`, { method: 'POST', body: JSON.stringify({ text, kind }) }); },
  captureAudio(blob, kind, note) { this.needServer(); return this.req(`/api/projects/${this.pid}/captures/audio?kind=${encodeURIComponent(kind)}&note=${encodeURIComponent(note || '')}&name=voice.${(blob.type.split('/')[1] || 'webm').split(';')[0]}`, { method: 'POST', body: blob, headers: { 'Content-Type': blob.type || 'audio/webm' } }, true); },
  retry(cid) { return this.req(`/api/projects/${this.pid}/captures/${cid}/retry`, { method: 'POST', body: '{}' }); },
  approve(id, fields) { return this.req(`/api/projects/${this.pid}/proposals/${id}/approve`, { method: 'POST', body: JSON.stringify(fields ? { fields } : {}) }); },
  reject(id) { return this.req(`/api/projects/${this.pid}/proposals/${id}/reject`, { method: 'POST', body: '{}' }); },
  summaries() { this.needServer(); return this.req(`/api/projects/${this.pid}/summaries`); },
  makeSummary(date) { this.needServer(); return this.req(`/api/projects/${this.pid}/summaries`, { method: 'POST', body: JSON.stringify({ date }) }); },
  ask(question) { this.needServer(); return this.req(`/api/projects/${this.pid}/ask`, { method: 'POST', body: JSON.stringify({ question }) }); },
  audit() { this.needServer(); return this.req(`/api/projects/${this.pid}/audit?limit=400`); },
  settings() { this.needServer(); return this.req('/api/settings'); },
  saveSettings(d) { return this.req('/api/settings', { method: 'POST', body: JSON.stringify(d) }); },
  testAI() { return this.req('/api/settings/test', { method: 'POST', body: '{}' }); },
  async refresh() { if (PH.mode !== 'server') return; const all = await this.req(`/api/projects/${this.pid}/all`); PH.rec = all.records; PH.files = all.files; PH.project = all.project; },
};
