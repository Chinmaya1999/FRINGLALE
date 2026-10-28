// Browser test for the 3D studio. Needs the API (:4000) and web app (:3000) running, a seeded DB,
// and a Chrome/Chromium: CHROME_PATH=/path/to/chrome node test/e2e/studio.e2e.mjs   (npm i -D puppeteer-core)
import puppeteer from 'puppeteer-core';

const exe = process.env.CHROME_PATH;
if (!exe) { console.error('Set CHROME_PATH'); process.exit(2); }
const base = process.env.WEB_URL || 'http://localhost:3000';
const GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'];
let fails = 0;
const ok = (n, c, x = '') => { console.log(`${c ? 'PASS' : 'FAIL'}  ${n} ${c ? '' : x}`); if (!c) fails++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (p, text) => p.evaluate((t) => [...document.querySelectorAll('button')].find((x) => x.textContent.includes(t))?.click(), text);
const text = (p, sel) => p.evaluate((s) => document.querySelector(s)?.textContent, sel);

let b = await puppeteer.launch({ executablePath: exe, headless: 'shell', args: GL });
let p = await b.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
await p.goto(`${base}/design?design=aurelia-solitaire-ring`, { waitUntil: 'networkidle2', timeout: 90000 });
await wait(4000);
ok('WebGL canvas renders', await p.evaluate(() => !!document.querySelector('canvas')));
ok('support badges tell the truth', /Real 3D model/.test(await text(p, '[data-testid=support-badges]')) && /CAD ready/.test(await text(p, '[data-testid=support-badges]')));
const before = await text(p, '[data-testid=live-price]');
await click(p, 'Platinum'); await wait(1500);
ok('price updates on metal change', before !== await text(p, '[data-testid=live-price]'));
ok('exploded control offered (model supports it)', await p.evaluate(() => [...document.querySelectorAll('button')].some((x) => x.textContent === 'Exploded')));
await click(p, 'Exploded'); await wait(800);
ok('component highlight chips appear when exploded', await p.evaluate(() => [...document.querySelectorAll('button')].some((x) => x.textContent === 'Prong head')));
// A design with no exploded-view support must NOT show the control.
await p.goto(`${base}/design?design=classic-gold-band`, { waitUntil: 'networkidle2' }); await wait(3500);
ok('no exploded control when unsupported', await p.evaluate(() => ![...document.querySelectorAll('button')].some((x) => x.textContent === 'Exploded')));
ok('parametric preview is disclosed as not final CAD', /not final CAD/i.test(await text(p, '[data-testid=support-badges]')));
await click(p, 'Hologram'); await wait(1500);
ok('hologram mode toggles without errors', await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent === 'Hologram')?.getAttribute('aria-pressed') === 'true'));
ok('no page errors', errs.length === 0, errs.join('|'));
await b.close();

b = await puppeteer.launch({ executablePath: exe, headless: 'shell', args: ['--disable-3d-apis', '--disable-gpu', '--no-sandbox'] });
p = await b.newPage();
await p.goto(`${base}/design?design=aurelia-solitaire-ring`, { waitUntil: 'networkidle2', timeout: 90000 }); await wait(2500);
ok('WebGL fallback shown, price still works', await p.evaluate(() => !!document.querySelector('[data-testid=webgl-fallback]')) && !!(await text(p, '[data-testid=live-price]')));
await b.close();

b = await puppeteer.launch({ executablePath: exe, headless: 'shell', args: GL });
p = await b.newPage();
await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
await p.goto(`${base}/design?design=aurelia-solitaire-ring`, { waitUntil: 'networkidle2', timeout: 90000 }); await wait(3000);
ok('reduced motion: no auto-rotate control', await p.evaluate(() => ![...document.querySelectorAll('button')].some((x) => x.textContent === 'Auto-rotate')));
await b.close();
process.exit(fails ? 1 : 0);
