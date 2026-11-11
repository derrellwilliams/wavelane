# Wavelane

**A Jellyfin movie and TV client for LG webOS TVs.** Part of the Wavetile family of Jellyfin apps, with the same look and feel.

Status: early development. Right now it is a setup-check app that installs on an LG TV and tests the pieces the real app depends on.

## Planned features
| Area | What |
|---|---|
| Library | Movies and TV shows from your Jellyfin server, with search, sort and filters |
| Player | Direct play, resume, skip intro and credits, next episode, audio and subtitle switching |
| Subtitles | Follows your Jellyfin subtitle settings, drawn on the TV so switching never restarts the video; search and download missing subtitles |

## Build
Needs Node 20.19+ or 22.12+.

```
npm install
npm run typecheck
npm test
npm run build
```

## Install on an LG TV
Needs a free LG developer account, the Developer Mode app on the TV (with Key Server on), and LG's CLI: `npm i -g @webos-tools/cli`.

```
ares-setup-device
ares-novacom --device TV --getkey
ares-package dist -o build
ares-install --device TV build/com.derrellwilliams.wavelane_0.1.0_all.ipk
ares-launch --device TV com.derrellwilliams.wavelane
```

Developer Mode sessions expire; press Extend in the Developer Mode app, or the TV removes the app.

## License
Wavelane is free and open source under the [Mozilla Public License 2.0](LICENSE).

Not covered by that license:
- Fonts: [Inter](https://rsms.me/inter) and [Geist Mono](https://vercel.com/font) are under the SIL Open Font License (license files sit next to the fonts in `src/design/fonts`).

Wavelane is an independent app, not affiliated with the Jellyfin project or LG.
