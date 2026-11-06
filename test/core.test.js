'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { GestureDetector } = require('../src/gesture');
const { sliceAt, menuFor } = require('../src/menus');

test('clique direito simples não dispara', () => {
  const g = new GestureDetector();
  let fired = false;
  g.on('trigger', () => { fired = true; });
  g.onRightDown(100, 100, 0);
  g.onMove(103, 102, 50);
  assert.equal(g.onRightUp(103, 102), false);
  assert.equal(fired, false);
});

test('arrasto curto dispara uma vez e release suprime menu', () => {
  const g = new GestureDetector();
  let triggers = 0, released = null;
  g.on('trigger', () => triggers++);
  g.on('release', (e) => { released = e; });
  g.onRightDown(100, 100, 0);
  g.onMove(130, 100, 100);
  g.onMove(160, 100, 120);
  assert.equal(triggers, 1);
  assert.equal(g.onRightUp(160, 100), true);
  assert.deepEqual(released.origin, { x: 100, y: 100 });
});

test('arrasto lento demais não dispara', () => {
  const g = new GestureDetector();
  let fired = false;
  g.on('trigger', () => { fired = true; });
  g.onRightDown(0, 0, 0);
  g.onMove(50, 0, 5000);
  assert.equal(fired, false);
});

test('sliceAt: direções e zona morta', () => {
  assert.equal(sliceAt(0, -100, 4), 0);   // cima
  assert.equal(sliceAt(100, 0, 4), 1);    // direita
  assert.equal(sliceAt(0, 100, 4), 2);    // baixo
  assert.equal(sliceAt(-100, 0, 4), 3);   // esquerda
  assert.equal(sliceAt(3, 3, 4), -1);     // centro
});

test('menuFor cai em unknown', () => {
  assert.ok(menuFor('xyz').length > 0);
  assert.ok(menuFor('file').some((s) => s.id === 'zip'));
});
