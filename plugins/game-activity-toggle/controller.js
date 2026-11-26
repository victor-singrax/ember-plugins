import { activityPatch, readActivity } from './proto.js';

const path = '/users/@me/settings-proto/1';

export function createActivityController(discord, changed) {
  let disposed = false, busy = false, enabled = null, desired = null;
  let saving = null, revision = 0;
  const emit = () => { if (!disposed) changed({ enabled: desired ?? enabled, busy }); };
  async function read() {
    const response = await discord.get(path);
    if (!response.ok) throw new Error(`Reading activity preference failed (HTTP ${response.status})`);
    return readActivity(response.json().settings);
  }
  async function save() {
    let conflicts = 0;
    while (!disposed) {
      // Preserve the latest custom status and presence, even across queued clicks.
      const snapshot = await read();
      if (disposed) return;
      enabled = snapshot.enabled;
      if (desired === null) { desired = !enabled; emit(); }
      if (desired === enabled) return;
      const target = desired;
      const response = await discord.patch(path, activityPatch(snapshot, target));
      if (disposed) return;
      if (!response.ok) throw new Error(`Changing activity preference failed (HTTP ${response.status})`);
      const data = response.json();
      if (data.out_of_date) {
        if (++conflicts > 1) throw new Error('Your settings changed elsewhere. Click again to retry.');
        continue;
      }
      enabled = readActivity(data.settings).enabled;
      if (enabled !== target) throw new Error('Discord did not apply the activity change');
      conflicts = 0;
      if (desired === enabled) return;
    }
  }
  return {
    observe(settings) {
      if (disposed || busy) return;
      enabled = readActivity(settings).enabled;
      revision++; emit();
    },
    async refresh() {
      if (disposed || busy) return;
      const started = ++revision;
      busy = true; emit();
      try {
        const snapshot = await read();
        if (!disposed && started === revision) enabled = snapshot.enabled;
      } finally {
        if (started === revision) { busy = false; emit(); }
      }
    },
    toggle() {
      if (disposed) return Promise.resolve();
      if (saving) {
        if (desired !== null) { desired = !desired; emit(); }
        return saving;
      }
      revision++;
      busy = true;
      desired = enabled === null ? null : !enabled;
      emit();
      saving = save().finally(() => {
        saving = null; desired = null; busy = false; emit();
      });
      return saving;
    },
    dispose() { disposed = true; revision++; },
  };
}
