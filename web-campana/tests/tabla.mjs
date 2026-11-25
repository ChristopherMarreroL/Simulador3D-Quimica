// Comprueba la tabla periódica interactiva en ordenador (E sobre el póster y tecla T) y en móvil emulado (USAR):
// 118 elementos, ficha del elemento elegido con los reactivos del laboratorio que lo contienen, y búsqueda.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE_URL || 'http://127.0.0.1:5180/';
const salida = process.env.SALIDA || 'test-results/campana-web/tabla';
mkdirSync(salida, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const apuntar = page => page.evaluate(() => { const c = window.__campana; c.jugador.colocar(2.05, 7.2); c.jugador.mirarA(c.objetos.centro('amb:tabla')); });
const leer = page => page.evaluate(() => ({
  visible: !document.querySelector('[data-k=tabla]').hidden,
  celdas: document.querySelectorAll('.tp-celda').length,
  elegido: document.querySelector('.tp-ficha h3')?.textContent ?? '',
  enLab: [...document.querySelectorAll('.tp-ficha .en-lab li')].map(l => l.textContent.trim()),
}));
const resultado = {};
{
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const errores = []; page.on('pageerror', e => errores.push(e.message));
  await page.goto(base);
  await page.getByRole('button', { name: 'Entrar al laboratorio' }).click({ timeout: 180000 });
  await page.waitForTimeout(500);
  await apuntar(page); await page.waitForTimeout(400);
  await page.screenshot({ path: `${salida}/poster.png` });
  const objetivo = await page.evaluate(() => window.__campana.objetivo());
  await page.keyboard.press('KeyE'); await page.waitForTimeout(400);
  const alAbrir = await leer(page);
  await page.locator('.tp-celda[data-n="47"]').click();
  const plata = await leer(page);
  await page.screenshot({ path: `${salida}/ordenador.png` });
  await page.locator('[data-tp=buscar]').fill('oro'); await page.waitForTimeout(200);
  const oro = await leer(page);
  const apagadas = await page.evaluate(() => document.querySelectorAll('.tp-celda.apagada').length);
  await page.locator('[data-tp=buscar]').fill('');
  await page.locator('[data-tp=modo]').selectOption('electronegatividad'); await page.waitForTimeout(200);
  await page.screenshot({ path: `${salida}/ordenador_electronegatividad.png` });
  await page.locator('[data-tp=cerrar]').click(); await page.waitForTimeout(400);
  const capturado = await page.evaluate(() => !!document.pointerLockElement);
  await page.keyboard.press('KeyT'); await page.waitForTimeout(400);
  resultado.ordenador = { objetivo, alAbrir, plata, oro, apagadasAlBuscar: apagadas, capturadoAlVolver: capturado, conT: (await leer(page)).visible, errores };
  await page.close();
}
{
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errores = []; page.on('pageerror', e => errores.push(e.message));
  await page.goto(base);
  await page.getByRole('button', { name: 'Entrar al laboratorio' }).tap({ timeout: 180000 });
  await page.waitForTimeout(500);
  await apuntar(page); await page.waitForTimeout(400);
  await page.locator('[data-t=usar]').tap(); await page.waitForTimeout(600);
  const alAbrir = await leer(page);
  await page.locator('.tp-celda[data-n="29"]').tap(); await page.waitForTimeout(200);
  const cobre = await leer(page);
  await page.screenshot({ path: `${salida}/movil.png` });
  await page.locator('[data-tp=cerrar]').tap(); await page.waitForTimeout(400);
  resultado.movil = { alAbrir, cobre, activoAlVolver: await page.evaluate(() => window.__campana.jugador.activo), errores };
  await ctx.close();
}
console.log(JSON.stringify(resultado, null, 1));
await browser.close();
