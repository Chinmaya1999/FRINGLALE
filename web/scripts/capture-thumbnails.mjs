// Renders every active design in the 3D studio and saves /public/designs/<slug>.png for catalogue cards.
// Needs API + web running and a Chrome: CHROME_PATH=... node scripts/capture-thumbnails.mjs  (npm i -D puppeteer-core)
import puppeteer from 'puppeteer-core';
const base = process.env.WEB_URL || 'http://localhost:3000';
const api = process.env.API_URL || 'http://localhost:4000';
const only = process.argv.slice(2);
const { items: all } = await (await fetch(`${api}/api/designs?limit=48`)).json();
const items = only.length ? all.filter((d) => only.includes(d.slug)) : all;
const b = await puppeteer.launch({ executablePath: process.env.CHROME_PATH, headless: 'shell', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
for (const d of items) {
  const p = await b.newPage();
  await p.setViewport({ width: 800, height: 800 });
  await p.goto(`${base}/preview/${d.slug}`, { waitUntil: 'networkidle2', timeout: 90000 });
  await p.waitForSelector('#shot[data-ready=true]', { timeout: 60000 });
  await p.addStyleTag({ content: 'header, nextjs-portal { display: none !important }' });
  await new Promise((r) => setTimeout(r, 800));
  await (await p.$('#shot')).screenshot({ path: `public/designs/${d.slug}.png` });
  console.log('captured', d.slug);
  await p.close();
}
await b.close();
