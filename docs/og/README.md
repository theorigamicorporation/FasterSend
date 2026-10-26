# Social preview image

`og-image.html` is the source for `public/og-image.png` (1200x630), used for the
`og:image` and `twitter:image` tags. It loads Inter from `node_modules`, so run
`yarn install` first, then screenshot the page at 1200x630 with any headless
Chromium, for example:

```sh
chromium --headless --hide-scrollbars --window-size=1200,630 \
  --screenshot=public/og-image.png docs/og/og-image.html
```
