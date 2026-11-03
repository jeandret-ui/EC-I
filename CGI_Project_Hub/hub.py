"""CGI Project Hub — start the local server and open the browser.

Usage:  python hub.py [--port 8765] [--no-browser] [--storage "D:\\Path\\To\\Storage"] [--stop]
Needs only Python 3.9+ (a Windows x64 runtime is bundled in ./runtime). No packages to install.
If the hub is already running, this just opens it in the browser.
"""
import json, os, sys, threading, urllib.request, webbrowser
from pathlib import Path
ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

def _log_to_file():
    """pythonw.exe (no console) has no stdout: keep a log on this PC instead."""
    if sys.stdout is not None and sys.stderr is not None: return
    d = Path(os.getenv('LOCALAPPDATA') or Path.home()) / 'CGI Project Hub'; d.mkdir(parents=True, exist_ok=True)
    f = d / 'hub.log'
    if f.exists() and f.stat().st_size > 2_000_000: f.replace(d / 'hub.old.log')
    sys.stdout = sys.stderr = open(f, 'a', encoding='utf-8', buffering=1)

def running_url():
    f = ROOT / '.hub_url'
    if not f.exists(): return None
    url = f.read_text(encoding='utf-8').strip()
    try:
        with urllib.request.urlopen(url + 'api/health', timeout=1.5) as r:
            if json.loads(r.read()).get('app') == 'CGI Project Hub': return url
    except Exception: return None

def main():
    _log_to_file()
    a = sys.argv[1:]
    port = int(a[a.index('--port') + 1]) if '--port' in a else 8765
    storage = a[a.index('--storage') + 1] if '--storage' in a else None
    browser = '--no-browser' not in a
    if sys.version_info < (3, 9): raise SystemExit('Python 3.9 or newer is needed.')
    url = running_url()
    if '--stop' in a:
        if not url: print('CGI Project Hub is not running.'); return
        urllib.request.urlopen(urllib.request.Request(url + 'api/shutdown', data=b'{}', method='POST', headers={'Content-Type': 'application/json'}), timeout=3)
        print('CGI Project Hub stopped.'); return
    if url and '--port' not in a:
        print('CGI Project Hub is already running:', url)
        if browser: webbrowser.open(url)
        return
    print('=' * 66 + '\n  CGI PROJECT HUB  -  Controlgear Instramac\n' + '=' * 66, flush=True)
    from server import app
    opener = (lambda u: threading.Timer(1.0, lambda: webbrowser.open(u)).start()) if browser else None
    app.serve(port, opener, Path(storage) if storage else None)

if __name__ == '__main__':
    try: main()
    except SystemExit: raise
    except Exception:
        import traceback; traceback.print_exc()
        if sys.stdout and hasattr(sys.stdout, 'name') and str(getattr(sys.stdout, 'name', '')).endswith('hub.log'):
            try:
                import ctypes; ctypes.windll.user32.MessageBoxW(0, 'CGI Project Hub could not start.\n\nDetails are in %LOCALAPPDATA%\\CGI Project Hub\\hub.log.\nTry "Start CGI Project Hub (console).bat" to see the error.', 'CGI Project Hub', 0x10)
            except Exception: pass
        raise
