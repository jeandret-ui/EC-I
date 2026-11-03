/* The team (ideas from the TMM implementation section, im-team.js): a card per person — role, team, site clearance,
   papers and when they run out, the next two weeks (on site / office / other duties / leave, tapped round), their open
   work; and the site diary drafted from what the project already knows. Never a ranking of people. */
'use strict';
const WHERE = [['', '·', 'not planned'], ['site', 'S', 'on site'], ['office', 'O', 'office / remote'], ['busy', 'B', 'other duties'], ['leave', 'L', 'leave']];
const availOn = (s, d) => ((s && s.availability) || {})[d] || '';
const avColor = n => { let x = 0; for (const c of String(n || '')) x = (x * 31 + c.charCodeAt(0)) | 0; return ['#005093', '#2f6fb3', '#0f7c86', '#6a5ad3', '#1d8a5b', '#b0457b', '#c27c00', '#5d6f84'][Math.abs(x) % 8]; };
const TEAM_PARTIES = ['Internal (CGI)', 'Contractor', 'Sub-contractor'];
const papersOf = s => (s.papers || []).map(p => ({ ...p, left: p.expires ? daysBetween(isoToday(), p.expires) : null }));

function strip(s, from, n, onSet) {
  const box = h('div', { class: 'tm-strip' });
  for (let i = 0; i < n; i++) { const d = addDays(from, i), w = availOn(s, d), we = !isWork(D0(d)), wh = WHERE.find(x => x[0] === w) || WHERE[0];
    box.append(h('button', { class: `tm-d ${w || 'none'}${we ? ' we' : ''}${d === isoToday() ? ' today' : ''}`, title: `${ddate(d)}: ${wh[2]}${onSet ? ' — tap to change' : ''}`, disabled: !onSet,
      onclick: onSet ? run(async () => { const nx = WHERE[(WHERE.findIndex(x => x[0] === w) + 1) % WHERE.length][0]; await onSet(d, nx); }) : null }, h('small', {}, DOW[D0(d).getDay()][0]), h('b', {}, D0(d).getDate()))); }
  return box;
}
async function setAvail(s, d, w) { const a = { ...(s.availability || {}) }; if (w) a[d] = w; else delete a[d]; await DB.update('stakeholders', s.id, { availability: a }); }

route('team', { title: 'Team', icon: 'people', group: 'Project', project: true, render: v => {
  const all = REC('stakeholders'), showAll = ST.params.all === '1', now = isoToday();
  const P = showAll ? all : all.filter(s => TEAM_PARTIES.includes(s.party) || ['Project management', 'Engineering', 'Workshop', 'Site / installation', 'Commissioning'].includes(s.team));
  const W = collectWork();
  const onSite = P.filter(s => availOn(s, now) === 'site').length, away = P.filter(s => ['leave', 'busy'].includes(availOn(s, now))).length;
  const exp = P.flatMap(s => papersOf(s).filter(p => p.left != null && p.left <= 30).map(p => ({ s, p }))), pend = P.filter(s => s.clearance === 'Papers pending').length;
  v.append(pageHead('People', 'Team', 'Who is on the project, where they are over the next two weeks, whether their site papers are in order, and what they hold this week. Tap a day to plan it: on site → office → other duties → leave.',
    h('a', { class: 'btn', href: `#/p/${encodeURIComponent(ST.code)}/team${showAll ? '' : '?all=1'}` }, showAll ? 'Only the delivery team' : 'Everyone (client, suppliers…)'),
    h('button', { class: 'btn pri', onclick: () => openForm('stakeholders', null, { party: 'Internal (CGI)', clearance: 'Not needed' }) }, icon('plus'), 'Add person')));
  v.append(h('div', { class: 'mts' }, mt('People', String(P.length), showAll ? 'everyone on the project' : 'delivery team'), mt('On site today', String(onSite), ddate(now)), mt('Away today', String(away), 'leave or other duties', away > 0),
    mt('Papers due', String(exp.length), 'expire within 30 days', exp.length > 0), mt('Clearance pending', String(pend), 'papers pending', pend > 0)));
  if (!P.length) { v.append(empty('No team yet', 'Add the CGI project team and contractors — or show everyone to include the client and suppliers.', h('button', { class: 'btn pri', onclick: () => openForm('stakeholders', null, { party: 'Internal (CGI)' }) }, 'Add person'))); return; }
  const from = mondayOf(now);
  v.append(h('div', { class: 'tm-legend' }, WHERE.slice(1).map(([k, , l]) => h('span', {}, h('i', { class: 'tm-d ' + k }), l))));
  v.append(h('div', { class: 'tm-grid' }, P.map(s => {
    const mineW = W.filter(x => x.owner === s.name), lateN = mineW.filter(x => x.due && x.due < now).length, pp = papersOf(s), bad = pp.filter(p => p.left != null && p.left < 0), soon = pp.filter(p => p.left != null && p.left >= 0 && p.left <= 30);
    return h('div', { class: 'tm-card' }, h('div', { class: 'row', style: 'gap:12px;align-items:flex-start' },
      h('span', { class: 'tm-av', style: `background:${avColor(s.name)}` }, initials(s.name)),
      h('div', { class: 'grow', style: 'min-width:0' }, h('button', { class: 'wk-tt', onclick: () => openForm('stakeholders', s) }, s.name), h('div', { class: 'tiny muted' }, [s.role, s.organisation].filter(Boolean).join(' · ') || s.party || ''),
        h('div', { class: 'row', style: 'margin-top:5px;gap:4px' }, s.team ? chip(s.team, 'blue') : null, s.clearance && s.clearance !== 'Not needed' ? chip(s.clearance, s.clearance === 'Cleared to work' ? 'green' : s.clearance === 'Supervise only' ? 'amber' : 'red') : null,
          bad.length ? chip(`${bad.length} paper(s) expired`, 'red') : soon.length ? chip(`${soon.length} paper(s) due`, 'amber') : pp.length ? chip(`${pp.length} papers ✓`, 'green') : null))),
      strip(s, from, 14, (d, w) => setAvail(s, d, w).then(rerender)),
      h('div', { class: 'tm-work' }, h('div', { class: 'row tiny' }, h('b', {}, `${mineW.length} open item${mineW.length === 1 ? '' : 's'}`), lateN ? chip(`${lateN} late`, 'red') : null, mineW.length > WIP ? chip('a lot at once', 'amber') : null,
        h('a', { class: 'right', href: '#', onclick: e => { e.preventDefault(); localStorage.setItem('cgi-who-' + ST.code, s.name); WK.view = 'mine'; go('week'); } }, 'Their week ›')),
        mineW.sort((a, b) => (a.due || '9') < (b.due || '9') ? -1 : 1).slice(0, 3).map(x => h('div', { class: 'tm-it', onclick: () => openItem(x) }, h('span', { class: 'grow' }, x.title), x.due ? h('span', { class: x.due < now ? 'bad' : 'muted' }, sdate(x.due)) : null))));
  })));
} });

/* person sheet: availability for four weeks, papers */
FORM_EXTRAS.stakeholders = (s, wrap) => {
  const box = h('div', { class: 'sub' });
  const draw = () => {
    const cur = byId('stakeholders', s.id) || s, from = mondayOf(isoToday());
    box.innerHTML = ''; box.append(h('h4', {}, icon('cal'), 'Availability (four weeks)', h('span', { class: 'note' }, 'tap a day: on site → office → other duties → leave')));
    for (let w = 0; w < 4; w++) box.append(strip(cur, addDays(from, 7 * w), 7, async (d, x) => { await setAvail(cur, d, x); draw(); }));
    const quick = (lab, wh) => h('button', { class: 'btn sm', onclick: run(async () => { const a = { ...(cur.availability || {}) }; for (let i = 7; i < 12; i++) a[addDays(from, i)] = wh; await DB.update('stakeholders', cur.id, { availability: a }); draw(); }) }, lab);
    box.append(h('div', { class: 'row', style: 'margin:6px 0 14px' }, h('span', { class: 'tiny muted' }, 'Next week:'), quick('On site', 'site'), quick('Office', 'office'), quick('Leave', 'leave')));
    box.append(h('h4', {}, icon('doc'), 'Papers & certificates', h('span', { class: 'note' }, 'induction, medical, permit to work, working at heights, passport/visa…')));
    const pp = papersOf(cur);
    pp.forEach((p, i) => box.append(h('div', { class: 'row', style: 'padding:4px 0;border-bottom:1px solid var(--line-2)' }, h('b', { class: 'grow small' }, p.name), h('span', { class: 'tiny muted' }, p.number || ''),
      p.expires ? chip(p.left < 0 ? `expired ${fdate(p.expires)}` : `expires ${fdate(p.expires)}`, p.left < 0 ? 'red' : p.left <= 30 ? 'amber' : 'green') : chip('no expiry'),
      h('button', { class: 'btn sm ghost', onclick: run(async () => { const L = [...(cur.papers || [])]; L.splice(i, 1); await DB.update('stakeholders', cur.id, { papers: L }); draw(); }) }, '×'))));
    const pn = h('input', { type: 'text', placeholder: 'e.g. Site induction (Molepolole WWTW)', list: 'tm-papers' }), pnum = h('input', { type: 'text', placeholder: 'Number', style: 'max-width:120px' }), pex = h('input', { type: 'date', style: 'max-width:160px' });
    box.append(h('datalist', { id: 'tm-papers' }, ['Site induction', 'Medical certificate', 'Working at heights', 'Permit to work', 'First aid', 'Fire fighting', 'Passport', 'Botswana work permit / visa', 'Electrical (wireman\'s) licence', 'Driver\'s licence'].map(x => h('option', { value: x }))),
      h('div', { class: 'row', style: 'margin-top:6px' }, pn, pnum, pex, h('button', { class: 'btn sm', onclick: run(async () => { if (!pn.value.trim()) return pn.focus(); await DB.update('stakeholders', cur.id, { papers: [...(cur.papers || []), { name: pn.value.trim(), number: pnum.value.trim(), expires: pex.value || null }] }); draw(); }) }, 'Add')));
    const mineW = collectWork().filter(x => x.owner === cur.name);
    if (mineW.length) box.append(h('h4', { style: 'margin-top:14px' }, icon('check'), `Their open work (${mineW.length})`), mineW.slice(0, 10).map(x => h('div', { class: 'tm-it', onclick: () => openItem(x) }, h('span', { class: 'wk-src', style: `color:${(SRC[x.src] || [])[1]}` }, (SRC[x.src] || [x.src])[0]), h('span', { class: 'grow' }, x.title), x.due ? h('span', { class: x.due < isoToday() ? 'bad' : 'muted' }, sdate(x.due)) : null)));
  };
  draw(); wrap.append(box);
};

/* site diary, drafted from the records */
route('diary', { title: 'Site diary', icon: 'diary', group: 'Delivery', project: true, render: v => {
  const now = isoToday(), today = REC('daily_logs').find(d => d.log_date === now);
  const draft = () => { const cpm = scheduleCPM(), act = cpm.rows.filter(r => !r.summary && r.es && r.es <= now && r.ef >= now && r.progress < 100), fin = cpm.rows.filter(r => r.t.actual_finish === now);
    const held = act.flatMap(r => readiness(r.t, r).filter(c => c.s === 'no').map(c => `- ${r.t.title}: ${c.label.toLowerCase()}${c.note ? ' — ' + c.note : ''}`));
    return { log_date: now, author: ST.cfg.settings.USER_NAME || '', location: ST.PH.project.site || '', on_site: REC('stakeholders').filter(s => availOn(s, now) === 'site').map(s => s.name).join(', '),
      activities: [...fin.map(r => `- Finished: ${r.t.title}`), ...act.map(r => `- ${r.t.title} (${Math.round(r.progress)}%)`)].join('\n'), delays: held.join('\n') }; };
  v.append(pageHead('Site', 'Site diary', 'A day on site in a few lines: who was there, what was done, what held it up — started from what the project already knows (the team plan, the schedule, the readiness checks). Attach photos to each day.',
    today ? h('button', { class: 'btn pri', onclick: () => openForm('daily_logs', today) }, 'Open today’s entry') : h('button', { class: 'btn pri', onclick: () => openForm('daily_logs', null, draft()) }, '✦ Start today’s diary from the project')));
  v.append(registerBlock('daily_logs', { presets: draft }));
} });
