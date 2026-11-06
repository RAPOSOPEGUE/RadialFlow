# RadialFlow

Menu radial de atalhos para **Windows, Linux e macOS**. Segure o **botão direito** do mouse e **arraste um pouco**: uma roda aparece sob o cursor com ações que dependem do que está embaixo dele. Mova para uma fatia e solte para executar; solte no centro para cancelar.

| Sob o cursor | Ações |
|---|---|
| Arquivo(s) selecionado(s) no gerenciador de arquivos | Compactar (.zip), Extrair, Converter para PNG/JPG, Copiar caminho |
| Barra de título de uma janela | Encaixar à esquerda/direita, Maximizar, Minimizar |
| Campo de texto | Colar, Colar sem formatação, Traduzir seleção, Selecionar tudo |
| Qualquer outro lugar | Recorte de tela, Mostrar área de trabalho, Visão de tarefas |

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

**GNOME em Wayland (padrão do Ubuntu/Debian atuais)**

O Wayland não deixa nenhum programa observar o mouse fora das próprias janelas, então o gesto do botão direito é impossível. Nele, o RadialFlow funciona assim:

1. Com o app aberto (`npm start`), crie o atalho de teclado: `npm run atalho` (padrão **Ctrl+Alt+Espaço**; outro: `npm run atalho -- '<Super>r'`).
2. Aperte o atalho: a roda abre sob o cursor. Clique na fatia, ou tecle o número dela; **Esc** cancela.
3. Na primeira ação que envia teclas (colar, encaixar janela...), o GNOME pergunta se o RadialFlow pode **controlar o teclado**. Aprove; a autorização fica salva em `~/.config/radialflow/portal-token`. Enquanto há uma ação recente, o GNOME mostra um ícone de "controle remoto" na barra superior; ele some após 60 s sem uso.

O contexto vem do **foco**: campo de texto com foco → menu de texto; gerenciador de arquivos ativo → menu de arquivos; outro caso → ações da janela ativa (encaixar, maximizar, minimizar, recorte, visão geral). Encaixar usa Super+←/→/↑, os atalhos do GNOME/Tiling Assistant.

**Sessão X11 ("GNOME em Xorg" na tela de login)**: o gesto do botão direito funciona como no Windows e no macOS.

Em ambos: para detectar campos de texto em navegadores e apps Electron, ative a acessibilidade:
`gsettings set org.gnome.desktop.interface toolkit-accessibility true`

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

- Tudo roda localmente. A única ação que usa a internet é **Traduzir**: abre o Google Tradutor no navegador com o texto selecionado (até 4000 caracteres).
- A ação de copiar (Traduzir, e arquivos no Linux) usa a área de transferência e restaura o texto anterior em seguida.
- Windows: ações não funcionam sobre janelas de administrador, a menos que o RadialFlow também rode como administrador.
- Linux: no Wayland, ver acima. A detecção de arquivos funciona em Nautilus, Nemo, Caja, Thunar, Dolphin e PCManFM; a área de trabalho não é suportada.
- Botão do gesto (X11, Windows, macOS): `RADIALFLOW_BUTTON=1` esquerdo, `2` direito (padrão), `3` meio.
- macOS: "campo de texto" usa o elemento com foco, não o que está exatamente sob o cursor.
- Apps que desenham a própria interface (jogos, alguns apps Java) podem cair em "qualquer outro lugar".

## Testar e depurar

```bash
npm test                                   # testes do gesto e da geometria da roda
RADIALFLOW_DEBUG=1 npm start               # mostra eventos do mouse e o contexto detectado
RADIALFLOW_FAKE_CONTEXT=file npm start     # força um contexto e só registra a ação escolhida
```

O CI (GitHub Actions) roda os testes nos três sistemas e valida a sintaxe dos scripts de cada um.

## Licença

MIT
