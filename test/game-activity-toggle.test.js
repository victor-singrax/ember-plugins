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

test('loading never changes the account and a click preserves the latest status', async () => {
  let writes = 0, value = encoded([90, 2, 26, 0]);
  const controller = createActivityController({
    get: async () => reply(value),
    patch: async (_, body) => { writes++; value = body.settings; return reply(value); },
  }, () => {});
  await controller.refresh();
  assert.equal(writes, 0);
  value = encoded([90, 5, 10, 1, 88, 26, 0]);
  await controller.toggle();
  assert.equal(writes, 1);
  assert.equal(readActivity(value).enabled, true);
  assert.deepEqual(readActivity(value).status.slice(0, 3), [10, 1, 88]);
});

test('clicks before the initial preference is known share one read', async () => {
  let finish, writes = 0;
  const controller = createActivityController({
    get: () => new Promise(resolve => { finish = resolve; }),
    patch: async (_, body) => { writes++; return reply(body.settings); },
  }, () => {});
  const first = controller.toggle();
  assert.equal(controller.toggle(), first);
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

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const settle = () => new Promise(resolve => setImmediate(resolve));

test('the icon updates before the settings read finishes and can cancel an unsent change', async () => {
  const reading = deferred();
  let last, writes = 0;
  const controller = createActivityController({
    get: () => reading.promise,
    patch: async () => { writes++; },
  }, state => { last = state; });
  controller.observe('');
  const first = controller.toggle();
  assert.deepEqual(last, { enabled: false, busy: true });
  assert.equal(controller.toggle(), first);
  assert.deepEqual(last, { enabled: true, busy: true });
  reading.resolve(reply(''));
  await first;
  assert.equal(writes, 0);
  assert.deepEqual(last, { enabled: true, busy: false });
});

test('clicks during a save coalesce to the latest choice without stale color flashes', async () => {
  const saving = deferred();
  let value = '', last;
  const targets = [];
  const controller = createActivityController({
    get: async () => reply(value),
    patch: async (_, body) => {
      targets.push(readActivity(body.settings).enabled);
      if (targets.length === 1) await saving.promise;
      value = body.settings;
      return reply(value);
    },
  }, state => { last = state; });
  controller.observe(value);
  const first = controller.toggle();
  await settle();
  controller.toggle(); controller.toggle(); controller.toggle();
  assert.deepEqual(last, { enabled: true, busy: true });
  controller.observe('WgIaAA=='); // An older external response must not overwrite the latest click.
  assert.equal(last.enabled, true);
  saving.resolve();
  await first;
  assert.deepEqual(targets, [false, true]);
  assert.deepEqual(last, { enabled: true, busy: false });
});

test('failed saves roll back the icon and leave the next click usable', async () => {
  const saving = deferred();
  let last, attempts = 0;
  const controller = createActivityController({
    get: async () => reply(''),
    patch: async (_, body) => {
      if (++attempts === 1) return saving.promise;
      return reply(body.settings);
    },
  }, state => { last = state; });
  controller.observe('');
  const first = controller.toggle();
  await settle();
  saving.reject(new Error('Connection lost'));
  await assert.rejects(first, /Connection lost/);
  assert.deepEqual(last, { enabled: true, busy: false });
  await controller.toggle();
  assert.deepEqual(last, { enabled: false, busy: false });
});

test('one version conflict refreshes preserved fields and retries the same choice', async () => {
  let value = '', writes = 0;
  const controller = createActivityController({
    get: async () => reply(value),
    patch: async (_, body) => {
      if (++writes === 1) {
        value = encoded([90, 3, 10, 1, 88]);
        return reply(value, { out_of_date: true });
      }
      value = body.settings;
      return reply(value);
    },
  }, () => {});
  controller.observe('');
  await controller.toggle();
  assert.equal(writes, 2);
  assert.deepEqual(readActivity(value).status.slice(0, 3), [10, 1, 88]);
  assert.equal(readActivity(value).enabled, false);
});

test('a slow background refresh cannot overwrite a newer completed click', async () => {
  const reading = deferred();
  let reads = 0, last;
  const controller = createActivityController({
    get: async () => ++reads === 1 ? reading.promise : reply(''),
    patch: async (_, body) => reply(body.settings),
  }, state => { last = state; });
  controller.observe('');
  const refresh = controller.refresh();
  await controller.toggle();
  reading.resolve(reply(''));
  await refresh;
  assert.deepEqual(last, { enabled: false, busy: false });
});
