// @description Double-click a voice channel to join it. Requires Solaris on Windows.
// @version 0.1.0
// @author victor-singrax

if (typeof phoenix.ui.requireVoiceDoubleClick !== 'function') {
  throw new Error('Double Click Voice requires the current Solaris runtime.');
}
const remove = phoenix.ui.requireVoiceDoubleClick();
phoenix.onUnload(remove);
