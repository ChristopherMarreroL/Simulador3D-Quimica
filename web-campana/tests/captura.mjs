// Capturas de vistas fijas para ajustar la imagen: node web-campana/tests/captura.mjs "exposicion=1.6" nombre x,z,tx,ty,tz [...]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const [params, nombre, ...vistas] = process.argv.slice(2);
const salida = process.env.SALIDA || 'test-results/campana-web/vistas';
mkdirSync(salida, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on('pageerror', e => console.log('ERROR', e.message));
await page.goto(`${process.env.BASE_URL || 'http://127.0.0.1:5180/'}?${params}`);
await page.waitForFunction(() => window.__campana, null, { timeout: 120000 });
await page.evaluate(() => { document.querySelector('[data-k=portada]').hidden = true; document.getElementById('hud').classList.remove('en-pausa'); });
for (const [i, v] of vistas.entries()) {
  const [x, z, tx, ty, tz] = v.split(',').map(Number);
  await page.evaluate(({ x, z, tx, ty, tz }) => { const j = window.__campana.jugador; j.colocar(x, z); j.mirarA({ x: tx, y: ty, z: tz, clone() { return this; }, sub(p) { return { x: tx - p.x, y: ty - p.y, z: tz - p.z }; } }); }, { x, z, tx, ty, tz });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${salida}/${nombre}_${i}.png` });
}
await browser.close();
