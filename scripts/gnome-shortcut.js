'use strict';
// Cria (ou atualiza) um atalho de teclado personalizado do GNOME que abre a roda do RadialFlow.
// Uso: npm run atalho            → Ctrl+Alt+Espaço
//      npm run atalho -- '<Super>r'
// Equivale a Configurações → Teclado → Atalhos personalizados.

const { execFileSync } = require('node:child_process');
const path = require('node:path');

const BINDING = process.argv[2] || '<Control><Alt>space';
const SCHEMA = 'org.gnome.settings-daemon.plugins.media-keys';
const KEY_PATH = '/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/radialflow/';
const ENTRY = `${SCHEMA}.custom-keybinding:${KEY_PATH}`;

const gs = (...args) => execFileSync('gsettings', args, { encoding: 'utf8' }).trim();

const appDir = path.join(__dirname, '..');
const electron = require('electron'); // em Node, retorna o caminho do executável
// O GNOME interpreta como shell: escape das aspas.
const command = `${electron.replace(/"/g, '\\"')} ${appDir.replace(/"/g, '\\"')} --abrir`;

const current = gs('get', SCHEMA, 'custom-keybindings');
const list = current.startsWith('@as') ? [] : JSON.parse(current.replace(/'/g, '"'));
if (!list.includes(KEY_PATH)) {
  list.push(KEY_PATH);
  gs('set', SCHEMA, 'custom-keybindings', JSON.stringify(list).replace(/"/g, "'"));
}
gs('set', ENTRY, 'name', 'RadialFlow');
gs('set', ENTRY, 'command', command);
gs('set', ENTRY, 'binding', BINDING);

console.log(`Atalho ${BINDING} criado. Ele executa:\n  ${command}`);
console.log('Para remover: Configurações → Teclado → Ver e personalizar atalhos → Atalhos personalizados.');
