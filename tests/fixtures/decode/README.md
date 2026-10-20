# Local decode fixtures

Fixed test images generated with qrcode@1.5.4 (320 px, version 5, L correction, 4 modules)
and Pillow 12.3.0. No real user images are used here.

- `base.png`, JPEG, BMP, WebP and animated GIF contain exactly
  `  易码本地解析 🧪\nhttps://example.com/offline\n  ` (literal spaces, actual LF).
- The GIF's second frame contains `second QR`; tests require the first frame.
- PNG variants cover 96 px, rotations, inversion, transparent white pixels and offset.
- `multiple.png` contains base text, `second QR`, `third QR`, and base text again
  in row order, preserving duplicate results.
- `capacity.png` contains 950 copies of 汉 encoded at 1024 px, L correction, 8 modules. Rebuilding
  at M must fail without silently changing the chosen correction level.
- Other images exercise blank, invalid, side-limit and area-limit failures.

Unit tests exercise the real packaged reader binary. Electron tests exercise the
actual Chromium normalization pipeline for all input formats and transparency.
