// Recorrido automático de la versión web de la campana, con capturas y FPS.
//   CHROME_PATH="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" node web-campana/tests/recorrido.mjs
// Variables: MISIONES (ids separados por comas, o "todas"), BASE_URL (http://127.0.0.1:5180/), CALIDAD (media), ANCHO×ALTO (1920×1080), SALIDA (test-results/campana-web).
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const base = process.env.BASE_URL || 'http://127.0.0.1:5180/';
const calidad = process.env.CALIDAD || 'media';
const [ancho, alto] = (process.env.TAMANO || '1920x1080').split('x').map(Number);
const salida = process.env.SALIDA || 'test-results/campana-web';
mkdirSync(salida, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: process.env.VISIBLE ? false : true,
  args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--disable-frame-rate-limit', '--disable-gpu-vsync'],
});
const page = await browser.newPage({ viewport: { width: ancho, height: alto }, deviceScaleFactor: 1 });
const errores = [];
page.on('pageerror', e => errores.push(e.message));
page.on('console', m => { if (m.type() === 'error') errores.push(m.text()); });
page.setDefaultTimeout(900000);
try {
  await page.goto(`${base}?recorrido=${process.env.MISIONES || "cloruro-plata"}&calidad=${calidad}`);
  const gpu = await page.evaluate(() => { const gl = document.createElement('canvas').getContext('webgl2'); const e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); });
  console.log('GPU:', gpu);
  const vistos = new Set();
  for (;;) {
    const estado = await page.evaluate(() => ({ hito: window.__campana?.hito, fin: window.__campana?.recorrido }));
    if (estado.hito && !vistos.has(estado.hito)) {
      vistos.add(estado.hito);
      await page.screenshot({ path: join(salida, `${calidad}_${estado.hito}.png`) });
      console.log('captura', estado.hito);
    }
    if (estado.fin) { console.log(JSON.stringify(estado.fin, null, 1)); writeFileSync(join(salida, `${calidad}_resultado.json`), JSON.stringify({ gpu, ancho, alto, calidad, ...estado.fin, errores }, null, 1)); break; }
    await page.waitForTimeout(100);
  }
} finally {
  if (errores.length) console.log('ERRORES', errores);
  await browser.close();
}
