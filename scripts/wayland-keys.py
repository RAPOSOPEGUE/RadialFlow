#!/usr/bin/env python3
"""RadialFlow - envia atalhos de teclado no Wayland pelo portal RemoteDesktop.

Processo persistente. Cada linha do stdin é um atalho, ex.: "Control_L+v",
"Super_L+Left". Responde uma linha JSON: {"ok": true} ou {"ok": false, "error": "..."}.

Na primeira vez o GNOME pergunta se o RadialFlow pode controlar o teclado.
A autorização fica salva (restore token) e não é pedida de novo. A sessão do
portal é aberta só quando há uma ação e fechada após 60 s parada.
"""
import json
import os
import sys

import gi
gi.require_version('Gio', '2.0')
from gi.repository import Gio, GLib  # noqa: E402

PORTAL = 'org.freedesktop.portal.Desktop'
PATH = '/org/freedesktop/portal/desktop'
IFACE = 'org.freedesktop.portal.RemoteDesktop'
TOKEN_FILE = os.path.join(GLib.get_user_config_dir(), 'radialflow', 'portal-token')
IDLE_SECONDS = 60

KEYSYMS = {
    'Control_L': 0xffe3, 'Shift_L': 0xffe1, 'Alt_L': 0xffe9, 'Super_L': 0xffeb,
    'Left': 0xff51, 'Up': 0xff52, 'Right': 0xff53, 'Down': 0xff54,
    'Print': 0xff61, 'Escape': 0xff1b, 'Tab': 0xff09, 'Return': 0xff0d,
}

bus = Gio.bus_get_sync(Gio.BusType.SESSION, None)
sender = bus.get_unique_name()[1:].replace('.', '_')
counter = 0
session = None
idle_source = None


def keysym(name):
    if name in KEYSYMS:
        return KEYSYMS[name]
    if len(name) == 1:
        return ord(name.lower())
    raise ValueError(f'tecla desconhecida: {name}')


def portal_request(method, build_args):
    """Chama um método do portal e espera o sinal Response da requisição."""
    global counter
    counter += 1
    token = f'radialflow{os.getpid()}_{counter}'
    req_path = f'{PATH}/request/{sender}/{token}'
    loop = GLib.MainLoop()
    result = {}

    def on_response(_conn, _sender, _path, _iface, _signal, params):
        result['code'], result['data'] = params.unpack()
        loop.quit()

    sub = bus.signal_subscribe(PORTAL, 'org.freedesktop.portal.Request', 'Response', req_path,
                               None, Gio.DBusSignalFlags.NO_MATCH_RULE, on_response)
    try:
        bus.call_sync(PORTAL, PATH, IFACE, method, build_args(token), None,
                      Gio.DBusCallFlags.NONE, -1, None)
        loop.run()
    finally:
        bus.signal_unsubscribe(sub)
    if result['code'] != 0:
        raise RuntimeError('autorização negada no diálogo do GNOME' if result['code'] == 1
                           else f'portal respondeu {result["code"]}')
    return result['data']


def read_token():
    try:
        with open(TOKEN_FILE, encoding='utf-8') as f:
            return f.read().strip()
    except OSError:
        return ''


def save_token(tok):
    os.makedirs(os.path.dirname(TOKEN_FILE), exist_ok=True)
    with open(TOKEN_FILE, 'w', encoding='utf-8') as f:
        f.write(tok)
    os.chmod(TOKEN_FILE, 0o600)


def open_session():
    global session
    data = portal_request('CreateSession', lambda t: GLib.Variant('(a{sv})', ({
        'handle_token': GLib.Variant('s', t),
        'session_handle_token': GLib.Variant('s', f'radialflow{os.getpid()}'),
    },)))
    handle = data['session_handle']
    opts = {'types': GLib.Variant('u', 1), 'persist_mode': GLib.Variant('u', 2)}  # teclado; persistente
    tok = read_token()
    if tok:
        opts['restore_token'] = GLib.Variant('s', tok)

    def select_args(t):
        return GLib.Variant('(oa{sv})', (handle, dict(opts, handle_token=GLib.Variant('s', t))))
    portal_request('SelectDevices', select_args)
    started = portal_request('Start', lambda t: GLib.Variant(
        '(osa{sv})', (handle, '', {'handle_token': GLib.Variant('s', t)})))
    if started.get('restore_token'):
        save_token(started['restore_token'])
    session = handle


def close_session():
    global session, idle_source
    idle_source = None
    if session:
        try:
            bus.call_sync(PORTAL, session, 'org.freedesktop.portal.Session', 'Close', None, None,
                          Gio.DBusCallFlags.NONE, -1, None)
        except GLib.Error:
            pass
        session = None
    return False


def send_combo(combo):
    global idle_source
    syms = [keysym(k) for k in combo.split('+')]
    if not session:
        open_session()
    for state, order in ((1, syms), (0, list(reversed(syms)))):  # aperta em ordem, solta ao contrário
        for sym in order:
            bus.call_sync(PORTAL, PATH, IFACE, 'NotifyKeyboardKeysym',
                          GLib.Variant('(oa{sv}iu)', (session, {}, sym, state)),
                          None, Gio.DBusCallFlags.NONE, -1, None)
    if idle_source:
        GLib.source_remove(idle_source)
    idle_source = GLib.timeout_add_seconds(IDLE_SECONDS, close_session)


def on_stdin(channel, _cond):
    line = channel.readline()
    if not line:
        close_session()
        main_loop.quit()
        return False
    combo = line.strip()
    if combo:
        try:
            send_combo(combo)
            out = {'ok': True}
        except Exception as exc:  # GLib.Error, RuntimeError, ValueError
            close_session()
            out = {'ok': False, 'error': str(exc)}
        sys.stdout.write(json.dumps(out) + '\n')
        sys.stdout.flush()
    return True


main_loop = GLib.MainLoop()
stdin = GLib.IOChannel.unix_new(sys.stdin.fileno())
GLib.io_add_watch(stdin, GLib.PRIORITY_DEFAULT, GLib.IOCondition.IN | GLib.IOCondition.HUP, on_stdin)
main_loop.run()
