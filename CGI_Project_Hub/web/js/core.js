/* CGI Project Hub — core: helpers, API client, state, forms, tables. */
'use strict';
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v; else if (k === 'html') e.innerHTML = v; else if (k === 'style') e.style.cssText = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'value') e.value = v; else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(9)) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
}
const svgNS = 'http://www.w3.org/2000/svg';
function S(tag, attrs, ...kids) { const e = document.createElementNS(svgNS, tag); for (const [k, v] of Object.entries(attrs || {})) if (v != null) { if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v); } for (const c of kids.flat()) if (c != null) e.append(c.nodeType ? c : document.createTextNode(String(c))); return e; }
const ICONS = {
  home: 'M3 11 12 4l9 7M5 10v10h14V10', grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z', cal: 'M4 6h16v14H4zM4 10h16M9 3v4M15 3v4',
  check: 'M4 12l5 5L20 6', list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01', gantt: 'M4 5h9M7 10h11M5 15h7M10 20h10',
  board: 'M4 4h5v16H4zM10 4h5v10h-5zM16 4h4v7h-4z', meet: 'M7 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM17 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 20c0-3 2-5 5-5s5 2 5 5M12 20c0-3 2-5 5-5s5 2 5 5',
  risk: 'M12 3 2 21h20zM12 10v5M12 18h.01', people: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21c0-4 3-7 7-7s7 3 7 7M17 11a3 3 0 1 0 0-6M22 20c0-3-2-5-4-6',
  truck: 'M2 6h11v10H2zM13 10h5l3 3v3h-8M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z', test: 'M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3',
  doc: 'M6 2h9l5 5v15H6zM14 2v6h6M9 13h8M9 17h8', tech: 'M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  money: 'M3 6h18v12H3zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 9v.01M18 15v.01', calc: 'M5 3h14v18H5zM8 7h8M8 11h2M12 11h2M16 11v6M8 15h2M12 15h2M8 18.5h6',
  folder: 'M3 6h6l2 2h10v12H3z', radio: 'M12 12v9M8 21h8M8.5 8.5a5 5 0 0 1 7 0M5.6 5.6a9 9 0 0 1 12.8 0M12 12.5a.5.5 0 1 0 0-1', spark: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6',
  log: 'M12 8v4l3 2M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5', cog: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  charter: 'M4 4h16v16H4zM8 8h8M8 12h8M8 16h5', diary: 'M5 3h12a2 2 0 0 1 2 2v16H7a2 2 0 0 1-2-2zM5 17a2 2 0 0 1 2-2h12', reg: 'M4 4h16v4H4zM4 10h16v4H4zM4 16h16v4H4z',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2', plus: 'M12 5v14M5 12h14', bulb: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z',
  download: 'M12 3v12M7 10l5 5 5-5M4 21h16', upload: 'M12 21V9M7 14l5-5 5 5M4 3h16', print: 'M6 9V3h12v6M6 18H4v-7h16v7h-2M8 14h8v7H8z', open: 'M14 3h7v7M21 3l-9 9M19 14v7H3V5h7',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3', mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3', bell: 'M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9',
};
const icon = (n, cls) => { const s = S('svg', { viewBox: '0 0 24 24', width: 16, height: 16, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', class: cls }); s.append(S('path', { d: ICONS[n] || ICONS.list })); return s; };

/* ---------------- formatting & dates ---------------- */
const money = (v, dp = 0) => (v == null || v === '' || !isFinite(+v)) ? '—' : (v < 0 ? '−' : '') + 'R\u00a0' + Math.abs(+v).toLocaleString('en-ZA', { minimumFractionDigits: dp, maximumFractionDigits: dp });
const kmoney = v => !isFinite(+v) || v == null ? '—' : Math.abs(v) >= 1e6 ? 'R\u00a0' + (v / 1e6).toFixed(2) + 'm' : Math.abs(v) >= 1e4 ? 'R\u00a0' + Math.round(v / 1e3) + 'k' : money(v);
const pct = (v, d = 0) => v == null || !isFinite(v) ? '—' : (+v).toFixed(d) + '%';
const isoToday = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
const D0 = s => { if (!s) return null; const d = new Date(String(s).slice(0, 10) + 'T00:00:00'); return isNaN(d) ? null : d; };
const iso = d => d ? new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10) : null;
const addDays = (s, n) => { const d = D0(s); if (!d) return null; d.setDate(d.getDate() + n); return iso(d); };
const daysBetween = (a, b) => Math.round((D0(b) - D0(a)) / 864e5);
const isWork = d => d.getDay() !== 0 && d.getDay() !== 6;
function addWork(s, n) { const d = D0(s); if (!d) return null; let k = Math.round(n || 0); while (!isWork(d)) d.setDate(d.getDate() + 1); while (k > 0) { d.setDate(d.getDate() + 1); if (isWork(d)) k--; } return iso(d); }
const nextWork = s => { const d = D0(s); d.setDate(d.getDate() + 1); while (!isWork(d)) d.setDate(d.getDate() + 1); return iso(d); };
const prevWork = s => { const d = D0(s); d.setDate(d.getDate() - 1); while (!isWork(d)) d.setDate(d.getDate() - 1); return iso(d); };
function subWork(s, n) { let d = s; for (let i = 0; i < n; i++) d = prevWork(d); return d; }
function workdays(a, b) { if (!a || !b) return 0; let n = 0, s = a <= b ? a : b, e = a <= b ? b : a; const d = D0(s); while (iso(d) < e) { d.setDate(d.getDate() + 1); if (isWork(d)) n++; } return a <= b ? n : -n; }
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const fdate = s => { const d = D0(s); return d ? `${String(d.getDate()).padStart(2, '0')} ${MON[d.getMonth()]} ${d.getFullYear()}` : '—'; };
const sdate = s => { const d = D0(s); return d ? `${d.getDate()} ${MON[d.getMonth()]}` : '—'; };
const ddate = s => { const d = D0(s); return d ? `${DOW[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}` : '—'; };
const relDays = s => { if (!s) return ''; const n = daysBetween(isoToday(), s); return n === 0 ? 'today' : n === 1 ? 'tomorrow' : n === -1 ? 'yesterday' : n > 0 ? `in ${n} days` : `${-n} days ago`; };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function md(s) {
  const lines = esc(s || '').split('\n'); let out = '', inList = false;
  for (const l of lines) {
    const inl = t => t.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/_(.+?)_/g, '<i>$1</i>');
    if (/^\s*[-*] /.test(l)) { if (!inList) { out += '<ul>'; inList = true; } out += `<li>${inl(l.replace(/^\s*[-*] /, ''))}</li>`; continue; }
    if (inList) { out += '</ul>'; inList = false; }
    const m = l.match(/^(#{1,3}) (.*)/); if (m) out += `<h${m[1].length + 1}>${inl(m[2])}</h${m[1].length + 1}>`; else if (l.trim()) out += `<p>${inl(l)}</p>`;
  }
  return out + (inList ? '</ul>' : '');
}
const download = (name, data, type = 'text/plain') => { const a = h('a', { href: URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type })), download: name }); document.body.append(a); a.click(); setTimeout(() => a.remove(), 100); };
function toast(msg, bad) { const t = h('div', { class: 'toast' + (bad ? ' bad' : '') }, msg); $('#toasts').append(t); setTimeout(() => t.remove(), bad ? 7000 : 2800); }
const run = fn => async (...a) => { try { return await fn(...a); } catch (e) { console.error(e); toast(e.message || String(e), true); } };

/* ---------------- API ---------------- */
const API = {
  async req(path, opts = {}, raw = false) {
    const r = await fetch(path, { ...opts, headers: { ...(raw ? {} : { 'Content-Type': 'application/json' }), ...(opts.headers || {}) } });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(body.error || `${r.status} ${r.statusText}`);
    return body;
  },
  get: p => API.req(p), post: (p, d) => API.req(p, { method: 'POST', body: JSON.stringify(d || {}) }),
  patch: (p, d) => API.req(p, { method: 'PATCH', body: JSON.stringify(d || {}) }), del: p => API.req(p, { method: 'DELETE' }),
  P: (code, rest = '') => `/api/projects/${encodeURIComponent(code)}${rest}`,
};

/* ---------------- state ---------------- */
const ST = { cfg: null, E: {}, projects: [], code: null, PH: null, route: 'portfolio', params: {}, port: null, portAt: 0 };
const E = () => ST.E;
const REC = k => (ST.PH && ST.PH.rec[k]) || [];
const ent = k => ST.E[k];
const isClosed = (k, r) => Object.entries(ent(k)?.closed || {}).some(([f, v]) => v.includes(r[f]));
const titleOf = (k, r) => r ? (r[ent(k)?.title] ?? r.title ?? r.name ?? `#${r.id}`) : '—';
const byId = (k, id, rec) => (rec ? rec[k] : REC(k)).find(r => String(r.id) === String(id));
const dueOf = (k, r) => ent(k)?.due ? r[ent(k).due] : null;
const overdue = (k, r) => { const d = dueOf(k, r); return !!d && d < isoToday() && !isClosed(k, r); };
const projColor = p => p?.colour || '#005093';

async function loadConfig() { ST.cfg = await API.get('/api/config'); ST.E = ST.cfg.entities; }
async function loadProjects() { ST.projects = await API.get('/api/projects'); return ST.projects; }
async function loadProject(code, force) {
  if (!code) { ST.PH = null; return null; }
  if (!force && ST.PH && ST.PH.code === code) return ST.PH;
  const all = await API.get(API.P(code, '/all'));
  ST.PH = { code: all.project.code, project: all.project, rec: all.records, files: all.files, rev: all.rev };
  for (const k of Object.keys(ST.E)) ST.PH.rec[k] = ST.PH.rec[k] || [];
  ST.code = all.project.code; localStorage.setItem('cgi-hub-project', ST.code);
  return ST.PH;
}
async function loadPortfolio(force) {
  if (!force && ST.port && Date.now() - ST.portAt < 15000) return ST.port;
  ST.port = await API.get('/api/portfolio'); ST.portAt = Date.now(); return ST.port;
}
const DB = {
  async create(k, data, code = ST.code) { const r = await API.post(API.P(code, `/r/${k}`), data); if (ST.PH && code === ST.code) ST.PH.rec[k].push(r); ST.portAt = 0; return r; },
  async update(k, id, data, code = ST.code) { const r = await API.patch(API.P(code, `/r/${k}/${id}`), data); if (ST.PH && code === ST.code) { const i = ST.PH.rec[k].findIndex(x => x.id === r.id); if (i >= 0) ST.PH.rec[k][i] = r; } ST.portAt = 0; return r; },
  async remove(k, id, code = ST.code) { await API.del(API.P(code, `/r/${k}/${id}`)); if (ST.PH && code === ST.code) ST.PH.rec[k] = ST.PH.rec[k].filter(x => x.id !== +id); ST.portAt = 0; },
  async bulk(k, items, code = ST.code) { const rs = await API.post(API.P(code, `/bulk/${k}`), { items }); if (ST.PH && code === ST.code) for (const r of rs) { const i = ST.PH.rec[k].findIndex(x => x.id === r.id); if (i >= 0) ST.PH.rec[k][i] = r; } ST.portAt = 0; return rs; },
  async patchProject(d) { const p = await API.patch(API.P(ST.code), d); ST.PH.project = p; const i = ST.projects.findIndex(x => x.code === p.code); if (i >= 0) ST.projects[i] = p; ST.portAt = 0; return p; },
};

/* ---------------- status colours ---------------- */
function tone(v) {
  const s = String(v ?? '').toLowerCase();
  if (!s) return '';
  if (/^(closed|done|complete|approved|paid|pass|passed|installed|answered|resolved|received|issued to site|inspected|held|minutes issued|leading|supportive|went well|accepted|signed)/.test(s)) return 'green';
  if (/(overdue|fail|blocked|critical|rejected|cancel|resistant|occurred|^high$|a –|expired)/.test(s)) return 'red';
  if (/(progress|waiting|hold|mitigating|ordered|expediting|transit|quoted|submitted|review|partial|pass with|retest|ready|planned|draft|proposed|b –|medium|improve|follow-up)/.test(s)) return 'amber';
  if (/(open|not started|not run|outstanding|rfq|specifying|to-do|action|new)/.test(s)) return 'blue';
  return '';
}
const chip = (v, t) => v == null || v === '' ? '' : h('span', { class: 'chip ' + (t ?? tone(v)) }, String(v));
const ragOf = lbl => h('span', { class: 'rag ' + ({ Green: 'g', Amber: 'a', Red: 'r' }[lbl] || 'g') }, h('i'), lbl);

/* ---------------- modal (small dialogs) and sheet (records: slides in from the right, keeps the page in view) ---------------- */
function modal(title, body, foot, opts = {}) {
  const d = opts.sheet ? $('#sheet') : $('#dlg'); if (!opts.sheet && $('#sheet').open) $('#sheet').close();
  d.className = (opts.sheet ? 'sheet' : '') + (opts.wide ? ' wide' : ''); d.innerHTML = '';
  d.append(h('div', { class: 'mh' }, opts.icon ? icon(opts.icon) : null, h('div', { class: 'mt-wrap' }, opts.eyebrow ? h('div', { class: 'sh-eb' }, opts.eyebrow) : null, h('h2', {}, title)), opts.head || null, h('button', { class: 'btn ghost x', title: 'Close (Esc)', onclick: () => closeModal() }, '✕')),
    h('div', { class: 'mb' }, body), foot ? h('div', { class: 'mf' }, foot) : null);
  if (!d.open) d.showModal(); d.onclose = opts.onclose || null;
  d.onclick = opts.sheet ? (ev => { if (ev.target === d) closeModal(); }) : null;
  return d;
}
const sheet = (title, body, foot, opts = {}) => modal(title, body, foot, { ...opts, sheet: true });
const closeModal = () => { for (const id of ['#dlg', '#sheet']) { const d = $(id); if (d && d.open) d.close(); } };
const anyOpen = () => $('#dlg').open || $('#sheet').open;

/* ---------------- forms ---------------- */
const people = () => [...new Set([...REC('stakeholders').map(s => s.name), ...REC('actions').map(a => a.owner), ...REC('tasks').map(t => t.owner)].filter(Boolean))].sort();
function fieldInput(k, f, val) {
  let el;
  if (f.t === 'longtext') el = h('textarea', { name: f.k, rows: 3 }, val ?? '');
  else if (f.t === 'select') el = h('select', { name: f.k }, h('option', { value: '' }, '—'), (f.options || []).map(o => h('option', { value: o, selected: String(val) === String(o) }, o)), val && !(f.options || []).includes(val) ? h('option', { value: val, selected: true }, val) : null);
  else if (f.t === 'bool') el = h('input', { type: 'checkbox', name: f.k, checked: !!+val });
  else if (f.t === 'ref') { const rs = REC(f.ref); el = h('select', { name: f.k }, h('option', { value: '' }, '—'), rs.map(r => h('option', { value: r.id, selected: String(val) === String(r.id) }, (f.ref === 'tasks' && r.wbs ? r.wbs + ' ' : '') + titleOf(f.ref, r)))); }
  else if (f.t === 'date') el = h('input', { type: 'date', name: f.k, value: val ?? '' });
  else if (['number', 'money', 'pct'].includes(f.t)) el = h('input', { type: 'number', name: f.k, step: 'any', value: val ?? '' });
  else {
    el = h('input', { type: 'text', name: f.k, value: val ?? '' });
    if (/owner|^chair$|made_by|raised_by|witness|signed_off_by|requested_by|decision_by|author|^name$/.test(f.k) && k !== 'stakeholders') { el.setAttribute('list', 'dl-people'); }
    if (f.k === 'start_time' || f.k === 'remind_time') el.type = 'time';
  }
  return el;
}
function readFields(form, k) {
  const out = {};
  for (const f of ent(k).fields) {
    const el = form.querySelector(`[name="${f.k}"]`); if (!el) continue;
    out[f.k] = f.t === 'bool' ? (el.checked ? 1 : 0) : el.value;
  }
  return out;
}
const FORM_EXTRAS = {};   // entity -> (rec, wrap) => void : extra sections in the edit dialog
const FORM_HIDE = { raci: ['assignments'], meeting_items: [], tasks: [] };
function openForm(k, rec, presets = {}, after) {
  const e = ent(k), isNew = !rec, cur = { ...(e.fields.reduce((o, f) => ('default' in f ? { ...o, [f.k]: f.default } : o), {})), ...presets, ...(rec || {}) };
  const form = h('form', { class: 'form', onsubmit: ev => { ev.preventDefault(); save(); } });
  form.append(h('datalist', { id: 'dl-people' }, people().map(p => h('option', { value: p }))));
  for (const f of e.fields) {
    if (f.t === 'json' || (FORM_HIDE[k] || []).includes(f.k)) continue;
    const inp = fieldInput(k, f, cur[f.k]);
    form.append(f.t === 'bool' ? h('label', { class: 'chk' }, inp, f.label) : h('label', { class: (f.t === 'longtext' ? 'full' : '') }, h('span', { class: f.req ? 'req' : '' }, f.label), inp));
  }
  const wrap = h('div', {}, form);
  if (!isNew) {
    if (FORM_EXTRAS[k]) FORM_EXTRAS[k](rec, wrap);
    wrap.append(threadBlock(k, rec), attachBlock(k, rec.id), histBlock(k, rec));
  }
  const save = run(async () => {
    const data = readFields(form, k); let r;
    btn.disabled = true;
    try { r = isNew ? await DB.create(k, data) : await DB.update(k, rec.id, data); } finally { btn.disabled = false; }
    closeModal(); toast(`${e.singular} ${isNew ? 'added' : 'saved'}`); if (after) await after(r); else rerender();
  });
  const btn = h('button', { class: 'btn pri', onclick: save }, isNew ? `Add ${e.singular.toLowerCase()}` : 'Save');
  const foot = [btn, h('button', { class: 'btn', onclick: () => closeModal() }, 'Cancel')];
  if (!isNew) foot.push(h('button', { class: 'btn danger right', onclick: run(async () => { if (!confirm(`Delete this ${e.singular.toLowerCase()}?`)) return; await DB.remove(k, rec.id); closeModal(); toast('Deleted'); after ? after(null) : rerender(); }) }, icon('trash'), 'Delete'));
  sheet(isNew ? `New ${e.singular.toLowerCase()}` : String(titleOf(k, rec)).slice(0, 90), wrap, foot,
    { eyebrow: isNew ? e.label : `${e.singular}${rec.wbs ? ' ' + rec.wbs : ' #' + rec.id}${rec.source && !['manual', 'seed'].includes(rec.source) ? ' · from ' + rec.source : ''}${rec.updated_at ? ' · changed ' + String(rec.updated_at).slice(0, 10) : ''}`, wide: e.fields.length > 14 });
  setTimeout(() => form.querySelector('input,select,textarea')?.focus(), 30);
}

/* ---------------- attachments ---------------- */
const fileUrl = (rel, dl) => API.P(ST.code, `/file?path=${encodeURIComponent(rel)}${dl ? '&dl=1' : ''}`);
async function uploadFiles(files, q) {
  for (const f of files) {
    const qs = new URLSearchParams({ name: f.name, ...q });
    const r = await fetch(API.P(ST.code, `/files?${qs}`), { method: 'POST', body: f, headers: { 'Content-Type': f.type || 'application/octet-stream' } });
    const b = await r.json(); if (!r.ok) throw new Error(b.error || 'Upload failed');
    ST.PH.files.push(b);
  }
  toast(`${files.length} file(s) saved to the project folder`);
}
function fileRow(f) {
  return h('div', { class: 'file' }, icon('doc'), h('a', { href: fileUrl(f.path), target: '_blank' }, f.filename), h('span', { class: 'tiny muted' }, `${(f.size / 1024).toFixed(0)} kB · ${String(f.modified).slice(0, 10)}`),
    h('a', { class: 'btn sm ghost right', href: fileUrl(f.path, 1), title: 'Download' }, icon('download')));
}
function dropZone(text, onFiles) {
  const inp = h('input', { type: 'file', multiple: true, hidden: true, onchange: () => { if (inp.files.length) onFiles([...inp.files]); } });
  const z = h('div', { class: 'drop', onclick: () => inp.click(), ondragover: e => { e.preventDefault(); z.classList.add('over'); }, ondragleave: () => z.classList.remove('over'),
    ondrop: e => { e.preventDefault(); z.classList.remove('over'); if (e.dataTransfer.files.length) onFiles([...e.dataTransfer.files]); } }, text, inp);
  return z;
}
function attachBlock(k, id) {
  const list = h('div', { class: 'files' });
  const draw = () => { list.innerHTML = ''; const fs = (ST.PH.files || []).filter(f => f.entity === k && String(f.entity_id) === String(id)); fs.forEach(f => list.append(fileRow(f))); if (!fs.length) list.append(h('span', { class: 'note' }, 'No attachments yet.')); };
  draw();
  return h('div', { class: 'sub' }, h('h4', {}, icon('folder'), 'Attachments', h('span', { class: 'note' }, `saved in Documents/${ent(k).label}/${id}`)), list,
    h('div', { style: 'margin-top:8px' }, dropZone('Drop files here or click to attach (drawings, test sheets, quotes, photos…)', run(async fs => { await uploadFiles(fs, { entity: k, id }); draw(); }))));
}

/* ---------------- tables ---------------- */
function cellFor(k, f, r) {
  const v = r[f.k];
  if (f.t === 'date') return h('span', { class: ent(k).due === f.k && overdue(k, r) ? 'due' : '' }, v ? fdate(v) : '—');
  if (f.t === 'money') return money(v);
  if (f.t === 'pct') return v == null ? '—' : pct(v);
  if (f.t === 'bool') return +v ? '✓' : '';
  if (f.t === 'ref') { const t = byId(f.ref, v); return t ? String(titleOf(f.ref, t)) : ''; }
  if (f.t === 'select' && /status|result|priority|inspection|engagement|category|kind|response/.test(f.k)) return chip(v);
  if (f.t === 'longtext') return String(v ?? '').slice(0, 140);
  return v ?? '';
}
function sortRows(k, rows, key) {
  const s = key || ent(k).sort; if (!s) return rows;
  const desc = s.startsWith('-'), f = s.replace('-', '');
  const wbsKey = v => String(v ?? '').split('.').map(x => x.padStart(5, '0')).join('.');
  return [...rows].sort((a, b) => { const x = f === 'wbs' ? wbsKey(a[f]) : a[f] ?? '', y = f === 'wbs' ? wbsKey(b[f]) : b[f] ?? ''; return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true })) * (desc ? -1 : 1); });
}
function toCSV(k, rows) {
  const fs = ent(k).fields.filter(f => f.t !== 'json'); const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [['id', ...fs.map(f => f.label)].map(q).join(','), ...rows.map(r => [r.id, ...fs.map(f => f.t === 'ref' ? titleOf(f.ref, byId(f.ref, r[f.k])) : r[f.k])].map(q).join(','))].join('\r\n');
}
function table(k, rows, opts = {}) {
  const e = ent(k), cols = (opts.cols || e.list).map(c => e.fields.find(f => f.k === c)).filter(Boolean);
  let sortKey = opts.sort || null;
  const tb = h('tbody'), head = h('tr');
  const draw = () => {
    tb.innerHTML = '';
    const rs = sortKey ? sortRows(k, rows, sortKey) : sortRows(k, rows);
    for (const r of rs) {
      const tr = h('tr', { class: (isClosed(k, r) ? 'closed ' : '') + (overdue(k, r) ? 'od' : ''), onclick: ev => { if (ev.target.closest('input,button,a')) return; (opts.onRow || (x => openForm(k, x)))(r); } });
      if (opts.check) tr.append(h('td', { style: 'width:30px' }, h('input', { type: 'checkbox', checked: isClosed(k, r), title: 'Mark done', onchange: run(async ev => { await opts.check(r, ev.target.checked); }) })));
      for (const f of cols) tr.append(h('td', { class: (['money', 'number', 'pct'].includes(f.t) ? 'num' : '') + (f.t === 'longtext' || f.k === e.title ? ' wrap' : '') }, cellFor(k, f, r)));
      if (opts.extra) tr.append(h('td', {}, opts.extra(r)));
      tb.append(tr);
    }
    if (!rs.length) tb.append(h('tr', {}, h('td', { colspan: cols.length + (opts.check ? 1 : 0) + (opts.extra ? 1 : 0), class: 'muted', style: 'text-align:center;padding:22px' }, opts.empty || 'Nothing here yet.')));
  };
  if (opts.check) head.append(h('th', {}, ''));
  for (const f of cols) head.append(h('th', { class: ['money', 'number', 'pct'].includes(f.t) ? 'num' : '', onclick: () => { sortKey = sortKey === f.k ? '-' + f.k : f.k; draw(); } }, f.label));
  if (opts.extra) head.append(h('th', {}, opts.extraLabel || ''));
  draw();
  return h('div', { class: 'twrap', style: opts.maxh ? `max-height:${opts.maxh}` : '' }, h('table', { class: 't' }, h('thead', {}, head), tb, opts.foot || null));
}
/* register block: toolbar (search, open-only, add, CSV) + table */
function registerBlock(k, opts = {}) {
  const e = ent(k); let q = '', openOnly = opts.openOnly ?? false;
  const holder = h('div');
  const base = () => (opts.rows ? opts.rows() : REC(k));
  const draw = () => {
    let rs = base();
    if (openOnly) rs = rs.filter(r => !isClosed(k, r));
    if (q) rs = rs.filter(r => JSON.stringify(Object.values(r)).toLowerCase().includes(q));
    holder.innerHTML = ''; holder.append(table(k, rs, opts));
    cnt.textContent = `${rs.length} of ${base().length}`;
  };
  const cnt = h('span', { class: 'note' });
  const bar = h('div', { class: 'tbar' }, h('input', { type: 'search', placeholder: `Search ${e.label.toLowerCase()}…`, oninput: ev => { q = ev.target.value.toLowerCase(); draw(); } }),
    Object.keys(e.closed || {}).length ? h('label', { class: 'row small' }, h('input', { type: 'checkbox', checked: openOnly, onchange: ev => { openOnly = ev.target.checked; draw(); } }), 'Open only') : null, cnt,
    h('span', { class: 'right' }), opts.tools || null,
    h('button', { class: 'btn sm', onclick: () => download(`${ST.code}_${k}.csv`, toCSV(k, base()), 'text/csv') }, icon('download'), 'CSV'),
    opts.noAdd ? null : h('button', { class: 'btn pri sm', onclick: () => openForm(k, null, opts.presets ? opts.presets() : {}) }, icon('plus'), `Add ${e.singular.toLowerCase()}`));
  draw();
  return h('div', {}, opts.title ? h('h3', { style: 'margin:4px 0 10px' }, opts.title) : null, bar, holder);
}
function pageHead(eyebrow, title, sub, ...acts) { return h('div', { class: 'ph' }, h('div', {}, h('div', { class: 'eyebrow' }, eyebrow), h('h1', {}, title), sub ? h('p', {}, sub) : null), h('div', { class: 'acts' }, ...acts)); }
function tabs(list, cur, on) { return h('div', { class: 'tabs' }, list.map(([k, label, c]) => h('button', { class: k === cur ? 'on' : '', onclick: () => on(k) }, label, c != null ? h('span', { class: 'c' }, c) : null))); }
const kpi = (label, value, sub, cls, onclick) => h('div', { class: 'kpi ' + (cls || '') + (onclick ? ' click' : ''), onclick }, h('span', {}, label), h('b', {}, value), sub ? h('small', {}, sub) : null);
const empty = (title, body, btn) => h('div', { class: 'empty' }, h('b', {}, title), body, btn ? h('div', { style: 'margin-top:12px' }, btn) : null);

/* ---------------- calendar files (.ics) ---------------- */
function icsDate(d, time) { const s = String(d).replace(/-/g, ''); return time ? `${s}T${time.replace(':', '')}00` : s; }
function icsEvent(ev) {
  const L = ['BEGIN:VEVENT', `UID:${ev.uid}@cgi-project-hub`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`];
  if (ev.time) { L.push(`DTSTART;TZID=Africa/Johannesburg:${icsDate(ev.start, ev.time)}`); const end = new Date(`${ev.start}T${ev.time}:00`); end.setMinutes(end.getMinutes() + (+ev.duration || 60)); L.push(`DTEND;TZID=Africa/Johannesburg:${icsDate(iso(end), end.toTimeString().slice(0, 5))}`); }
  else { L.push(`DTSTART;VALUE=DATE:${icsDate(ev.start)}`, `DTEND;VALUE=DATE:${icsDate(addDays(ev.end || ev.start, 1))}`); }
  const fold = s => String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  L.push(`SUMMARY:${fold(ev.title)}`); if (ev.desc) L.push(`DESCRIPTION:${fold(ev.desc)}`); if (ev.location) L.push(`LOCATION:${fold(ev.location)}`);
  if (ev.attendees) for (const a of ev.attendees) if (/@/.test(a.email || '')) L.push(`ATTENDEE;CN=${fold(a.name)}:mailto:${a.email}`);
  if (ev.alarm !== false) L.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${fold(ev.title)}`, `TRIGGER:-PT${ev.alarm || (ev.time ? 15 : 9 * 60)}M`, 'END:VALARM');
  L.push('END:VEVENT'); return L.join('\r\n');
}
const icsFile = evs => ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CGI//Project Hub//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', ...evs.map(icsEvent), 'END:VCALENDAR'].join('\r\n');
const downloadICS = (name, evs) => download(name.replace(/[^\w .-]/g, '_') + '.ics', icsFile(evs), 'text/calendar');

/* ---------------- routing ---------------- */
const ROUTES = {};
function route(key, def) { ROUTES[key] = { key, ...def }; }
function go(key, params = {}, code) {
  const c = code || ST.code; const r = ROUTES[key];
  const qs = new URLSearchParams(params).toString();
  location.hash = r && r.project ? `#/p/${encodeURIComponent(c)}/${key}${qs ? '?' + qs : ''}` : `#/${key}${qs ? '?' + qs : ''}`;
}
let RENDER_TOKEN = 0;
function rerender() { if (window.renderRoute) window.renderRoute(true); }

/* ---------------- comments & photos on any record (record.thread) ---------------- */
const me = () => ST.cfg?.settings?.USER_NAME || 'Me';
function threadBlock(k, rec) {
  const box = h('div', { class: 'sub th' });
  const draw = () => {
    const cur = byId(k, rec.id) || rec, T = cur.thread || [];
    box.innerHTML = ''; box.append(h('h4', {}, icon('meet'), `Comments & photos${T.length ? ` (${T.length})` : ''}`));
    for (const e of T) box.append(h('div', { class: 'th-e' }, h('div', { class: 'th-h' }, h('span', { class: 'av' }, initials(e.by)), h('b', {}, e.by || '—'), h('small', {}, String(e.at || '').replace('T', ' '))),
      e.t ? h('p', {}, e.t) : null, (e.files || []).length ? h('div', { class: 'th-ph' }, e.files.map(f => /\.(png|jpe?g|webp|gif)$/i.test(f) ? h('a', { href: fileUrl(f), target: '_blank' }, h('img', { src: fileUrl(f), loading: 'lazy', alt: '' })) : h('a', { class: 'chip blue', href: fileUrl(f), target: '_blank' }, f.split('/').pop()))) : null));
    if (!T.length) box.append(h('p', { class: 'note' }, 'No comments yet — add an update, a question for the owner, or site photos.'));
    const ta = h('textarea', { rows: 2, placeholder: 'Add a comment…' }), fi = h('input', { type: 'file', multiple: true, accept: 'image/*,.pdf,.doc,.docx,.xlsx', hidden: true }), lab = h('small', { class: 'note' });
    fi.onchange = () => { lab.textContent = fi.files.length ? `${fi.files.length} file(s) to add` : ''; };
    const post = run(async () => {
      if (!ta.value.trim() && !fi.files.length) return ta.focus();
      const before = new Set((ST.PH.files || []).map(f => f.path)); if (fi.files.length) await uploadFiles([...fi.files], { entity: k, id: rec.id });
      const added = (ST.PH.files || []).filter(f => !before.has(f.path)).map(f => f.path);
      const c2 = byId(k, rec.id) || rec; await DB.update(k, rec.id, { thread: [...(c2.thread || []), { by: me(), at: new Date().toISOString().slice(0, 16), t: ta.value.trim(), files: added }] }); draw();
    });
    ta.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) post(); });
    box.append(h('div', { class: 'th-in' }, ta, h('div', { class: 'row', style: 'margin-top:6px' }, h('button', { class: 'btn sm', onclick: () => fi.click() }, '📷 Photos / files'), fi, lab, h('span', { class: 'right' }), h('button', { class: 'btn sm pri', onclick: post }, 'Post'))));
  };
  draw(); return box;
}
const initials = n => String(n || '?').split(/\s+/).filter(w => /^[A-Za-z0-9]/.test(w)).slice(0, 2).map(x => x[0].toUpperCase()).join('') || '?';
const fieldLabel = (k, f) => (ent(k)?.fields.find(x => x.k === f) || {}).label || ({ thread: 'Comments', created_at: 'Created', updated_at: 'Updated' }[f]) || f;
function histBlock(k, rec) {
  const body = h('div', { class: 'hs-b' }, h('p', { class: 'note' }, 'Reading…'));
  const d = h('details', { class: 'hs sub' }, h('summary', {}, 'What changed ', h('small', {}, 'who, when, from what to what')), body);
  d.addEventListener('toggle', async () => { if (!d.open || d.dataset.done) return; d.dataset.done = 1;
    const H = await API.get(API.P(ST.code, `/audit?entity=${k}&id=${rec.id}&limit=60`)).catch(() => []);
    const show = v => v == null || v === '' ? '—' : typeof v === 'object' ? (Array.isArray(v) ? `${v.length} item(s)` : 'updated') : String(v).slice(0, 80);
    body.innerHTML = ''; if (!H.length) body.append(h('p', { class: 'note' }, 'No changes logged yet.'));
    for (const a of H) body.append(h('div', { class: 'hs-e' }, h('div', { class: 'hs-h' }, h('b', {}, a.actor || 'someone'), h('small', {}, String(a.at).slice(0, 16).replace('T', ' ')), chip(a.action, a.action === 'delete' ? 'red' : a.action === 'create' ? 'green' : 'blue')),
      a.action === 'update' ? Object.keys(a.after || {}).map(f => h('div', { class: 'hs-c' }, h('span', {}, fieldLabel(k, f)), h('s', {}, show((a.before || {})[f])), h('i', {}, '→'), h('b', {}, show(a.after[f])))) : null));
  });
  return d;
}
