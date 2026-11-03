/* Shell: navigation, router, project picker, search, quick add, live refresh. */
'use strict';
const NAV = [
  ['Portfolio', ['portfolio', 'agenda', 'calendar', 'quotes', 'forecast']],
  ['Project', ['overview', 'week', 'schedule', 'board', 'meetings', 'actions', 'team', 'people', 'raid', 'charter', 'documents', 'tracker', 'activity']],
  ['Delivery', ['procurement', 'quality', 'technical', 'diary', 'rf']],
  ['Commercial', ['commercials', 'costing']],
  ['System', ['settings']],
];
function renderSide() {
  const nav = $('#nav'); nav.innerHTML = '';
  for (const [g, keys] of NAV) {
    const items = keys.map(k => ROUTES[k]).filter(r => r && (!r.project || ST.code) && (!r.visible || r.visible()));
    if (!items.length) continue;
    nav.append(h('div', { class: 'grp' }, g === 'Project' && ST.PH ? `Project · ${ST.code}` : g));
    for (const r of items) { const b = r.badge && ST.PH ? r.badge() : 0;
      nav.append(h('a', { href: r.project ? `#/p/${encodeURIComponent(ST.code)}/${r.key}` : `#/${r.key}`, class: ST.route === r.key ? 'on' : '' }, icon(r.icon), r.title, b ? h('span', { class: 'badge bad' }, b) : null)); }
  }
  const p = ST.PH?.project;
  $('#pickCode').textContent = p ? p.code : 'Project'; $('#pickName').textContent = p ? p.name : 'Select a project'; $('#pickDot').style.background = p ? projColor(p) : '#7090b5';
}
function parseHash() {
  const hs = location.hash.replace(/^#\/?/, ''), [path, qs] = hs.split('?'), parts = path.split('/').map(decodeURIComponent);
  const params = Object.fromEntries(new URLSearchParams(qs || ''));
  if (parts[0] === 'p' && parts[1]) return { code: parts[1], route: parts[2] || 'overview', params };
  return { code: null, route: parts[0] || 'portfolio', params };
}
let lastKey = '';
window.renderRoute = async function (soft) {
  const { code, route: rk, params } = parseHash(); const r = ROUTES[rk] || ROUTES.portfolio;
  const token = ++RENDER_TOKEN;
  try {
    if (code) await loadProject(code, !soft && lastKey.split('|')[0] !== code ? true : false);
    else if (r.project && ST.code) return go(rk, params, ST.code);
    else if (r.project) return go('portfolio');
  } catch (e) { toast(e.message, true); if (code) { localStorage.removeItem('cgi-hub-project'); ST.code = null; ST.PH = null; return go('portfolio'); } }
  if (token !== RENDER_TOKEN) return;
  ST.route = r.key; ST.params = params; lastKey = `${code || ''}|${rk}`;
  const v = $('#view'); const scroll = soft ? window.scrollY : 0;
  v.className = 'content'; v.innerHTML = '';
  $('#crumb').innerHTML = ''; $('#crumb').append(...(r.project && ST.PH ? [h('span', { style: 'margin:0' }, ST.code), h('span', {}, '/'), h('b', {}, r.title)] : [h('b', {}, r.title)]));
  document.title = `${r.title}${r.project && ST.PH ? ' · ' + ST.code : ''} · CGI Project Hub`;
  renderSide();
  try { await r.render(v); } catch (e) { console.error(e); v.append(empty('Something went wrong on this page', e.message)); }
  if (soft) window.scrollTo(0, scroll);
  $('#side').classList.remove('open');
};
window.addEventListener('hashchange', () => window.renderRoute(false));

/* ---------------- project picker ---------------- */
async function pickProject() {
  await loadProjects();
  const q = h('input', { type: 'search', placeholder: 'Search projects…' }), list = h('div', { class: 'agenda', style: 'max-height:60vh;overflow:auto' });
  const draw = () => { const s = q.value.toLowerCase(); list.innerHTML = '';
    const ps = ST.projects.filter(p => !s || `${p.code} ${p.name} ${p.client_name} ${p.site}`.toLowerCase().includes(s));
    let lastS = null;
    for (const p of ps) { const grp = p.status === 'Archived' ? 'Archived' : ['Complete'].includes(p.status) ? 'Complete' : 'Active & planned';
      if (grp !== lastS) { list.append(h('div', { class: 'grp' }, grp)); lastS = grp; }
      list.append(h('div', { class: 'ai', onclick: () => { closeModal(); go(ROUTES[ST.route]?.project ? ST.route : 'overview', {}, p.code); } }, h('i', { style: `width:10px;height:36px;border-radius:3px;background:${projColor(p)};flex:none` }),
        h('div', { class: 'tt' }, h('b', {}, `${p.code} · ${p.name}`), h('div', { class: 'tiny muted' }, [p.client_name, p.site, p.status].filter(Boolean).join(' · '))), p.code === ST.code ? chip('open', 'blue') : null)); }
    if (!ps.length) list.append(h('p', { class: 'note' }, 'No projects match.'));
  };
  q.oninput = draw; draw();
  modal('Projects', h('div', {}, q, list), [h('button', { class: 'btn pri', onclick: () => { closeModal(); newProjectDialog(); } }, icon('plus'), 'New project'), h('button', { class: 'btn', onclick: () => { closeModal(); go('portfolio'); } }, 'Portfolio')]);
  setTimeout(() => q.focus(), 30);
}

/* ---------------- search ---------------- */
function search(qs) {
  const box = $('#qres'); box.innerHTML = ''; if (!qs || !ST.PH) { box.classList.remove('open'); return; }
  const s = qs.toLowerCase(), hits = [];
  for (const k of Object.keys(ST.E)) for (const r of ST.PH.rec[k]) { const txt = Object.values(r).filter(v => typeof v === 'string').join(' ').toLowerCase(); if (txt.includes(s)) hits.push({ k, r }); if (hits.length > 40) break; }
  for (const f of ST.PH.files || []) if (f.filename.toLowerCase().includes(s)) hits.push({ file: f });
  for (const x of hits.slice(0, 30)) box.append(h('div', { onclick: () => { box.classList.remove('open'); $('#q').value = ''; if (x.file) window.open(fileUrl(x.file.path)); else if (x.k === 'tasks') openTask(x.r); else if (x.k === 'meetings') go('meetings', { id: x.r.id }); else openForm(x.k, x.r); } },
    h('b', {}, x.file ? x.file.filename : String(titleOf(x.k, x.r)).slice(0, 80)), h('div', { class: 'tiny muted' }, x.file ? 'Document · ' + x.file.folder : ent(x.k).singular + (dueOf(x.k, x.r) ? ' · ' + fdate(dueOf(x.k, x.r)) : ''))));
  if (!hits.length) box.append(h('p', { class: 'note', style: 'padding:8px' }, 'No matches in this project.'));
  box.classList.add('open');
}

/* ---------------- quick add ---------------- */
function quickAddMenu() {
  if (!ST.code) return newProjectDialog();
  const b = (label, fn, ic) => h('button', { class: 'btn', style: 'justify-content:flex-start;padding:12px', onclick: () => { closeModal(); setTimeout(fn, 30); } }, icon(ic), label);
  modal(`Quick add · ${ST.code}`, h('div', { class: 'grid g2' },
    b('Weekly status update', () => { WK.view = 'status'; go('week'); }, 'chart'), b('Action / to-do', () => openForm('actions', null, { owner: ST.cfg.settings.USER_NAME || '' }), 'check'), b('Meeting', () => newMeeting(false), 'meet'), b('Reminder', () => openForm('reminders', null, { remind_date: isoToday(), remind_time: '08:00' }), 'bell'),
    b('Task', () => openForm('tasks', null, { wbs: nextWbs(), progress: 0 }), 'gantt'), b('Risk', () => openForm('risks', null), 'risk'), b('Issue', () => openForm('issues', null, { raised_date: isoToday() }), 'risk'),
    b('Procurement item', () => openForm('procurement', null), 'truck'), b('Test (FAT / SAT)', () => openForm('tests', null), 'test'), b('Punch item', () => openForm('punch_items', null), 'test'),
    b('Stakeholder', () => openForm('stakeholders', null), 'people'), b('Change request', () => openForm('variations', null, { request_date: isoToday() }), 'doc'), b('Site diary entry', () => openForm('daily_logs', null, { log_date: isoToday() }), 'diary'),
    b('Note for the tracker', () => go('tracker'), 'spark'), b('New project', () => newProjectDialog(), 'plus')));
}

/* ---------------- live refresh (other tabs, OneDrive sync) ---------------- */
async function poll() {
  try {
    const hlth = await API.get('/api/health'); $('#sideFoot').classList.remove('off'); $('#footText').textContent = 'Saved to ' + (hlth.storage.split(/[\\/]/).pop() || 'storage');
    if (ST.code && ST.PH && !anyOpen() && !document.activeElement?.matches('input,textarea,select')) {
      const { rev } = await API.get(API.P(ST.code, '/rev'));
      if (rev > ST.PH.rev + 0.5) { await loadProject(ST.code, true); if (!ROUTES[ST.route]?.full) rerender(); }
    }
  } catch (e) { $('#sideFoot').classList.add('off'); $('#footText').textContent = 'Hub not running — start it from the shortcut'; }
}

/* ---------------- boot ---------------- */
(async function boot() {
  $('#picker').onclick = pickProject; $('#picker').onkeydown = e => { if (e.key === 'Enter') pickProject(); };
  $('#q').oninput = e => search(e.target.value); $('#q').onblur = () => setTimeout(() => $('#qres').classList.remove('open'), 200);
  $('#addBtn').onclick = quickAddMenu; $('#bellBtn').onclick = bellMenu; $('#menuBtn').onclick = () => $('#side').classList.toggle('open');
  document.addEventListener('keydown', e => { if (e.key === '/' && !e.target.matches('input,textarea,select')) { e.preventDefault(); $('#q').focus(); } });
  try { await loadConfig(); await loadProjects(); }
  catch (e) { $('#view').innerHTML = ''; $('#view').append(empty('The hub is not running', 'Start it with the “CGI Project Hub” shortcut on your desktop, then refresh this page.')); $('#sideFoot').classList.add('off'); return; }
  if (!location.hash) { const last = localStorage.getItem('cgi-hub-project'); if (last && ST.projects.some(p => p.code === last)) ST.code = last; location.hash = '#/portfolio'; }
  else await window.renderRoute(false);
  if (!ST.code) { const last = localStorage.getItem('cgi-hub-project'); if (last && ST.projects.some(p => p.code === last)) { await loadProject(last); renderSide(); } }
  checkReminders(); setInterval(checkReminders, 60000); setInterval(poll, 20000);
})();
