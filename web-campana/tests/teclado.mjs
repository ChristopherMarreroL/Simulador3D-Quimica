// Comprueba la entrada real: botón de inicio, captura del puntero, WASD, E con el teclado sobre el tablero,
// elegir una misión con el ratón y pausa. Esc lo gestiona el navegador (no llega desde Playwright): la pausa se
// prueba con P, que hace lo mismo.
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errores = []; page.on('pageerror', e => errores.push(e.message));
await page.goto(process.env.BASE_URL || 'http://127.0.0.1:5180/');
await page.getByRole('button', { name: 'Entrar al laboratorio' }).click({ timeout: 120000 });
await page.waitForTimeout(500);
const captura = await page.evaluate(() => !!document.pointerLockElement);
const p0 = await page.evaluate(() => window.__campana.jugador.camara.position.toArray());
await page.keyboard.down('KeyW'); await page.waitForTimeout(1200); await page.keyboard.up('KeyW');
const p1 = await page.evaluate(() => window.__campana.jugador.camara.position.toArray());
await page.evaluate(() => { const j = window.__campana.jugador; j.colocar(5.1, 1.0); j.mirarA(window.__campana.objetos.centro('recipe-board')); });
await page.waitForTimeout(400);
await page.keyboard.press('KeyE'); await page.waitForTimeout(400);
const tablero = await page.evaluate(() => !document.querySelector('[data-k=misiones]').hidden);
await page.locator('[data-mision="volcan"]').click(); await page.waitForTimeout(400);
const mision = await page.evaluate(() => window.__campana.useHood.getState().recipe?.id);
const recapturado = await page.evaluate(() => !!document.pointerLockElement);
await page.keyboard.press('KeyM'); await page.waitForTimeout(300);
const tableroConM = await page.evaluate(() => !document.querySelector('[data-k=misiones]').hidden);
await page.locator('[data-mision="libre"]').click(); await page.waitForTimeout(300);
const modo = await page.evaluate(() => window.__campana.partida.modo);
await page.keyboard.press('KeyP'); await page.waitForTimeout(300);
const pausa = await page.evaluate(() => !document.querySelector('[data-k=pausa]').hidden);
console.log(JSON.stringify({ captura, avanzo: Math.hypot(p1[0] - p0[0], p1[2] - p0[2]).toFixed(2), tablero, mision, recapturado, tableroConM, modo, pausa, errores }));
await browser.close();
