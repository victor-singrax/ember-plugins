# ember-plugins
A collection of plugins for Discord Phoenix, adding features, customization and quality-of-life improvements.

## Game Activity Toggle

Adds a native controller button immediately before the microphone in the desktop account panel. It uses Discord’s controller asset, a transparent background, a 20 px icon and a compact 32 px hit area. The controller and slash turn red when sharing is disabled.

The icon responds immediately to clicks while settings save in the background. Repeated clicks keep the latest choice without overlapping writes. A failed save restores the confirmed state and shows an error.

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

## TypeScript development

Plugin sources live in `plugins/<name>/index.ts`. Shared modules are TypeScript too. The build runs strict type checking against the vendored Solaris declarations in `types/phoenix.d.ts`, then esbuild produces standalone `dist/<name>.js` bundles for QuickJS. No TypeScript runtime, Node.js or browser globals are needed in Discord.

Run `npm run typecheck` for type errors, or `npm test` to type-check, build both plugins and run the behavior tests against compiled modules and bundles. Generated test modules live in `.test-build/` and are ignored by Git.

The TypeScript conversion does not repair Double Click Voice's native Rust hook; that plugin still needs its separate runtime fix.

## Volume Booster

Raises the native per-user voice volume slider maximum from 200% to 400%. The plugin requests a Solaris runtime extension; disabling or unloading it restores the native 200% limit. Requires Solaris on Windows x64 and a Phoenix build with the supported slider signature.
