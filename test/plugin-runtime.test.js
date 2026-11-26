import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';

const bundle = readFileSync(new URL('../dist/game-activity-toggle.js', import.meta.url), 'utf8');
const settle = () => new Promise(resolve => setImmediate(resolve));

test('bundle explains when the native runtime extension is missing', () => {
  assert.throws(() => runInNewContext(bundle, { phoenix: { ui: {} } }), /requires the Ember Sunbird runtime extension/);
});

test('standalone bundle waits for session, handles clicks and unloads without browser globals', async () => {
  let session = false, writes = 0, button, unload, removed = false, finishPatch;
  let settings = 'WgIaAA=='; // status.show_current_game = false
  const observers = [];
  const errors = [];
  const host = {
    gateway: {},
    log: { info() {}, error(...args) { errors.push(args); } },
    ui: {
      toast(message) { errors.push(message); },
      addUserPanelButton(options) {
        button = { ...options };
        const remove = () => { removed = true; };
        remove.update = patch => Object.assign(button, patch);
        return remove;
      },
    },
    discord: {
      async get() {
        if (!session) throw new Error('Phoenix has not made an API request yet, so there is no session');
        return { ok: true, status: 200, json: () => ({ settings }) };
      },
      async patch(_, body) {
        writes++;
        await new Promise(resolve => { finishPatch = resolve; });
        settings = body.settings;
        return { ok: true, status: 200, json: () => ({ settings }) };
      },
      onResponse(filter, handler) {
        const observer = { filter, handler, active: true };
        observers.push(observer);
        return () => { observer.active = false; };
      },
    },
    onUnload(cleanup) { unload = cleanup; },
  };
  runInNewContext(bundle, { phoenix: host });
  await settle();
  assert.equal(writes, 0);
  assert.equal(errors.length, 0);
  assert.equal(button.icon, 'game-controller');
  assert.equal(button.glyph, undefined);
  session = true;
  observers[0].handler({ status: 200, json: () => ({}) });
  await settle();
  assert.equal(button.active, false);
  assert.equal(button.busy, false);
  assert.equal(observers[0].active, false);
  button.onPress();
  assert.equal(button.active, true);
  assert.equal(button.busy, false);
  await settle();
  assert.equal(writes, 1);
  finishPatch(); await settle();
  assert.equal(button.active, true);
  assert.equal(button.busy, false);
  unload();
  assert.equal(removed, true);
  assert.equal(errors.length, 0);
});
