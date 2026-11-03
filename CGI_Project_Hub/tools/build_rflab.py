"""Build modules/rflab/rf-lab.html: the Hub V11 RF design lab (Site section only), with its design state
saved per project in the storage folder (Projects/<CODE>/RF Lab/rf_state.json) instead of only the browser.
Sources: modules/rflab/src (copied from CGI Project Hub V11). Standard library only."""
import json, re
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
R = ROOT / 'modules' / 'rflab'; SRC = R / 'src'; CFG = R / 'config'
APP = ['app_core', 'app_api', 'app_net', 'app_tabs', 'app_map', 'app_more', 'app_reg', 'app_vendor', 'app_home', 'app_hub', 'app_comm', 'app_tracker', 'app_init']
read = lambda p: Path(p).read_text(encoding='utf-8')

def patch(name, s):
    if name == 'app_core':
        # load state from the hub server (per project) before the lab initialises; save back on every change
        s = s.replace("try { const raw = localStorage.getItem(KEY);", "try { const raw = (window.__RF_STATE && JSON.stringify(window.__RF_STATE)) || localStorage.getItem(KEY);", 1)
        s = s.replace("const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* storage unavailable */ } };",
                      "let __rfT; const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } clearTimeout(__rfT); __rfT = setTimeout(() => { if (window.__RF_CODE) fetch('/api/projects/' + encodeURIComponent(window.__RF_CODE) + '/rfstate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(S) }).catch(() => {}); }, 800); };", 1)
    if name == 'app_home':
        s = re.sub(r"const SECTIONS = \[.*?\n\];", "const SECTIONS = [\n  { k: 'site', label: 'RF design lab', tabs: ['site', 'map', 'net', 'reg', 'topo', 'prof', 'budget', 'fade', 'sim', 'ant', 'tower', 'spec', 'cmp', 'kit', 'val'], drawer: true, hops: true, sum: true },\n];", s, count=1, flags=re.S)
    if name == 'app_api':
        s = s.replace("const health = await this.req('/api/health');", "throw new Error('RF lab runs inside CGI Project Hub');", 1)
    if name == 'app_init':
        s = s.replace("if (!TABS.some(t => t[0] === S.tab)) S.tab = 'home';", "if (!SECTIONS[0].tabs.includes(S.tab)) S.tab = 'site';", 1)
    return s

def main():
    reg, reqs, seed, ents = (json.loads(read(CFG / n)) for n in ('network.json', 'requirements.json', 'project_seed.json', 'entities.json'))
    app = "(() => {\n'use strict';\n" + "\n".join(patch(n, read(SRC / f'{n}.js')) for n in APP) + "\n})();\n"
    data = ';\n'.join(f'const {n} = ' + json.dumps(v, ensure_ascii=False) for n, v in (('REGISTER', reg), ('REQS', reqs), ('PROJECT_SEED', seed), ('ENTITIES', ents))) + ';'
    pre = """<script>
window.__RF_CODE = new URLSearchParams(location.search).get('code') || '';
try { if (window.__RF_CODE) { const x = new XMLHttpRequest(); x.open('GET', '/api/projects/' + encodeURIComponent(window.__RF_CODE) + '/rfstate', false); x.send();
  if (x.status === 200) { const d = JSON.parse(x.responseText); if (d && d.v) window.__RF_STATE = d; } } } catch (e) {}
</script>
<style>#nav,#projectHeader,.brand span{display:none!important}.top{min-height:54px}.brand b:after{content:' · RF design lab';font-weight:500}</style>"""
    html = (read(SRC / 'template.html').replace('/*STYLE*/', read(SRC / 'style.css')).replace('/*DEM*/', read(R / 'data' / 'dem_data.js'))
            .replace('/*LIBS*/', '\n'.join(read(SRC / f) for f in ('engine.js', 'vendors.js', 'charts.js', 'gl.js'))).replace('/*REGISTER*/', data).replace('/*APP*/', app))
    html = html.replace('<title>CGI Project Hub — Molepolole</title>', '<title>RF design lab · CGI Project Hub</title>').replace('</head>', pre + '\n</head>', 1)
    html = re.sub(r'<link rel="preconnect"[^>]*>|<link href="https://fonts.googleapis.com[^>]*>', '', html)
    (R / 'rf-lab.html').write_text(html, encoding='utf-8')
    print(f'Built modules/rflab/rf-lab.html ({len(html) / 1e6:.2f} MB)')

if __name__ == '__main__': main()
