/* Documents, RF lab, tracker (notes + AI), activity log, settings, new-project wizard. */
'use strict';

/* ---------------- documents ---------------- */
route('documents', { title: 'Documents', icon: 'folder', group: 'Project', project: true, render: async v => {
  const files = ST.PH.files = await API.get(API.P(ST.code, '/files'));
  let folder = ST.params.folder || 'General';
  v.append(pageHead('Files', 'Project documents', `Everything is stored in the project folder on disk: ${ST.PH.project.folder}\\Documents. Files you drop into that folder in Explorer show up here too.`,
    h('button', { class: 'btn', onclick: run(() => API.post(API.P(ST.code, '/open?path=Documents'))) }, icon('folder'), 'Open in Explorer')));
  const folders = [...new Set(['General', ...files.map(f => f.folder).filter(Boolean)])].sort();
  const sel = h('select', { style: 'width:auto' }, folders.map(f => h('option', { selected: f === folder }, f)), h('option', { value: '__new' }, '+ New folder…'));
  sel.addEventListener('change', () => { if (sel.value === '__new') { const n = prompt('Folder name (e.g. Drawings, Datasheets, Correspondence, Photos)'); if (n) { folder = n; sel.prepend(h('option', { selected: true }, n)); } else sel.value = folder; } else folder = sel.value; });
  v.append(h('div', { class: 'card', style: 'margin-bottom:16px' }, h('div', { class: 'row', style: 'margin-bottom:10px' }, h('b', {}, 'Upload to folder'), sel, h('span', { class: 'note' }, 'Suggested: Drawings · Datasheets · Quotes · Correspondence · Photos · Test reports · O&M')),
    dropZone('Drop files here or click to choose', run(async fs => { await uploadFiles(fs, { folder }); rerender(); }))));
  if (!files.length) { v.append(empty('No documents yet', 'Upload drawings, datasheets, quotes and photos, or attach files to any record.')); return; }
  const by = {}; for (const f of files) (by[f.folder || 'General'] = by[f.folder || 'General'] || []).push(f);
  for (const [fo, fs] of Object.entries(by).sort()) {
    if (fo.startsWith('_Deleted')) continue;
    v.append(h('div', { class: 'pfolder' }, `📁 ${fo}`), h('div', { class: 'files' }, fs.map(f => { const r = fileRow(f);
      if (f.entity && f.entity_id && ent(f.entity)) { const rec = byId(f.entity, f.entity_id); r.insertBefore(h('span', { class: 'chip blue', style: 'cursor:pointer', onclick: () => rec && openForm(f.entity, rec) }, `${ent(f.entity).singular}${rec ? ': ' + String(titleOf(f.entity, rec)).slice(0, 30) : ' #' + f.entity_id}`), r.children[2]); }
      r.append(h('button', { class: 'btn sm ghost', title: 'Move to _Deleted', onclick: run(async () => { if (!confirm(`Remove ${f.filename}? It is moved to Documents/_Deleted.`)) return; await API.del(API.P(ST.code, `/file?path=${encodeURIComponent(f.path)}`)); rerender(); }) }, icon('trash')));
      return r; })));
  }
} });

/* ---------------- RF lab ---------------- */
route('rf', { title: 'RF design lab', icon: 'radio', group: 'Delivery', project: true, full: true, visible: () => !!ST.PH?.project?.modules?.rf_lab, render: v => {
  v.classList.add('full');
  v.append(h('iframe', { src: `/rf/rf-lab.html?code=${encodeURIComponent(ST.code)}`, title: 'RF design lab' }));
} });

/* ---------------- tracker ---------------- */
route('tracker', { title: 'Notes & AI tracker', icon: 'spark', group: 'Project', project: true, render: async v => {
  const tab = ST.params.tab || 'capture', S_ = ST.cfg.settings;
  v.append(pageHead('Tracker', 'Notes & AI tracker', 'Log notes, meeting jottings or voice notes. With a Claude API key the hub proposes register updates (actions, decisions, procurement, tests…) that you approve. Without one, notes are kept in the project log.'));
  v.append(tabs([['capture', 'Capture & inbox'], ['summaries', 'Daily summaries'], ['ask', 'Ask the project']], tab, k => go('tracker', { tab: k })));
  if (tab === 'summaries') {
    const list = h('div', {}, h('p', { class: 'note' }, 'Loading…'));
    v.append(h('div', { class: 'tbar' }, h('button', { class: 'btn pri', onclick: run(async () => { await API.post(API.P(ST.code, '/summaries'), {}); rerender(); }) }, 'Generate today’s summary'), h('span', { class: 'note' }, S_.ai_ready ? 'Written by Claude from the day’s facts.' : 'A factual summary (add a Claude key in Settings for a written one).')), list);
    const ss = await API.get(API.P(ST.code, '/summaries')); list.innerHTML = ''; if (!ss.length) list.append(empty('No summaries yet', 'Generate one, or set the daily time in Settings.'));
    ss.forEach(s => list.append(h('div', { class: 'cap' }, h('div', { class: 'row tiny muted' }, `${fdate(s.for_date)} · ${s.period} · ${s.generator}`), h('div', { class: 'md', html: md(s.text) }))));
    return;
  }
  if (tab === 'ask') {
    const q = h('input', { type: 'text', placeholder: 'e.g. What is still outstanding before the SAT? Who owns the IP address question?' }), out = h('div', { class: 'cap', style: 'margin-top:12px;display:none' });
    const ask = run(async () => { if (!q.value.trim()) return; out.style.display = ''; out.textContent = 'Thinking…'; const r = await API.post(API.P(ST.code, '/ask'), { question: q.value }); out.innerHTML = md(r.answer); });
    q.addEventListener('keydown', e => { if (e.key === 'Enter') ask(); });
    v.append(S_.ai_ready ? h('div', {}, h('div', { class: 'row' }, q, h('button', { class: 'btn pri', onclick: ask }, 'Ask')), out) : empty('Needs a Claude API key', 'Add it under Settings › AI & Telegram.', h('button', { class: 'btn', onclick: () => go('settings') }, 'Settings')));
    return;
  }
  const txt = h('textarea', { rows: 4, placeholder: 'e.g. Spoke to Ruan: IP addresses to come from WEC by Friday. Panel testing moved to 1 Dec. UPS ordered from Tabateq, 3 weeks.' });
  const kind = h('select', { style: 'width:auto' }, ['Note', 'Meeting notes', 'Site visit', 'Phone call', 'Email'].map(k => h('option', {}, k)));
  const send = run(async () => { if (!txt.value.trim()) return; await API.post(API.P(ST.code, '/captures'), { text: txt.value, kind: kind.value }); txt.value = ''; toast('Logged'); setTimeout(rerender, 400); });
  let rec = null, chunks = [];
  const recBtn = h('button', { class: 'btn', onclick: run(async () => {
    if (rec) { rec.stop(); return; }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); rec = new MediaRecorder(stream); chunks = [];
    rec.ondataavailable = e => chunks.push(e.data); rec.onstop = run(async () => { stream.getTracks().forEach(t => t.stop()); const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' }); rec = null; recBtn.textContent = '● Record voice note';
      await fetch(API.P(ST.code, `/captures/audio?name=voice-${Date.now()}.webm&note=${encodeURIComponent(txt.value)}`), { method: 'POST', body: blob, headers: { 'Content-Type': blob.type } }); toast('Voice note saved'); setTimeout(rerender, 500); });
    rec.start(); recBtn.textContent = '■ Stop recording'; }) }, '● Record voice note');
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const dict = SR ? h('button', { class: 'btn', onclick: () => { const r = new SR(); r.lang = 'en-ZA'; r.interimResults = false; r.continuous = true; r.onresult = e => { txt.value += (txt.value ? ' ' : '') + [...e.results].slice(e.resultIndex).map(x => x[0].transcript).join(' '); }; r.start(); toast('Listening… click again or pause to stop'); dict.onclick = () => r.stop(); } }, icon('mic'), 'Dictate') : null;
  v.append(h('div', { class: 'card', style: 'margin-bottom:16px' }, txt, h('div', { class: 'row', style: 'margin-top:8px' }, kind, h('button', { class: 'btn pri', onclick: send }, 'Log note'), dict, recBtn,
    h('span', { class: 'note right' }, S_.ai_ready ? '✓ AI proposals on' : 'AI off: notes are saved to the log only'))));
  const caps = await API.get(API.P(ST.code, '/captures'));
  if (!caps.length) v.append(empty('No notes yet', 'Notes, voice notes and Telegram messages appear here with any proposed changes.'));
  for (const c of caps) {
    const pend = c.proposals.filter(p => p.status === 'Pending');
    v.append(h('div', { class: 'cap' }, h('div', { class: 'row' }, h('b', {}, `#${c.id} ${c.kind}`), h('span', { class: 'tiny muted' }, `${String(c.created_at).slice(0, 16).replace('T', ' ')} · ${c.channel}`), chip(c.status), c.status === 'Error' ? h('button', { class: 'btn sm', onclick: run(async () => { await API.post(API.P(ST.code, `/captures/${c.id}/retry`)); rerender(); }) }, 'Retry') : null),
      c.raw_text ? h('p', { style: 'margin:6px 0;white-space:pre-wrap' }, c.raw_text) : null, c.transcript ? h('p', { class: 'small', style: 'margin:6px 0' }, h('i', {}, 'Heard: '), c.transcript) : null, c.file ? h('a', { class: 'small', href: fileUrl(c.file), target: '_blank' }, '▶ audio') : null,
      c.error ? h('p', { class: 'small', style: 'color:var(--amber)' }, c.error) : null, c.meta?.ai_summary ? h('p', { class: 'small muted' }, c.meta.ai_summary) : null,
      c.proposals.map(p => h('div', { class: 'prop' }, h('div', { class: 'row' }, chip(p.op, 'blue'), h('b', {}, ent(p.entity)?.singular || p.entity), h('span', {}, p.summary), chip(p.status), p.confidence != null ? h('span', { class: 'tiny muted' }, `${Math.round(p.confidence * 100)}%`) : null,
        p.status === 'Pending' ? h('span', { class: 'right row' }, h('button', { class: 'btn sm pri', onclick: run(async () => { await API.post(API.P(ST.code, `/proposals/${p.id}/approve`), {}); await loadProject(ST.code, true); toast('Applied'); rerender(); }) }, 'Approve'),
          h('button', { class: 'btn sm', onclick: run(async () => { await API.post(API.P(ST.code, `/proposals/${p.id}/reject`), {}); rerender(); }) }, 'Reject')) : null),
        h('div', { class: 'tiny muted', style: 'margin-top:4px' }, Object.entries(p.fields || {}).map(([k, v]) => `${k}: ${v}`).join(' · ')), p.evidence ? h('div', { class: 'tiny', style: 'margin-top:2px' }, `“${p.evidence}”`) : null)),
      pend.length > 1 ? h('button', { class: 'btn sm', style: 'margin-top:6px', onclick: run(async () => { for (const p of pend) await API.post(API.P(ST.code, `/proposals/${p.id}/approve`), {}); await loadProject(ST.code, true); rerender(); }) }, `Approve all ${pend.length}`) : null));
  }
  if (caps.some(c => ['Queued', 'Transcribing', 'Extracting'].includes(c.status))) setTimeout(() => { if (ST.route === 'tracker') rerender(); }, 3000);
} });

/* ---------------- activity log ---------------- */
route('activity', { title: 'Activity log', icon: 'log', group: 'Project', project: true, render: async v => {
  const a = await API.get(API.P(ST.code, '/audit?limit=1000'));
  v.append(pageHead('Audit trail', 'Activity log', `Every change is appended to audit.jsonl in the project folder. Daily snapshots are kept in _history (restore in Settings).`));
  let q = ''; const box = h('div');
  const draw = () => { box.innerHTML = ''; const rs = a.filter(x => !q || JSON.stringify(x).toLowerCase().includes(q));
    box.append(h('div', { class: 'twrap', style: 'max-height:calc(100vh - 230px)' }, h('table', { class: 't' }, h('thead', {}, h('tr', {}, ['When', 'Who', 'Action', 'Register', 'Record', 'Change'].map(x => h('th', {}, x)))),
      h('tbody', {}, rs.slice(0, 600).map(x => h('tr', {}, h('td', { style: 'white-space:nowrap' }, String(x.at).slice(0, 16).replace('T', ' ')), h('td', {}, x.actor), h('td', {}, chip(x.action, x.action === 'delete' ? 'red' : x.action === 'create' ? 'green' : 'blue')),
        h('td', {}, ent(x.entity)?.label || x.entity), h('td', {}, x.id ?? ''), h('td', { class: 'wrap tiny' }, x.after ? Object.entries(x.after).filter(([k]) => !['created_at', 'updated_at'].includes(k)).slice(0, 6).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' · ') : x.before ? 'removed: ' + (x.before.title || x.before.name || '') : ''))))))); };
  v.append(h('div', { class: 'tbar' }, h('input', { type: 'search', placeholder: 'Filter…', oninput: e => { q = e.target.value.toLowerCase(); draw(); } }), h('span', { class: 'note' }, `${a.length} entries`)), box); draw();
} });

/* ---------------- settings ---------------- */
route('settings', { title: 'Settings & storage', icon: 'cog', group: 'System', render: async v => {
  const s = await API.get('/api/settings'); ST.cfg.settings = s;
  v.append(pageHead('System', 'Settings & storage', 'Where your data lives, backups and restore, your name, and the optional AI and Telegram connections.'));
  const save = run(async d => { const r = await API.post('/api/settings', d); ST.cfg.settings = r; toast('Settings saved'); });
  const inp = (k, label, type = 'text', ph = '') => { const i = h('input', { type, value: type === 'password' ? '' : (s[k] ?? ''), placeholder: type === 'password' ? (s[k] === 'set' ? '•••••• (saved — type to replace)' : ph) : ph }); i.addEventListener('change', () => { if (type === 'password' && !i.value) return; save({ [k]: i.value }); }); return h('label', {}, label, i); };
  const storage = h('input', { type: 'text', value: ST.cfg.storage });
  v.append(h('div', { class: 'grid g2' },
    h('div', { class: 'card' }, h('h3', {}, icon('folder'), 'Data storage'), h('p', { class: 'small' }, 'All project data (registers, schedules, costings, documents, notes, history) is saved here. The app folder is only the program.'),
      h('div', { class: 'row' }, storage, h('button', { class: 'btn', onclick: run(() => API.post('/api/open-storage')) }, 'Open')),
      h('div', { class: 'row', style: 'margin-top:8px' }, h('button', { class: 'btn sm', onclick: run(async () => { const r = await API.post('/api/settings/storage', { path: storage.value }); toast(`Saved. Close the hub window and start it again to use ${r.path}`); }) }, 'Use this folder (restart)'),
        h('span', { class: 'note' }, 'Copy the old folder’s contents across first if you move it.')),
      h('div', { class: 'form', style: 'margin-top:14px' }, inp('USER_NAME', 'Your name (shown in the log, used for “My work”)'))),
    ST.code ? projectSettings() : h('div', { class: 'card' }, h('h3', {}, 'Project'), h('p', { class: 'note' }, 'Open a project to see its backup and restore options.'))));
  v.append(h('div', { class: 'grid g2', style: 'margin-top:16px' },
    h('div', { class: 'card' }, h('h3', {}, icon('spark'), 'AI & Telegram (optional)'), h('p', { class: 'small muted' }, `Keys are stored on this PC only (${s.secrets_file}), never in the shared storage folder.`),
      h('div', { class: 'form' }, inp('ANTHROPIC_API_KEY', 'Claude API key', 'password', 'sk-ant-…'), inp('ANTHROPIC_MODEL', 'Claude model'), inp('OPENAI_API_KEY', 'OpenAI key (voice transcription)', 'password'),
        h('label', {}, 'Transcription', (() => { const x = h('select', {}, ['openai', 'assemblyai', 'off'].map(o => h('option', { selected: s.TRANSCRIBE_PROVIDER === o }, o))); x.onchange = () => save({ TRANSCRIBE_PROVIDER: x.value }); return x; })()),
        inp('TELEGRAM_BOT_TOKEN', 'Telegram bot token', 'password'), inp('TELEGRAM_ALLOWED_CHATS', 'Telegram allowed chat ids'), inp('TELEGRAM_PROJECT', 'Telegram default project code'), inp('SUMMARY_TIME', 'Daily summary time (HH:MM)'),
        h('label', { class: 'full' }, 'Vocabulary (helps transcription)', (() => { const t = h('textarea', { rows: 2 }, s.VOCABULARY || ''); t.onchange = () => save({ VOCABULARY: t.value }); return t; })())),
      h('div', { class: 'row', style: 'margin-top:10px' }, h('button', { class: 'btn', onclick: run(async () => { const r = await API.post('/api/settings/test', {}); toast(`Claude replied “${r.reply}” in ${r.seconds}s (${r.model})`); }) }, 'Test Claude connection'),
        h('span', { class: 'note' }, s.ai_ready ? '✓ AI ready' : 'AI off'), h('span', { class: 'note' }, s.telegram_ready ? '✓ Telegram on' : ''))),
    h('div', { class: 'card' }, h('h3', {}, icon('upload'), 'Import from earlier versions'), h('p', { class: 'small' }, 'Bring in data from the old CGI Project Hub V11 (folder containing store\\hub.sqlite3) or the old Project Dashboard V3 (folder containing data\\quote_register.json and data\\projects). Existing records are never overwritten.'),
      (() => { const p = h('input', { type: 'text', placeholder: 'C:\\Users\\…\\CGI_Project_Hub  or  …\\CGI_Project_Dashboard_V3' }); const out = h('div', { class: 'small', style: 'margin-top:8px' });
        return h('div', {}, h('div', { class: 'row' }, p, h('button', { class: 'btn', onclick: run(async () => { const r = await API.post('/api/import-legacy', { path: p.value }); out.innerHTML = ''; r.report.forEach(l => out.append(h('div', {}, '• ' + l))); await loadProjects(); renderSide(); }) }, 'Import')), out); })(),
      h('h3', { style: 'margin-top:18px' }, 'About'), h('div', { class: 'row', style: 'margin-bottom:6px' }, h('button', { class: 'btn danger sm', onclick: run(async () => { if (!confirm('Stop the hub? Open it again with the desktop shortcut.')) return; await API.post('/api/shutdown'); document.body.innerHTML = '<div style="padding:60px;font:16px Segoe UI">CGI Project Hub has stopped. Use the desktop shortcut to start it again.</div>'; }) }, 'Stop the hub'), h('span', { class: 'note' }, 'The hub runs quietly in the background; closing the browser does not stop it.')), h('p', { class: 'small' }, `CGI Project Hub v${ST.cfg.version} · local server on this PC · storage ${ST.cfg.storage}`),
      h('p', { class: 'small muted' }, 'Merged from CGI Project Hub V11 (schedule, registers, RF lab, tracker) and Project Dashboard V3 (costing, quote register, forecasts), plus meetings & minutes, RACI, FAT/SAT, procurement, PMP charter, calendar and reminders.'))));
} });
function projectSettings() {
  const p = ST.PH.project, box = h('div', { class: 'card' }, h('h3', {}, icon('charter'), `Project ${p.code}: backup & restore`));
  box.append(h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => { location.href = API.P(ST.code, '/export'); } }, icon('download'), 'Download full backup (.json)'),
    (() => { const f = h('input', { type: 'file', accept: '.json', hidden: true, onchange: run(async () => { const d = JSON.parse(await f.files[0].text()); if (!confirm(`Replace ${ST.code} registers with the backup from ${d.exported || 'file'}? A snapshot is taken first.`)) return; await API.post(API.P(ST.code, '/import'), d); await loadProject(ST.code, true); toast('Backup restored'); rerender(); }) });
      return h('span', {}, f, h('button', { class: 'btn', onclick: () => f.click() }, icon('upload'), 'Restore from backup file')); })(),
    h('button', { class: 'btn', onclick: run(async () => { const r = await API.post(API.P(ST.code, '/snapshots')); toast('Snapshot ' + r.name); rerender(); }) }, 'Take snapshot now')));
  box.append(h('label', { class: 'row small', style: 'margin-top:12px' }, h('input', { type: 'checkbox', checked: !!p.modules?.rf_lab, style: 'width:16px', onchange: run(async e => { await DB.patchProject({ modules: { rf_lab: e.target.checked } }); renderSide(); }) }), 'Show the RF design lab for this project'));
  const snaps = h('div', { class: 'small', style: 'margin-top:10px' }, 'Loading snapshots…');
  API.get(API.P(ST.code, '/snapshots')).then(list => { snaps.innerHTML = ''; snaps.append(h('b', {}, `Snapshots in _history (${list.length})`));
    list.slice(0, 12).forEach(x => snaps.append(h('div', { class: 'row', style: 'padding:3px 0;border-bottom:1px solid var(--line-2)' }, h('span', {}, x.name), h('span', { class: 'tiny muted' }, `${(x.size / 1024).toFixed(0)} kB`),
      h('button', { class: 'btn sm right', onclick: run(async () => { if (!confirm(`Restore ${ST.code} to snapshot ${x.name}? The current state is snapshotted first.`)) return; await API.post(API.P(ST.code, '/restore'), { name: x.name }); await loadProject(ST.code, true); toast('Restored ' + x.name); rerender(); }) }, 'Restore')))); });
  box.append(snaps);
  box.append(h('div', { class: 'row', style: 'margin-top:12px' }, h('span', { class: 'small' }, 'Status'), (() => { const s = h('select', { style: 'width:auto' }, ST.cfg.statuses.map(x => h('option', { selected: x === p.status }, x))); s.onchange = run(async () => { await DB.patchProject({ status: s.value }); await loadProjects(); renderSide(); toast(s.value === 'Archived' ? 'Archived: folder moved to Archive' : 'Status saved'); }); return s; })(),
    h('button', { class: 'btn sm', onclick: run(() => API.post(API.P(ST.code, '/open'))) }, icon('folder'), 'Open project folder')));
  return box;
}

/* ---------------- new project ---------------- */
async function newProjectDialog() {
  let recs = []; try { recs = await API.get('/api/register/records'); } catch (e) { }
  const f = { code: '', name: '', client_name: '', site: '', project_manager: '', start_date: isoToday(), target_finish: '', template: 'eci', colour: '#005093' };
  const form = h('div', { class: 'form' }), list = h('div', { class: 'agenda', style: 'max-height:260px;overflow:auto;border:1px solid var(--line);border-radius:8px;margin:8px 0 14px' });
  const fill = () => { form.innerHTML = '';
    const fld = (k, label, type = 'text') => { const i = h('input', { type, value: f[k] || '' }); i.oninput = () => f[k] = i.value; return h('label', {}, label, i); };
    form.append(fld('code', 'Project code *'), fld('name', 'Project name *'), fld('client_name', 'Client'), fld('site', 'Site / location'), fld('project_manager', 'Project manager'), fld('colour', 'Colour', 'color'), fld('start_date', 'Start date', 'date'), fld('target_finish', 'Target finish', 'date'),
      h('label', { class: 'full' }, 'Template', (() => { const s = h('select', {}, ST.cfg.templates.map(t => h('option', { value: t.key, selected: t.key === f.template }, `${t.label} — ${t.note}`))); s.onchange = () => f.template = s.value; return s; })()),
      f.register ? h('div', { class: 'full note' }, `From register: ${f.quote_ref || ''} · PO ${f.po_number || '—'} · ${money(f.po_value)} · contact ${f.contact_name || '—'}`) : null); };
  const q = h('input', { type: 'search', placeholder: 'Search the quote register: project code, PO, client, description…' });
  const draw = () => { const s = q.value.toLowerCase(); list.innerHTML = '';
    const existing = new Set(ST.projects.map(p => p.code));
    const rs = recs.filter(r => (r.project_no || r.order_no) && !existing.has(String(r.project_no || '').toUpperCase())).filter(r => !s || JSON.stringify(r).toLowerCase().includes(s)).sort((a, b) => (b.order_date || b.start || '') > (a.order_date || a.start || '') ? 1 : -1).slice(0, 60);
    if (!rs.length) list.append(h('p', { class: 'note', style: 'padding:10px' }, recs.length ? 'No matching awarded projects (with a PO) in the register.' : 'Quote register not available.'));
    for (const r of rs) list.append(h('div', { class: 'ai', onclick: ev => { const cm = String(r.contact || '').match(/^(.*?)\s*<(.+)>$/);
      Object.assign(f, { register: r.id, code: (r.project_no || r.workspace_code || r.quote_no || '').toUpperCase(), name: r.description || '', client_name: String(r.project_client || r.client || '').replace(/_/g, ' '), site: r.project_site || r.site || '',
        project_manager: r.pm || r.owner || '', start_date: r.start || r.order_date || isoToday(), target_finish: r.projected_end || r.end || '', po_number: r.order_no, po_value: r.order_value, po_date: r.order_date, quote_ref: r.quote_no, register_code: r.project_no,
        contact_name: cm ? cm[1] : (/@/.test(r.contact || '') ? '' : r.contact), contact_email: cm ? cm[2] : (/@/.test(r.contact || '') ? r.contact : ''), description: r.description });
      $$('.ai', list).forEach(x => x.style.background = ''); ev.currentTarget.style.background = 'var(--sky-100)'; fill(); } },
      h('div', { class: 'tt' }, h('b', {}, `${r.project_no || r.quote_no} · ${r.description || ''}`), h('div', { class: 'tiny muted' }, `${String(r.project_client || r.client || '').replace(/_/g, ' ')} · ${r.project_site || r.site || ''} · PO ${r.order_no || '—'} · ${r.order_date || ''}`)), h('span', { class: 'num small' }, kmoney(r.order_value || r.quote_value))));
  };
  q.oninput = draw; draw(); fill();
  const create = run(async () => { if (!f.code || !f.name) throw new Error('Code and name are required'); const p = await API.post('/api/projects', { ...f, quote_ref: f.quote_ref, po_number: f.po_number });
    closeModal(); await loadProjects(); toast(`Project ${p.code} created in ${p.folder}`); go('overview', {}, p.code); });
  modal('New project', h('div', {}, h('b', { class: 'small' }, 'Start from an awarded job in the quote register (optional)'), q, list, h('b', { class: 'small' }, 'Project details'), h('div', { style: 'margin-top:8px' }, form)),
    [h('button', { class: 'btn pri', onclick: create }, 'Create project'), h('button', { class: 'btn', onclick: closeModal }, 'Cancel')], { wide: true, icon: 'plus' });
}
