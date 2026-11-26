// @description Raises the per-user voice volume slider limit from 200% to 400%.
// @version 0.1.0
// @author victor-singrax

if (typeof phoenix.ui.setUserVolumeLimit !== 'function') {
  throw new Error('Volume Booster requires the Solaris runtime extension for the native voice slider.');
}

const removeVolumeLimit = phoenix.ui.setUserVolumeLimit(400);
phoenix.onUnload(removeVolumeLimit);
phoenix.log.info('Volume Booster enabled: per-user voice volume limit is 400%');
