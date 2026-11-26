# ember-plugins
A collection of plugins for Discord Phoenix, adding features, customization and quality-of-life improvements.

## Game Activity Toggle

Adds a native controller button immediately before the microphone in the desktop account panel. It uses Discord’s monochrome controller asset, a transparent background, a 20 px icon and a compact 32 px hit area. A red slash indicates that sharing is disabled. Pending requests ignore repeated presses.

Requires the current [Solaris runtime](https://github.com/victor-singrax/solaris) on Windows x64. Stock Sunbird does not expose the account-panel API. Unsupported Phoenix builds fail explicitly.

The plugin reads the current account preference before each change and preserves custom status, presence, expiration and unknown fields. Loading or unloading the plugin never changes activity sharing.

## Build and install

Requires Node.js:

```powershell
npm ci
npm test
npm run build
```

Open Discord through Solaris. In the native manager, use **Add plugin…** to select `dist/game-activity-toggle.js`, or run `scripts/install-plugin.ps1`. The standalone bundle works without Node.js or browser globals inside Discord.

The old runtime patch, runtime-build and shortcut scripts describe the historical text-glyph prototype. They do not provide the current native icon API; use Solaris for this version.

## Native API

```js
const remove = phoenix.ui.addUserPanelButton({
  icon: 'game-controller',
  active: true,
  busy: false,
  onPress() { /* handle a user click */ },
});
remove.update({ active: false, busy: false });
remove();
```

## Validation

Tests cover field preservation, malformed responses, concurrency, HTTP errors, version conflicts, unloading during a read and plugin lifecycle. Account-changing requests are mocked. Native appearance is checked in the running Windows client without changing the real sharing preference.

## Sources

- [Sunbird](https://github.com/sunbird-tools/sunbird), the upstream runtime and plugin API.
- [User settings protocol](https://github.com/discord-userdoccers/discord-protos/blob/master/discord_protos/discord_users/v1/PreloadedUserSettings.proto).

Independent project; not affiliated with Discord or Sunbird.
