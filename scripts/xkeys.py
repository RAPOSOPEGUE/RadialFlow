#!/usr/bin/env python3
"""RadialFlow - envia combinações de teclas no X11 via XTest.

Uso: xkeys.py Control_L+c [Escape ...]  (nomes de keysym do X, separados por "+")
"""
import ctypes
import sys
import time

X = ctypes.CDLL('libX11.so.6')
T = ctypes.CDLL('libXtst.so.6')
X.XOpenDisplay.restype = ctypes.c_void_p
X.XStringToKeysym.restype = ctypes.c_ulong
X.XStringToKeysym.argtypes = [ctypes.c_char_p]
X.XKeysymToKeycode.argtypes = [ctypes.c_void_p, ctypes.c_ulong]
T.XTestFakeKeyEvent.argtypes = [ctypes.c_void_p, ctypes.c_uint, ctypes.c_int, ctypes.c_ulong]
X.XFlush.argtypes = [ctypes.c_void_p]

display = X.XOpenDisplay(None)
if not display:
    sys.exit('sem tela X')

for combo in sys.argv[1:]:
    codes = []
    for name in combo.split('+'):
        code = X.XKeysymToKeycode(display, X.XStringToKeysym(name.encode()))
        if not code:
            sys.exit(f'tecla desconhecida: {name}')
        codes.append(code)
    for code in codes:
        T.XTestFakeKeyEvent(display, code, 1, 0)
    for code in reversed(codes):
        T.XTestFakeKeyEvent(display, code, 0, 0)
    X.XFlush(display)
    time.sleep(0.05)
