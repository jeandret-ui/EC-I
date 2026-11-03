/* =====================================================================
   TRACKER — capture notes and voice notes, review AI proposals,
   daily summaries, ask the project, activity log, settings
   ===================================================================== */
const TRK = { caps: [], pending: 0, timer: null, rec: null, kind: 'Note', draft: '' };
const BUSY = ['Queued', 'Transcribing', 'Extracting'];
const serverOnly = p => { if (PH.mode === 'server') return false; p.append(emptyState('The tracker needs the hub server', 'Start the hub with run_all.bat so notes, voice notes and summaries are stored centrally and the AI can run. Registers still work in local mode.')); return true; };
async function loadCaps() { TRK.caps = await API.captures(); TRK.pending = TRK.caps.reduce((s, c) => s + c.proposals.filter(p => p.status === 'Pending').length, 0); renderContextHeader(secOf(S.tab).k); }
function poll() {
  clearTimeout(TRK.timer);
  if (S.tab !== 'ai' || !TRK.caps.some(c => BUSY.includes(c.status))) return;
  TRK.timer = setTimeout(run(async () => { await loadCaps(); if (!TRK.caps.some(c => BUSY.includes(c.status))) { await API.refresh(); refreshProjectHub(); } if (S.tab === 'ai') drawInbox(); poll(); }), 2500);
}

regTab('ai', () => {}, run(async () => {
  const p = pane('ai'); if (serverOnly(p)) return;
  const st = PH.settings || {};
  p.append(hubTitle('Tracker', 'Tell the hub what happened. It logs the note, then proposes register updates for you to approve. Nothing changes until you approve it.'));
  if (!st.ai_ready) p.append(h('div', { class: 'banner' }, 'AI is off: notes are saved to the log, but no updates are proposed. Add your Claude API key in ', h('a', { href: '#', onclick: e => { e.preventDefault(); setTab('settings'); } }, 'Tracker › Settings'), '.'));
  const ta = h('textarea', { class: 'capturebox', placeholder: 'e.g. “Site meeting with WEC: client accepts dual point-to-point at SR3 subject to a written deviation. Willem to send the revised quote by Friday. Engineering Office tower slipped two weeks: steel late.”' }, TRK.draft);
  ta.addEventListener('input', () => { TRK.draft = ta.value; });
  const kind = h('select', { class: 'tsel' }, ['Note', 'Meeting', 'Site diary', 'Schedule update', 'Commercial', 'Phone call'].map(k => h('option', { selected: k === TRK.kind }, k))); kind.addEventListener('change', () => { TRK.kind = kind.value; });
  const status = h('span', { class: 'note' });
  const send = run(async () => { const t = ta.value.trim(); if (!t) return; await API.captureText(t, TRK.kind); TRK.draft = ''; ta.value = ''; toast('Logged'); await loadCaps(); drawInbox(); poll(); });
  const recBtn = h('button', { class: 'btn', type: 'button' }, 'Record voice note');
  recBtn.addEventListener('click', run(async () => {
    if (TRK.rec) { TRK.rec.stop(); return; }
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser cannot record audio here. Use Chrome or Edge, and open the hub via http://127.0.0.1 or https.');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true }), chunks = [], t0 = Date.now();
    const mr = new MediaRecorder(stream); TRK.rec = mr; recBtn.classList.add('recording');
    const tick = setInterval(() => { recBtn.textContent = `Stop recording (${Math.round((Date.now() - t0) / 1000)} s)`; }, 300);
    mr.ondataavailable = e => e.data.size && chunks.push(e.data);
    mr.onstop = run(async () => { clearInterval(tick); stream.getTracks().forEach(t => t.stop()); TRK.rec = null; recBtn.classList.remove('recording'); recBtn.textContent = 'Record voice note';
      const blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' }); status.textContent = 'Uploading…';
      await API.captureAudio(blob, TRK.kind === 'Note' ? 'Voice note' : TRK.kind, ta.value.trim()); ta.value = ''; TRK.draft = ''; status.textContent = ''; toast('Voice note uploaded');
      if (!st.voice_ready) toast('No transcription key set: the audio is stored but cannot be transcribed yet.', true);
      await loadCaps(); drawInbox(); poll(); });
    mr.start();
  }));
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const dict = SR ? (() => { const b = h('button', { class: 'btn', type: 'button', title: 'Browser speech recognition: free, no key needed (Chrome/Edge)' }, 'Dictate'); let r = null;
    b.addEventListener('click', () => { if (r) { r.stop(); return; } r = new SR(); r.lang = 'en-ZA'; r.continuous = true; r.interimResults = false; b.textContent = 'Stop dictating'; b.classList.add('recording');
      r.onresult = e => { for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) ta.value += (ta.value && !ta.value.endsWith(' ') ? ' ' : '') + e.results[i][0].transcript.trim(); TRK.draft = ta.value; };
      r.onend = () => { r = null; b.textContent = 'Dictate'; b.classList.remove('recording'); }; r.onerror = e => toast('Dictation: ' + e.error, true); r.start(); }); return b; })() : null;
  p.append(h('div', { class: 'card capture' }, h('div', { class: 'row', style: 'margin-bottom:8px' }, h('label', { class: 'row note' }, 'Type', kind), status), ta,
    h('div', { class: 'toolbar' }, recBtn, dict, h('span', { style: 'flex:1' }), h('button', { class: 'btn pri', onclick: send }, 'Log note'))));
  p.append(h('div', { id: 'inbox' }));
  await loadCaps(); drawInbox(); poll();
}));
function proposalCard(c, pr) {
  const E = ENTITIES[pr.entity], target = pr.op === 'update' ? byId(pr.entity, pr.target_id) : null, inputs = {};
  const grid = h('div', { class: 'pgrid' }, ...Object.entries(pr.fields).map(([k, v]) => { const f = E.fields.find(x => x.k === k); if (!f) return null;
    const old = target ? target[k] : undefined, el = f.t === 'longtext' ? h('textarea', { rows: 2 }, v ?? '') : f.t === 'select' ? h('select', {}, f.options.map(o => h('option', { selected: String(o) === String(v) }, o))) : h('input', { type: f.t === 'date' ? 'date' : 'text', value: v ?? '' });
    inputs[k] = el; if (pr.status !== 'Pending') el.disabled = true;
    return h('label', { class: 'pf' + (['money'].includes(f.t) ? ' warnf' : '') }, h('span', {}, f.label, old !== undefined && old !== null && String(old) !== String(v) ? h('small', {}, ` was ${f.t === 'date' ? dateTxt(old) : old}`) : null), el); }));
  const read = () => Object.fromEntries(Object.entries(inputs).map(([k, el]) => [k, el.value]));
  const tgtTxt = target ? `${E.singular} #${target.id}: ${titleOf(pr.entity, target)}` : pr.op === 'update' ? `${E.singular} #${pr.target_id} (not found)` : `New ${E.singular.toLowerCase()}`;
  return h('div', { class: 'prop ' + pr.status.toLowerCase() }, h('div', { class: 'phead' }, h('span', { class: 'badge ' + pr.op }, pr.op === 'create' ? 'Add' : 'Update'), h('b', {}, tgtTxt),
      h('span', { class: 'conf', title: 'Model confidence' }, h('i', { style: `width:${Math.round((pr.confidence || 0) * 100)}%` })), pr.status !== 'Pending' ? stChip(pr.status) : null),
    h('p', {}, pr.summary || ''), pr.evidence ? h('p', { class: 'evid' }, `“${pr.evidence}”`) : null, grid,
    pr.status === 'Pending' ? h('div', { class: 'row' }, h('button', { class: 'btn pri sm', onclick: run(async () => { await API.approve(pr.id, read()); toast('Applied'); await API.refresh(); await loadCaps(); refreshProjectHub(); drawInbox(); }) }, 'Approve'),
      h('button', { class: 'btn sm', onclick: run(async () => { await API.reject(pr.id); await loadCaps(); refreshProjectHub(); drawInbox(); }) }, 'Reject')) : null);
}
function drawInbox() {
  const box = $('#inbox'); if (!box) return; box.innerHTML = '';
  const pend = TRK.caps.filter(c => c.proposals.some(p => p.status === 'Pending'));
  box.append(h('h3', { class: 'sech' }, `To review (${TRK.pending})`));
  if (!pend.length) box.append(h('p', { class: 'note' }, 'Nothing waiting for review.'));
  const capCard = c => { const pend2 = c.proposals.filter(p => p.status === 'Pending');
    return h('div', { class: 'card capcard' }, h('div', { class: 'toolbar' }, h('div', { style: 'margin-right:auto' }, h('b', {}, `#${c.id} ${c.kind}`), h('span', { class: 'note' }, ` · ${c.channel} · ${new Date(c.created_at).toLocaleString('en-ZA')}`)),
        stChip(c.status), c.status === 'Error' ? h('button', { class: 'btn sm', onclick: run(async () => { await API.retry(c.id); await loadCaps(); drawInbox(); poll(); }) }, 'Retry') : null,
        pend2.length > 1 ? h('button', { class: 'btn sm', onclick: run(async () => { for (const p of pend2) await API.approve(p.id); toast(`Applied ${pend2.length}`); await API.refresh(); await loadCaps(); refreshProjectHub(); drawInbox(); }) }, `Approve all ${pend2.length}`) : null),
      c.raw_text ? h('p', { class: 'raw' }, c.raw_text) : null, c.transcript ? h('p', { class: 'raw' }, h('b', {}, 'Transcript: '), c.transcript) : null,
      c.meta?.ai_summary ? h('p', { class: 'note' }, c.meta.ai_summary) : null, c.error ? h('p', { class: c.status === 'Error' ? 'neg' : 'note' }, c.error) : null,
      BUSY.includes(c.status) ? h('p', { class: 'note' }, `${c.status}…`) : null, ...c.proposals.map(pr => proposalCard(c, pr))); };
  pend.forEach(c => box.append(capCard(c)));
  const rest = TRK.caps.filter(c => !pend.includes(c)).slice(0, 25);
  box.append(h('h3', { class: 'sech' }, 'Recent notes'), ...(rest.length ? rest.map(capCard) : [h('p', { class: 'note' }, 'No notes yet.')]));
}

/* ---------------- summaries ---------------- */
regTab('aisummaries', () => {}, run(async () => {
  const p = pane('aisummaries'); if (serverOnly(p)) return;
  const d = h('input', { type: 'date', value: isoToday() }), list = h('div');
  const draw = s => { list.innerHTML = ''; if (!s.length) list.append(emptyState('No summaries yet', `Generate one now, or wait for the automatic summary at ${PH.settings?.SUMMARY_TIME || '17:30'}.`));
    for (const x of s) list.append(h('div', { class: 'card' }, h('div', { class: 'toolbar' }, h('b', { style: 'margin-right:auto' }, dateTxt(x.for_date)), h('span', { class: 'note' }, `${x.generator === 'template' ? 'Standard summary (no AI)' : 'Written by ' + x.generator} · ${new Date(x.created_at).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}`),
      h('button', { class: 'btn sm', onclick: () => { navigator.clipboard?.writeText(x.text); toast('Copied'); } }, 'Copy')), h('div', { class: 'md', html: md(x.text) }))); };
  p.append(hubTitle('Daily summaries', `Built from the day’s notes, approved changes, overdue items, slippage and expiring quotes. Generated automatically at ${PH.settings?.SUMMARY_TIME || '17:30'} and sent to Telegram if connected.`,
    d, h('button', { class: 'btn pri sm', onclick: run(async () => { await API.makeSummary(d.value); draw(await API.summaries()); toast('Summary generated'); }) }, 'Generate')), list);
  draw(await API.summaries());
}));

/* ---------------- ask ---------------- */
regTab('aiask', () => {}, () => {
  const p = pane('aiask'); if (serverOnly(p)) return;
  const q = h('textarea', { class: 'capturebox', style: 'min-height:70px', placeholder: 'e.g. What did we agree with Tabateq about lead times? What is overdue for Willem? What changed on the schedule this week?' }), ans = h('div');
  const go = run(async () => { if (!q.value.trim()) return; ans.innerHTML = ''; ans.append(h('p', { class: 'note' }, 'Thinking…')); const r = await API.ask(q.value.trim()); ans.innerHTML = ''; ans.append(h('div', { class: 'card md', html: md(r.answer) })); });
  p.append(hubTitle('Ask the project', 'Questions are answered from the registers, notes and summaries only, with references to the records.'),
    h('div', { class: 'card' }, q, h('div', { class: 'toolbar' }, ...['What is overdue?', 'Summarise this week', 'Which quotes expire soon?'].map(s => h('button', { class: 'btn sm', onclick: () => { q.value = s; go(); } }, s)), h('span', { style: 'flex:1' }), h('button', { class: 'btn pri', onclick: go }, 'Ask'))), ans);
  if (!PH.settings?.ai_ready) p.append(h('div', { class: 'banner' }, 'Needs a Claude API key (Tracker › Settings).'));
});

/* ---------------- activity ---------------- */
regTab('activity', () => {}, run(async () => {
  const p = pane('activity'); if (serverOnly(p)) return;
  const rows = await API.audit();
  p.append(hubTitle('Activity log', 'Every change to every register: who or what made it, and what it was before. Changes approved from the Tracker show the note they came from.'));
  const T = h('table', { class: 't hubtable' }, h('tr', {}, ...['When', 'By', 'Change', 'Register', 'Record', 'Details'].map(x => h('th', {}, x))));
  for (const r of rows.filter(r => r.actor !== 'seed')) { const a = JSON.parse(r.after_json || 'null'), b = JSON.parse(r.before_json || 'null'), ent = ENTITIES[r.entity];
    const det = r.action === 'update' && a ? Object.keys(a).map(k => `${ent?.fields.find(f => f.k === k)?.label || k}: ${b?.[k] ?? '—'} → ${a[k] ?? '—'}`).join('; ') : '';
    T.append(h('tr', {}, h('td', {}, new Date(r.created_at).toLocaleString('en-ZA')), h('td', {}, r.actor), h('td', {}, r.action), h('td', {}, ent?.label || r.entity), h('td', { class: 'wrap' }, ent ? titleOf(r.entity, a || b || {}) : `#${r.entity_id}`), h('td', { class: 'wrap note' }, det))); }
  p.append(h('div', { class: 'card' }, rows.length ? h('div', { class: 'tw' }, T) : emptyState('No activity yet', 'Changes appear here as soon as anyone edits a record.')));
}));

/* ---------------- settings ---------------- */
regTab('settings', () => {}, run(async () => {
  const p = pane('settings'); if (serverOnly(p)) return;
  const s = await API.settings(); PH.settings = s; const inp = {};
  const fld = (k, label, type = 'text', hint = '', opts) => { const el = opts ? h('select', {}, opts.map(o => h('option', { selected: s[k] === o }, o))) : h('input', { type, value: type === 'password' ? '' : (s[k] || ''), placeholder: type === 'password' ? (s[k] ? 'saved — type to replace' : 'not set') : '' });
    inp[k] = el; return h('label', { class: 'ff' }, h('span', {}, label), el, hint ? h('small', { class: 'note' }, hint) : null); };
  const save = run(async () => { const d = {}; for (const [k, el] of Object.entries(inp)) { if (el.type === 'password' && !el.value) continue; d[k] = el.value; } PH.settings = await API.saveSettings(d); toast('Settings saved'); setTab('settings'); });
  const test = run(async () => { const r = await API.testAI(); toast(`Claude replied “${r.reply}” in ${r.seconds} s (${r.model})`); });
  const flag = (ok, t) => h('span', { class: 'chip ' + (ok ? 'pass' : 'warn') }, `${t}: ${ok ? 'ready' : 'not set'}`);
  p.append(hubTitle('Settings', 'Keys are stored in the .env file on the computer running the hub and are never sent to the browser. Settings can only be changed on that computer.', flag(s.ai_ready, 'AI'), flag(s.voice_ready, 'Voice'), flag(s.telegram_ready, 'Telegram')));
  p.append(h('div', { class: 'g-two' },
    h('div', { class: 'card fgrid' }, h('h3', { class: 'wide' }, 'Claude (proposals, summaries, questions)'), fld('ANTHROPIC_API_KEY', 'Claude API key', 'password', 'From console.anthropic.com › API keys'), fld('ANTHROPIC_MODEL', 'Model', 'text', 'Check the current model names in the Claude API documentation'),
      h('h3', { class: 'wide' }, 'Voice notes'), fld('TRANSCRIBE_PROVIDER', 'Transcription service', 'text', '', ['openai', 'assemblyai', 'none']), fld('OPENAI_API_KEY', 'OpenAI key (transcription)', 'password'),
      fld('OPENAI_TRANSCRIBE_MODEL', 'OpenAI transcription model'), fld('ASSEMBLYAI_API_KEY', 'AssemblyAI key', 'password'), fld('VOCABULARY', 'Project words to listen for', 'text', 'Helps spell names like SR3, Tabateq, BOCRA')),
    h('div', { class: 'card fgrid' }, h('h3', { class: 'wide' }, 'Telegram (notes from your phone)'), fld('TELEGRAM_BOT_TOKEN', 'Bot token', 'password', 'Create a bot with @BotFather and paste its token'),
      fld('TELEGRAM_ALLOWED_CHATS', 'Allowed chat ids', 'text', 'Send /id to your bot to get the number; separate several with commas'),
      h('h3', { class: 'wide' }, 'Daily summary'), fld('SUMMARY_TIME', 'Time (24 h)', 'text', 'e.g. 17:30, Monday to Saturday'), fld('SUMMARY_TO_TELEGRAM', 'Send to Telegram', 'text', '', ['yes', 'no']),
      h('h3', { class: 'wide' }, 'Network access'), fld('HUB_HOST', 'Listen on', 'text', '127.0.0.1 = this computer only; 0.0.0.0 = office network (set a token). Restart after changing.'),
      fld('HUB_TOKEN', 'Access token', 'password', 'Required by other devices when set'))));
  p.append(h('div', { class: 'toolbar' }, h('button', { class: 'btn', onclick: test }, 'Test Claude connection'), h('button', { class: 'btn pri', onclick: save }, 'Save settings')));
  p.append(h('div', { class: 'card' }, h('h3', {}, 'Backup'), h('p', { class: 'note' }, 'The database is store/hub.sqlite3 and attachments are in store/files. Copy the store folder to back up, or download a JSON export here.'),
    h('button', { class: 'btn sm', onclick: run(async () => { const b = await API.req(`/api/projects/${API.pid}/backup`); download(`project-hub-backup-${isoToday()}.json`, JSON.stringify(b, null, 1), 'application/json'); }) }, 'Download backup (JSON)')));
}));
