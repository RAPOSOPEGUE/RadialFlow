# RadialFlow

Menu radial de atalhos para **Windows 10/11**. Segure o **botão direito** do mouse e **arraste um pouco**: uma roda aparece sob o cursor com ações que dependem do que está embaixo dele. Mova para uma fatia e solte para executar; solte no centro para cancelar.

| Sob o cursor | Ações |
|---|---|
| Arquivo(s) selecionado(s) no Explorer | Compactar (.zip), Extrair, Converter para PNG/JPG, Copiar caminho |
| Barra de título de uma janela | Encaixar à esquerda/direita, Maximizar, Minimizar |
| Campo de texto | Colar, Colar sem formatação, Traduzir seleção, Selecionar tudo |
| Qualquer outro lugar | Recorte de tela, Mostrar área de trabalho, Visão de tarefas |

## Requisitos

| SO | Requisitos |
|---|---|
| **Windows 10/11** | Node.js 20+, npm install (baixa `uiohook-napi`) |
| **Linux** | Node.js 20+, `xdotool`, `wmctrl`, `xclip`: `sudo apt install xdotool wmctrl xclip` (Debian/Ubuntu) |
| **macOS** | Node.js 20+, osascript (pré-instalado); Python 3 + `pip install pyobjc-framework-Quartz` para hooks globais |

## Como usar

```bash
git clone https://github.com/RAPOSOPEGUE/RadialFlow.git
cd RadialFlow
npm install
npm start
```

O app fica na bandeja do sistema (ícone azul), onde dá para desativar, ativar na inicialização ou sair.
Para gerar um instalador/pacote: `npm run dist` (cria `.exe` no Windows, `.AppImage`/`.deb` no Linux, `.dmg`/`.zip` no macOS).

## Como funciona

- **Gesto:** `src/gesture.js` detecta botão direito pressionado com arrasto de 12–400 px em até 0,8 s. Teclado não é monitorado.
- **Hooks de mouse:**
  - *Windows:* `uiohook-napi`
  - *Linux:* `xdotool` (requer permissões de entrada; em Wayland pode não funcionar sem polkit)
  - *macOS:* Polling via AppleScript + Python Quartz (requer permissão de acessibilidade)
- **Contexto:**
  - *Windows:* `scripts/context-probe.ps1` (PowerShell, `WM_NCHITTEST`, UI Automation, `Shell.Application`)
  - *Linux:* `xdotool getactivewindow getwindowname`
  - *macOS:* AppleScript (Finder, Safari, Xcode, etc.)
- **Ações:**
  - *Windows:* `scripts/do-action.ps1` (caminhos como argumentos, não em string de comando)
  - *Linux:* `xdotool` (janelas), `wmctrl` (snap), `xclip` (clipboard)
  - *macOS:* AppleScript
- A roda é uma janela Electron sem foco. No Windows, ela absorve o "soltar" do botão direito e evita o menu de contexto nativo.

## Privacidade e limites

- Tudo roda localmente. A única ação que usa internet é **Traduzir**: abre o Google Tradutor no navegador com o texto selecionado (até 4000 caracteres).
- **Windows:** ações não funcionam sobre janelas com privilégio elevado.
- **Linux:** Wayland não suporta hooks globais. X11 funciona. Em Wayland, o menu pode aparecer mas o gesto pode não ser detectado.
- **macOS:** requer permissão de acessibilidade. Primeira vez: *Preferências Sistêma → Segurança e Privacidade → Acessibilidade → Adicione o RadialFlow*.
- Detecção de arquivo: Explorer/Nautilus/Finder funcionam; Área de Trabalho (todas) ainda não é suportada.
- Apps que desenham UI nativa (Unity, Godot, alguns games) podem aparecer como "qualquer outro lugar" ou "campo de texto".
- Modo simulado (teste): `RADIALFLOW_FAKE_CONTEXT=file npm start` — detecta contexto fake e só imprime ações.

## Desenvolvimento

```bash
npm test   # testes do detector de gesto e da geometria da roda
```

O CI (GitHub Actions, Windows) roda os testes e valida a sintaxe dos scripts PowerShell.

## Licença

MIT
