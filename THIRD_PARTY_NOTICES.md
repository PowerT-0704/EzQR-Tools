# Third-Party Notices

## Plasma UI

- Package: `@cruxgarden/plasma-ui@0.8.0`
- Project: https://github.com/CruxGarden/plasma-ui
- License: MIT
- Copyright: The Keeper and Plasma UI contributors

Plasma UI is used as an npm dependency and provides the WebGL liquid-glass
surfaces, components, and rendering runtime used by this application.

## Local QR encoder

- Package: `qrcode@1.5.4`
- Project: https://github.com/soldair/node-qrcode
- License: MIT
- Copyright: Ryan Day and contributors

qrcode supplies the local QR matrix encoder and PNG output. Its production
dependencies include pngjs (MIT), dijkstrajs (MIT), and yargs (MIT), together
with their transitive dependencies. Full license texts ship with the packages.

## Independent test decoder

- Package: `jsqr@1.4.0`
- Project: https://github.com/cozmo/jsQR
- License: Apache-2.0

jsQR and the separately declared development copy of pngjs are used only for
offline verification; they are not part of the application's decoder. Local
image decoding is planned for v7.2.

## Other dependencies

Electron, React, React DOM, fflate, and fast-xml-parser are used under their
respective open-source licenses. The resolved dependency versions are locked
in `package-lock.json`.

