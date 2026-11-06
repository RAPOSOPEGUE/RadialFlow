# RadialFlow

Roda de conversão de arquivos para **Windows, Linux e macOS**. No gerenciador de arquivos, segure o **botão direito** sobre um arquivo e **arraste um pouco**: uma roda aparece sob o cursor. Mova para uma fatia e solte para executar; solte no centro para cancelar.

Ações: **Para PDF** (texto e imagens), **Compactar** (.zip), **Extrair**, **Para PNG**, **Para JPG**, **Copiar caminho**. O arquivo novo é criado ao lado do original.

## Instalação

Requer [Node.js](https://nodejs.org) 20+.

```bash
git clone https://github.com/RAPOSOPEGUE/RadialFlow.git
cd RadialFlow
npm install
npm start
```

O app fica na bandeja do sistema (ícone azul), onde dá para desativar ou sair.
Para gerar instalador: `npm run dist` (`.exe` no Windows, `.AppImage`/`.deb` no Linux, `.dmg` no macOS).

### Windows 10/11

Nada além do `npm install`.

### Linux

Pacotes: `sudo apt install wmctrl x11-utils python3-gi gir1.2-atspi-2.0` (Debian/Ubuntu). Para converter imagens: `imagemagick`.

**Use uma sessão X11.** O Wayland não deixa nenhum programa observar o mouse fora das próprias janelas, então o gesto não funciona nele. No GNOME: saia da sessão, clique no seu nome na tela de login, use a engrenagem no canto inferior direito e escolha **"GNOME em Xorg"**. Confira com `echo $XDG_SESSION_TYPE` (deve mostrar `x11`).

Ao segurar o botão direito, o menu de contexto do gerenciador de arquivos abre junto; o RadialFlow o fecha sozinho e copia a seleção (Ctrl+C) para saber quais arquivos converter.

Iniciar com o sistema: copie um `.desktop` que rode o app para `~/.config/autostart/`.

### macOS

- Na primeira execução, o macOS pede permissão de **Acessibilidade** (Ajustes do Sistema → Privacidade e Segurança → Acessibilidade). Conceda e abra o RadialFlow de novo.
- Na primeira ação sobre o Finder, o macOS pede permissão de **Automação** para controlar o Finder e o System Events.

## Como funciona

- **Gesto:** `uiohook-napi` observa apenas eventos de **mouse** nos três sistemas; `src/gesture.js` detecta botão direito + arrasto de 12–400 px em até 0,8 s. O teclado não é monitorado: o app só *envia* atalhos (Ctrl+V etc.).
- **Contexto:**
  - Windows: `scripts/context-probe.ps1` (UI Automation, `WM_NCHITTEST`, `Shell.Application`).
  - Linux: `scripts/context-probe-linux.py` (AT-SPI + `xprop`/`xwininfo`).
  - macOS: `scripts/context-probe-mac.applescript` (System Events + seleção do Finder).
- **Ações:** `src/platform/<sistema>.js`. Comandos externos rodam com lista de argumentos, sem shell; caminhos de arquivo nunca são montados em string de comando.
- **Menu nativo:** no Windows o menu de contexto abre ao soltar e a roda absorve esse clique. No Linux e no macOS ele abre ao apertar, então o app envia **Esc** quando a roda aparece.

## Privacidade e limites

- Tudo roda localmente; nada usa a internet.
- No Linux, a seleção é lida pela área de transferência, e o texto anterior é restaurado em seguida.
- Para PDF aceita texto (.txt, .md, .csv, .log, .json...) e imagens (.png, .jpg, .gif, .webp, .svg...).
- Windows: ações não funcionam sobre janelas de administrador, a menos que o RadialFlow também rode como administrador.
- Linux: só X11 (ver acima). A área de trabalho não é suportada.
- Botão do gesto: `RADIALFLOW_BUTTON=1` esquerdo, `2` direito (padrão), `3` meio.

## Testar e depurar

```bash
npm test                                   # testes do gesto e da geometria da roda
RADIALFLOW_DEBUG=1 npm start               # mostra eventos do mouse e o contexto detectado
RADIALFLOW_FAKE_CONTEXT=file npm start     # força um contexto e só registra a ação escolhida
```

O CI (GitHub Actions) roda os testes nos três sistemas e valida a sintaxe dos scripts de cada um.

## Licença

MIT
