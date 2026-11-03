/* =====================================================================
   INIT
   ===================================================================== */
function initApp() {
  const nav = $('#nav'); for (const s of SECTIONS) nav.append(h('button', { 'data-k': s.k, onclick: () => goSection(s.k) }, s.label));
  const home = $('#brandHome'); home.addEventListener('click', () => setTab('home')); home.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setTab('home'); } });
  const sel = $('#archSel'); sel.addEventListener('change', () => { S.arch = sel.value; S.sel = 0; if (NET3D) NET3D.static = null; SIM.running = false; update({ side: true }); });
  $('#drawerBtn').addEventListener('click', () => { S.ui.drawer = !S.ui.drawer; save(); layoutFor(S.tab); });
  const view = $('#view');
  for (const [k, t] of TABS) view.append(h('section', { class: 'pane' + (k === 'map' || k === 'net' ? ' full' : ''), id: 'pane-' + k, 'data-k': k, role: 'tabpanel', 'aria-label': t }));
  if (!TABS.some(t => t[0] === S.tab)) S.tab = 'home';
  compute(); buildSide(); renderHeader(); renderHops(); setTab(S.tab);
  if (typeof API !== 'undefined') API.init().then(() => { if (typeof refreshProjectHub === 'function') refreshProjectHub(); renderActive(); if (typeof renderContextHeader === 'function') renderContextHeader(secOf(S.tab).k); }).catch(console.error);
  const onTheme = () => { const d = isDark(); if (TEX.dark !== null && TEX.dark !== d) { buildTextures(); if (COV.data) paintOverlay(); }
    if (NET3D) NET3D.static = null; Plot.redrawAll(); renderActive(); drawMap(); };
  const mq = window.matchMedia && matchMedia('(prefers-color-scheme: dark)'); if (mq && mq.addEventListener) mq.addEventListener('change', onTheme);
  new MutationObserver(onTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}
initApp();
