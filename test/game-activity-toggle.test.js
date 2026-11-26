import assert from 'node:assert/strict';
import { test } from 'node:test';
import { activityPatch, readActivity, encodeBase64, decodeBase64 } from '../plugins/game-activity-toggle/proto.js';
import { createActivityController } from '../plugins/game-activity-toggle/controller.js';

const encoded = bytes => Buffer.from(bytes).toString('base64');
const reply = (settings, extra = {}) => ({ ok: true, status: 200, json: () => ({ settings, ...extra }) });

test('base64 works without Node or browser globals', () => {
  for (let size = 0; size < 256; size++) {
    const bytes = Array.from({ length: size }, (_, i) => (i * 97 + size) % 256);
    assert.equal(encodeBase64(bytes), encoded(bytes));
    assert.deepEqual(decodeBase64(encoded(bytes)), bytes);
  }
});

test('unset game visibility defaults to true; present empty BoolValue means false', () => {
  assert.equal(readActivity('').enabled, true);
  assert.equal(readActivity(encoded([90, 2, 26, 0])).enabled, false);
});

test('patch preserves presence, custom status, expiry and unknown status fields byte for byte', () => {
  // Versions.data_version=7; Status contains online, custom status, fixed64 expiry, unknown field.
  const preserved = [10, 8, 10, 6, ...Buffer.from('online'), 18, 3, 10, 1, 88,
    33, 1, 2, 3, 4, 5, 6, 7, 8, 160, 6, 129, 1];
  const original = encoded([10, 2, 24, 7, 90, preserved.length + 4, ...preserved, 26, 2, 8, 1]);
  const patch = activityPatch(readActivity(original), false);
  assert.equal(patch.required_data_version, 7);
  assert.deepEqual(decodeBase64(patch.settings), [90, preserved.length + 2, ...preserved, 26, 0]);
  assert.equal(readActivity(patch.settings).enabled, false);
  assert.equal(readActivity(activityPatch(readActivity(patch.settings), true).settings).enabled, true);
});

test('malformed settings are rejected before a write', async () => {
  for (const bytes of [[90, 5, 1], [90], [90, 1, 26], [90, 2, 24, 1], [0], [15]]) {
    assert.throws(() => readActivity(encoded(bytes)));
  }
  let writes = 0;
  const controller = createActivityController({
    get: async () => reply('invalid!'), patch: async () => { writes++; },
  }, () => {});
  await assert.rejects(controller.toggle());
  assert.equal(writes, 0);
});

test('long unknown status fields survive length boundaries', () => {
  const status = [162, 6, 144, 3, ...Array(400).fill(120)];
  const original = encoded([90, 148, 3, ...status]);
  const patched = activityPatch(readActivity(original), false);
  assert.deepEqual(decodeBase64(patched.settings), [90, 150, 3, ...status, 26, 0]);
});

test('loading never changes the account and a click uses freshly fetched status', async () => {
  let writes = 0, value = encoded([90, 2, 26, 0]);
  const controller = createActivityController({
    get: async () => reply(value),
    patch: async (_, body) => { writes++; value = body.settings; return reply(value); },
  }, () => {});
  await controller.refresh();
  assert.equal(writes, 0);
  value = encoded([90, 4, 26, 2, 8, 1]);
  await controller.toggle();
  assert.equal(writes, 1);
  assert.equal(readActivity(value).enabled, false);
});

test('rapid repeated clicks do not queue multiple changes', async () => {
  let finish, writes = 0;
  const controller = createActivityController({
    get: () => new Promise(resolve => { finish = resolve; }),
    patch: async (_, body) => { writes++; return reply(body.settings); },
  }, () => {});
  const first = controller.toggle();
  await controller.toggle();
  finish(reply(''));
  await first;
  assert.equal(writes, 1);
});

test('version conflicts and HTTP errors never report successful changes', async () => {
  for (const response of [reply('', { out_of_date: true }), { ok: false, status: 429 }]) {
    let last;
    const controller = createActivityController({ get: async () => reply(''), patch: async () => response }, state => { last = state; });
    await assert.rejects(controller.toggle());
    assert.deepEqual(last, { enabled: true, busy: false });
  }
});

test('unloading while reading prevents a queued settings write', async () => {
  let finish, writes = 0;
  const controller = createActivityController({
    get: () => new Promise(resolve => { finish = resolve; }),
    patch: async () => { writes++; },
  }, () => {});
  const running = controller.toggle();
  controller.dispose(); finish(reply('')); await running;
  assert.equal(writes, 0);
});
