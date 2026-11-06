# RadialFlow

Menu radial de atalhos para **Windows 10/11**. Segure o **botão direito** do mouse e **arraste um pouco**: uma roda aparece sob o cursor com ações que dependem do que está embaixo dele. Mova para uma fatia e solte para executar; solte no centro para cancelar.

| Sob o cursor | Ações |
|---|---|
| Arquivo(s) selecionado(s) no Explorer | Compactar (.zip), Extrair, Converter para PNG/JPG, Copiar caminho |
| Barra de título de uma janela | Encaixar à esquerda/direita, Maximizar, Minimizar |
| Campo de texto | Colar, Colar sem formatação, Traduzir seleção, Selecionar tudo |
| Qualquer outro lugar | Recorte de tela, Mostrar área de trabalho, Visão de tarefas |

## Como usar

Requer [Node.js](https://nodejs.org) 20+ no Windows.

```bash
git clone <url-do-repositorio>
cd RadialFlow
npm install
npm start
```

O app fica na bandeja do sistema (ícone azul), onde dá para desativar, iniciar com o Windows ou sair.
Para gerar um instalador: `npm run dist`.

## Como funciona

- `uiohook-napi` observa **apenas eventos de mouse** (botão direito e movimento). Teclado não é monitorado.
- `src/gesture.js` detecta o gesto (arrasto de 12–400 px em até 0,8 s com o botão direito pressionado).
- `scripts/context-probe.ps1` (PowerShell persistente) descobre o contexto usando `WM_NCHITTEST`, UI Automation e `Shell.Application`.
- A roda é uma janela Electron transparente e sem foco. Como ela aparece sob o cursor, absorve o "soltar" do botão direito e o menu de contexto do Windows não abre depois do gesto.
- `scripts/do-action.ps1` executa as ações. Caminhos de arquivo são passados como argumentos, nunca montados em string de comando.

## Privacidade e limites

- Tudo roda localmente. A única ação que usa a internet é **Traduzir**: ela abre o Google Tradutor no navegador com o texto selecionado (até 4000 caracteres).
- Ações não funcionam sobre janelas de administrador, a menos que o RadialFlow também rode como administrador.
- A detecção de arquivo funciona nas janelas do Explorer; a Área de Trabalho ainda não é suportada.
- Apps que desenham a própria interface (alguns jogos, apps Java) podem ser detectados de forma imprecisa.
- Teste sem Windows: `RADIALFLOW_FAKE_CONTEXT=file npm start` simula o contexto e só imprime as ações.

## Desenvolvimento

```bash
npm test   # testes do detector de gesto e da geometria da roda
```

O CI (GitHub Actions, Windows) roda os testes e valida a sintaxe dos scripts PowerShell.

## Licença

MIT
