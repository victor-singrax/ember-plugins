import { activityPatch, readActivity } from './proto.js';

const path = '/users/@me/settings-proto/1';

export function createActivityController(discord, changed) {
  let disposed = false, busy = false, enabled = null;
  const emit = () => { if (!disposed) changed({ enabled, busy }); };
  async function read() {
    const response = await discord.get(path);
    if (!response.ok) throw new Error(`Reading activity preference failed (HTTP ${response.status})`);
    return readActivity(response.json().settings);
  }
  return {
    observe(settings) {
      if (disposed || busy) return;
      enabled = readActivity(settings).enabled;
      emit();
    },
    async refresh() {
      if (disposed || busy) return;
      busy = true; emit();
      try { enabled = (await read()).enabled; }
      finally { busy = false; emit(); }
    },
    async toggle() {
      if (disposed || busy) return;
      busy = true; emit();
      try {
        // Always refresh before changing it: another client may have updated status.
        const snapshot = await read();
        enabled = snapshot.enabled;
        if (disposed) return;
        const response = await discord.patch(path, activityPatch(snapshot, !snapshot.enabled));
        if (!response.ok) throw new Error(`Changing activity preference failed (HTTP ${response.status})`);
        const data = response.json();
        if (data.out_of_date) throw new Error('Your settings changed elsewhere. Click again to retry.');
        // Confirm the server's value instead of showing an optimistic success.
        enabled = readActivity(data.settings).enabled;
        if (enabled === snapshot.enabled) throw new Error('Discord did not apply the activity change');
      } finally { busy = false; emit(); }
    },
    dispose() { disposed = true; },
  };
}
