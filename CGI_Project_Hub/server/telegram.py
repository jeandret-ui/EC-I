"""Optional Telegram bot: send text or voice notes from your phone; they land in the Tracker inbox.
Long polling, so no public address is needed. Only chats in TELEGRAM_ALLOWED_CHATS are accepted.
Notes go to TELEGRAM_PROJECT (a project code) or the first active project; '/project CODE' switches.
"""
from __future__ import annotations
import json, threading, time, traceback, urllib.parse
from . import tracker as ai, store

API = 'https://api.telegram.org'
HELP = ('Send a text or voice note and I will log it and propose register updates for review.\n'
        '/projects list · /project CODE switch project · /actions open actions · /summary today · /inbox pending\n'
        '/approve <note> · /reject <note> · /id show this chat id')
CHAT_PROJECT: dict = {}

def _call(method, **params):
    tok = ai.CFG.get('TELEGRAM_BOT_TOKEN')
    return json.loads(ai._http(f'{API}/bot{tok}/{method}', urllib.parse.urlencode(params).encode(), {'Content-Type': 'application/x-www-form-urlencoded'}, timeout=70)).get('result')

def send(chat, text):
    for i in range(0, len(text), 3900): _call('sendMessage', chat_id=chat, text=text[i:i + 3900])

def allowed(chat): return str(chat) in {x.strip() for x in ai.CFG.get('TELEGRAM_ALLOWED_CHATS', '').split(',') if x.strip()}

def _code(chat):
    c = CHAT_PROJECT.get(chat) or ai.CFG.get('TELEGRAM_PROJECT')
    if c and store.exists(c): return c
    ps = [p for p in store.list_projects(False) if p.get('status') not in ('Complete',)]
    if not ps: raise RuntimeError('No projects yet')
    return ps[0]['code']

def on_processed(code, c, n):
    chat = (c.get('meta') or {}).get('telegram_chat')
    if not chat: return
    if c['status'] == 'Error': send(chat, f"[{code}] Could not process note #{c['id']}: {c.get('error')}"); return
    if c['status'] == 'Saved': send(chat, f"[{code}] Saved note #{c['id']} (AI is off, no changes proposed)."); return
    head = f"[{code}] Note #{c['id']} logged." + (f"\nHeard: “{c['transcript'][:300]}”" if c.get('transcript') else '')
    if not n: send(chat, head + '\nNo register changes proposed.'); return
    lines = [f"• {p['op']} {p['entity'].replace('_', ' ')}: {p.get('summary')}" for p in store.rows(code, 'proposals') if p.get('capture_id') == c['id'] and p.get('status') == 'Pending']
    send(chat, head + f'\n{n} proposed change(s):\n' + '\n'.join(lines) + f"\n\nReply /approve {c['id']} or /reject {c['id']}, or review in the hub.")

def handle(msg):
    chat = msg['chat']['id']; text = (msg.get('text') or '').strip()
    if text.startswith('/id'): send(chat, f'This chat id is {chat}. Add it in Settings › Telegram.'); return
    if not allowed(chat): send(chat, 'This chat is not authorised. Send /id and add the number in Settings.'); return
    if text.startswith('/start') or text.startswith('/help'): send(chat, HELP); return
    if text.startswith('/projects'): send(chat, '\n'.join(f"{p['code']} · {p['name']} ({p.get('status')})" for p in store.list_projects(False)) or 'No projects.'); return
    if text.startswith('/project'):
        parts = text.split(maxsplit=1)
        if len(parts) == 2 and store.exists(parts[1].strip()): CHAT_PROJECT[chat] = parts[1].strip().upper(); send(chat, f'Notes now go to {CHAT_PROJECT[chat]}.')
        else: send(chat, 'Use /project CODE (see /projects).')
        return
    code = _code(chat)
    if text.startswith('/actions'):
        acts = [r for r in store.rows(code, 'actions') if r.get('status') != 'Closed']
        send(chat, f'[{code}]\n' + ('\n'.join(f"• #{a['id']} {a['title']} ({a.get('owner') or 'no owner'}, {a.get('due_date') or 'no date'})" for a in acts) or 'No open actions.')); return
    if text.startswith('/summary'): send(chat, ai.make_summary(code)['text']); return
    if text.startswith('/inbox'):
        by = {}
        for p in store.rows(code, 'proposals'):
            if p.get('status') == 'Pending': by[p['capture_id']] = by.get(p['capture_id'], 0) + 1
        send(chat, f'[{code}]\n' + ('\n'.join(f'Note #{k}: {v} pending' for k, v in by.items()) or 'Inbox is empty.')); return
    if text.startswith('/approve') or text.startswith('/reject'):
        parts = text.split()
        if len(parts) < 2 or not parts[1].isdigit(): send(chat, 'Use /approve <note number>.'); return
        ok = 0
        for p in [p for p in store.rows(code, 'proposals') if p.get('capture_id') == int(parts[1]) and p.get('status') == 'Pending']:
            try: (ai.apply_proposal if text.startswith('/approve') else ai.reject_proposal)(code, p['id']); ok += 1
            except Exception as e: send(chat, f"Proposal {p['id']}: {e}")
        send(chat, f"{'Applied' if text.startswith('/approve') else 'Rejected'} {ok} change(s) from note #{parts[1]}."); return
    meta = {'telegram_chat': chat, 'from': (msg.get('from') or {}).get('first_name')}
    voice = msg.get('voice') or msg.get('audio')
    if voice:
        f = _call('getFile', file_id=voice['file_id'])
        content = ai._http(f"{API}/file/bot{ai.CFG['TELEGRAM_BOT_TOKEN']}/{f['file_path']}")
        info = store.save_file(code, f['file_path'].split('/')[-1] or 'voice.ogg', content, folder='Voice notes')
        c = ai.new_capture(code, 'Voice note', 'telegram', msg.get('caption'), info['path'], voice.get('mime_type', 'audio/ogg'), meta)
    elif text: c = ai.new_capture(code, 'Note', 'telegram', text, None, None, meta)
    else: return
    send(chat, f"[{code}] Got it, note #{c['id']}. Working on it…")

def loop():
    offset = 0
    while True:
        if not ai.CFG.get('TELEGRAM_BOT_TOKEN'): time.sleep(15); continue
        try:
            for u in _call('getUpdates', timeout=50, offset=offset) or []:
                offset = u['update_id'] + 1
                if u.get('message'):
                    try: handle(u['message'])
                    except Exception: traceback.print_exc()
        except Exception as e: print('Telegram:', str(e)[:200]); time.sleep(10)

def start():
    ai.NOTIFY.append(on_processed)
    threading.Thread(target=loop, daemon=True, name='telegram').start()
