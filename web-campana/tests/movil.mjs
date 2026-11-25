// Prueba de la versión móvil con emulación de teléfono (pantalla táctil, 844 × 390, horizontal): toques reales por
// (TAMANO=760x300 imita un iPhone en Safari con la barra del navegador). CDP sobre la palanca, el arrastre para mirar y los botones USAR y MANTENER. Guarda capturas en SALIDA.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const salida = process.env.SALIDA || 'test-results/campana-web/movil';
mkdirSync(salida, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: Number((process.env.TAMANO || '844x390').split('x')[0]), height: Number((process.env.TAMANO || '844x390').split('x')[1]) }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36' });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
const errores = []; page.on('pageerror', e => errores.push(e.message)); page.on('console', m => { if (m.type() === 'error') errores.push(m.text()); });
const toque = (type, puntos) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: puntos });
const centro = async sel => { const b = await page.locator(sel).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
const foto = n => page.screenshot({ path: `${salida}/${n}.png` });
const apuntar = (x, z, id) => page.evaluate(({ x, z, id }) => { const c = window.__campana; c.jugador.colocar(x, z); c.jugador.mirarA(c.objetos.centro(id)); }, { x, z, id });
const usar = async () => { await page.locator('[data-t=usar]').tap(); await page.waitForTimeout(300); };
await page.goto(process.env.BASE_URL || 'http://127.0.0.1:5180/');
await page.waitForFunction(() => window.__campana, null, { timeout: 180000 });
const r = { tactil: await page.evaluate(() => document.body.classList.contains('tactil')), calidad: await page.evaluate(() => window.__campana.calidad) };
await foto('01_portada');
await page.getByRole('button', { name: 'Entrar al laboratorio' }).tap();
await page.waitForTimeout(600);
r.activo = await page.evaluate(() => window.__campana.jugador.activo);
await foto('02_entrada');
// Palanca: empujar hacia delante 1,2 s.
const p0 = await page.evaluate(() => window.__campana.jugador.camara.position.toArray());
const pal = await centro('[data-t=palanca]');
await toque('touchStart', [{ x: pal.x, y: pal.y, id: 1 }]); await toque('touchMove', [{ x: pal.x, y: pal.y - 45, id: 1 }]);
await page.waitForTimeout(1200); await toque('touchEnd', []);
const p1 = await page.evaluate(() => window.__campana.jugador.camara.position.toArray());
r.avanzo = +Math.hypot(p1[0] - p0[0], p1[2] - p0[2]).toFixed(2);
r.palancaSuelta = await page.evaluate(() => window.__campana.jugador.palanca.length() === 0);
// Arrastrar para mirar.
const g0 = await page.evaluate(() => window.__campana.jugador.camara.rotation.y);
await toque('touchStart', [{ x: 420, y: 200, id: 2 }]); await toque('touchMove', [{ x: 520, y: 200, id: 2 }]); await toque('touchEnd', []);
await page.waitForTimeout(200);
r.giro = +Math.abs(await page.evaluate(() => window.__campana.jugador.camara.rotation.y) - g0).toFixed(2);
// Protección, tablero y misión con los botones.
await apuntar(5.0, 7.2, 'ppe-goggles'); await page.waitForTimeout(300); await usar();
await apuntar(5.0, 7.7, 'ppe-gloves'); await page.waitForTimeout(300); await usar();
await apuntar(5.1, 1.0, 'recipe-board'); await page.waitForTimeout(300); await foto('03_guia_tablero'); await usar();
r.tablero = await page.evaluate(() => !document.querySelector('[data-k=misiones]').hidden);
await page.waitForTimeout(500); await foto('04_misiones');
await page.locator('[data-mision="cloruro-plata"]').tap(); await page.waitForTimeout(400);
r.mision = await page.evaluate(() => window.__campana.useHood.getState().recipe?.id);
r.activoTrasElegir = await page.evaluate(() => window.__campana.jugador.activo);
const bot = await page.evaluate(() => { const c = window.__campana.objetos.centro('reagent:agno3'); return { x: c.x, z: c.z }; });
await apuntar(bot.x, 0.98, 'reagent:agno3'); await page.waitForTimeout(300); await foto('05_frasco'); await usar();
r.enMano = await page.evaluate(() => window.__campana.useHood.getState().heldIn('right'));
// Mantener: llenar la probeta hasta 20 mL manteniendo el dedo.
await apuntar(-0.62, 0.98, 'hood-cylinder'); await page.waitForTimeout(300);
const ver = await centro('[data-t=verter]');
await toque('touchStart', [{ x: ver.x, y: ver.y, id: 3 }]);
await page.waitForFunction(() => window.__campana.useHood.getState().cylinder.ml >= 12, null, { timeout: 15000 }).catch(() => {});
await foto('06_llenando');
await page.waitForFunction(() => window.__campana.useHood.getState().cylinder.ml >= 20, null, { timeout: 15000 }).catch(() => {});
await toque('touchEnd', []); await page.waitForTimeout(300);
r.mlProbeta = +(await page.evaluate(() => window.__campana.useHood.getState().cylinder.ml)).toFixed(1);
await usar(); await page.waitForTimeout(2200);
r.enMatraz = await page.evaluate(() => window.__campana.useHood.getState().mixture.additions.map(a => `${a.reagent} ${a.amount}`));
await foto('07_vertido');
await page.locator('[data-t=pausa]').tap(); await page.waitForTimeout(300);
r.pausa = await page.evaluate(() => !document.querySelector('[data-k=pausa]').hidden);
await foto('08_pausa');
console.log(JSON.stringify({ ...r, errores }));
await browser.close();
