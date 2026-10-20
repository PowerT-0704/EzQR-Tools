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
image decoding uses the separate production dependency documented below.

## Other dependencies

Electron, React, React DOM, fflate, and fast-xml-parser are used under their
respective open-source licenses. The resolved dependency versions are locked
in `package-lock.json`.


## Local QR decoder

- Package: `zxing-wasm@3.1.6`, using the `reader` entry and public reader WASM export.
- Project: https://github.com/Sec-ant/zxing-wasm
- JavaScript/TypeScript license: MIT, Copyright (c) 2023 Ze-Zheng Wu.
- ZXing-C++ and ZXingWasm C++ wrapper: Apache-2.0.
- Pinned ZXing-C++ commit: `2c3dcfeffa7878950a58c1703c86774a428b0c91`.
- Upstream also includes Zint under BSD-3-Clause for writing barcodes. The package
  includes its writer assets, although this app only calls the reader API.
- Reader WASM SHA-256: `5003fb4b88c4fbd1fd518a2fd8c8ad365c519e183a08c03a322dddfea3cea84e`.

The binary is loaded from the installed package, never a CDN. Package license
texts are preserved in ASAR. Full additional upstream license texts are shipped
in `resources/licenses/` (also copied beside the packaged ASAR).
