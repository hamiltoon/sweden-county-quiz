// Renderar public/icons/icon.svg till PNG-ikoner med Playwright (Chromium).
// Kör med PLAYWRIGHT_PKG=<sökväg> om playwright inte är installerat lokalt.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PKG ?? 'playwright');
import { readFileSync, writeFileSync } from 'node:fs';

const svg = readFileSync(new URL('../public/icons/icon.svg', import.meta.url), 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();

async function render(size, maskable, out) {
  // Maskable: lägg symbolen i mitten på en fylld bakgrund utan rundade hörn.
  const inner = maskable ? svg.replace(/rx="96"/, 'rx="0"').replace(/viewBox="0 0 512 512"/, 'viewBox="-51 -51 614 614"') : svg;
  const html = `<html><body style="margin:0;background:${maskable ? '#0f3b6b' : 'transparent'}">${inner.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`;
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(html);
  const buf = await page.screenshot({ omitBackground: !maskable, clip: { x: 0, y: 0, width: size, height: size } });
  writeFileSync(new URL(`../public/icons/${out}`, import.meta.url), buf);
  console.log('wrote', out, buf.length, 'bytes');
}

await render(192, false, 'icon-192.png');
await render(512, false, 'icon-512.png');
await render(512, true, 'icon-512-maskable.png');
await browser.close();
