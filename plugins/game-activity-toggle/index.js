// @description Toggle game activity sharing from the desktop account panel. Requires Solaris.
// @version 0.1.2
// @author victor-singrax

import { createActivityController } from './controller.js';

if (typeof phoenix.ui.addUserPanelButton !== 'function') {
  throw new Error('Game Activity Toggle requires the Ember Sunbird runtime extension. See the repository README.');
}

let button, sessionWatch, reported;
let synchronized = false;
const controller = createActivityController(phoenix.discord, ({ enabled, busy }) => {
  if (enabled !== null && !synchronized) {
    synchronized = true;
    sessionWatch?.();
    phoenix.log.info('Game Activity Toggle ready');
  }
  button?.update({ active: enabled !== false, busy: enabled === null && busy });
});
function report(error) {
  if (error === reported) return;
  reported = error;
  phoenix.log.error('Game Activity Toggle:', error.message);
  phoenix.ui.toast(error.message);
}

button = phoenix.ui.addUserPanelButton({
  icon: 'game-controller', active: false, busy: true,
  onPress() { void controller.toggle().catch(report); },
});
const refresh = () => { void controller.refresh().catch(report); };
// The runtime starts before Phoenix has captured its first authenticated request.
sessionWatch = phoenix.discord.onResponse({}, () => { if (!synchronized) refresh(); });
void controller.refresh().catch(error => {
  if (!error.message.includes('no session')) report(error);
});
// A client/account change must never leave the previous account's value visible.
if (phoenix.gateway.ready) phoenix.on(phoenix.gateway.ready, refresh);
phoenix.discord.onResponse({ pathPrefix: '/users/@me/settings-proto/1' }, response => {
  if (response.status < 200 || response.status >= 300) return;
  try {
    const data = response.json();
    if (typeof data?.settings === 'string') controller.observe(data.settings);
  } catch { /* Ignore unrelated or malformed responses; clicks always read fresh settings. */ }
});
phoenix.onUnload(() => { controller.dispose(); button(); });
