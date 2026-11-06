#!/usr/bin/env python3
"""RadialFlow - sonda de contexto para Linux (processo persistente).

Lê do stdin linhas "x y" e responde uma linha JSON por pedido:
  {"kind": "file"|"titlebar"|"text"|"unknown", "app": str, "role": str}

Usa AT-SPI (acessibilidade) para saber o que há sob o cursor e
xprop/xwininfo (X11) para detectar a barra de título desenhada pelo
gerenciador de janelas.
"""
import json
import re
import subprocess
import sys

try:
    import gi
    gi.require_version('Atspi', '2.0')
    from gi.repository import Atspi
except Exception:  # sem AT-SPI: só a detecção de barra de título funciona
    Atspi = None

TEXT_ROLES = {'text', 'entry', 'password text', 'terminal', 'document text',
              'editbar', 'paragraph', 'combo box', 'spin button'}
FILE_ROLES = {'table cell', 'icon', 'list item', 'tree item', 'canvas', 'layered pane',
              'table', 'tree table', 'list', 'tree'}
FILE_APPS = ('nautilus', 'org.gnome.nautilus', 'nemo', 'caja', 'thunar', 'dolphin', 'pcmanfm',
             'pcmanfm-qt', 'files', 'arquivos')
HEADER_ROLES = {'frame', 'panel', 'filler', 'header', 'tool bar', 'label', 'title bar'}


def sh(*args):
    try:
        return subprocess.run(args, capture_output=True, text=True, timeout=0.4).stdout
    except Exception:
        return ''


def x11_window_info():
    """Geometria da janela ativa (área do cliente) e extensões do quadro."""
    m = re.search(r'window id # (0x[0-9a-f]+)', sh('xprop', '-root', '_NET_ACTIVE_WINDOW'))
    if not m or m.group(1) == '0x0':
        return None
    wid = m.group(1)
    info = sh('xwininfo', '-id', wid)
    def num(label):
        mm = re.search(label + r':\s+(-?\d+)', info)
        return int(mm.group(1)) if mm else 0
    geo = {'x': num('Absolute upper-left X'), 'y': num('Absolute upper-left Y'),
           'w': num('Width'), 'h': num('Height'), 'frame_top': 0, 'csd_top': 0}
    frame = re.search(r'_NET_FRAME_EXTENTS\(CARDINAL\) = (\d+), (\d+), (\d+), (\d+)',
                      sh('xprop', '-id', wid, '_NET_FRAME_EXTENTS'))
    if frame:
        geo['frame_top'] = int(frame.group(3))
    csd = re.search(r'_GTK_FRAME_EXTENTS\(CARDINAL\) = (\d+), (\d+), (\d+), (\d+)',
                    sh('xprop', '-id', wid, '_GTK_FRAME_EXTENTS'))
    if csd:
        geo['csd_top'] = int(csd.group(3))
    return geo


def atspi_at(x, y):
    """Elemento mais profundo sob (x, y) na janela ativa: (nome do app, papel, topo da janela)."""
    if Atspi is None:
        return '', '', None
    desktop = Atspi.get_desktop(0)
    for i in range(desktop.get_child_count()):
        app = desktop.get_child_at_index(i)
        if app is None:
            continue
        for j in range(app.get_child_count()):
            win = app.get_child_at_index(j)
            if win is None or not win.get_state_set().contains(Atspi.StateType.ACTIVE):
                continue
            comp = win.get_component_iface()
            if comp is None or not comp.contains(x, y, Atspi.CoordType.SCREEN):
                continue
            top = comp.get_extents(Atspi.CoordType.SCREEN).y
            node = win
            for _ in range(40):  # desce até o elemento mais específico
                c = node.get_component_iface()
                child = c.get_accessible_at_point(x, y, Atspi.CoordType.SCREEN) if c else None
                if child is None or child == node:
                    break
                node = child
            return (app.get_name() or '').lower(), node.get_role_name() or '', top
    return '', '', None


def probe(x, y):
    res = {'kind': 'unknown', 'app': '', 'role': ''}
    geo = x11_window_info()
    atspi_top = None
    try:
        res['app'], res['role'], atspi_top = atspi_at(x, y)
    except Exception as exc:
        res['error'] = str(exc)

    # No Wayland a "janela ativa" do X11 é um marcador 1x1; usa o topo informado pelo AT-SPI.
    if (not geo or geo['w'] <= 1) and atspi_top is not None:
        if atspi_top <= y < atspi_top + 46 and res['role'] in HEADER_ROLES:
            res['kind'] = 'titlebar'
            return res
    elif geo and geo['x'] <= x < geo['x'] + geo['w']:
        # Barra desenhada pelo gerenciador de janelas (acima da área do cliente).
        if geo['frame_top'] and geo['y'] - geo['frame_top'] <= y < geo['y']:
            res['kind'] = 'titlebar'
            return res
        # Barra desenhada pelo app (GTK headerbar): faixa no topo + papel "neutro".
        top = geo['y'] + geo['csd_top']
        if not geo['frame_top'] and top <= y < top + 46 and res['role'] in HEADER_ROLES:
            res['kind'] = 'titlebar'
            return res

    if res['role'] in TEXT_ROLES:
        res['kind'] = 'text'
    elif res['role'] in FILE_ROLES and res['app'].startswith(FILE_APPS):
        res['kind'] = 'file'
    return res


def main():
    for line in sys.stdin:
        try:
            x, y = (int(float(v)) for v in line.split()[:2])
            out = probe(x, y)
        except Exception as exc:
            out = {'kind': 'unknown', 'error': str(exc)}
        sys.stdout.write(json.dumps(out) + '\n')
        sys.stdout.flush()


if __name__ == '__main__':
    main()
