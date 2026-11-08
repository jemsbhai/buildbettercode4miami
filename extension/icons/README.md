# Tidepath extension icons

The original Tidepath mark is shared with the repository's Google Sheets add-on listing artwork. `icon.svg` is its editable source; the PNG files are transparent exports at Chrome's 16, 32, 48 and 128 pixel sizes. Only the PNGs are included in extension packages.

The source was copied from `integrations/google-sheets-addon/listing/icon.svg` in the existing add-on checkout without modifying that checkout. No third-party logo or Google branding is used.

To regenerate with the already installed `sharp` package, run from the repository root using the pinned Node runtime:

```js
import sharp from "sharp";
for (const size of [16, 32, 48, 128]) {
  await sharp("extension/icons/icon.svg").resize(size, size).png().toFile(`extension/icons/icon-${size}.png`);
}
```

These are icons, not product screenshots or evidence of store approval.
