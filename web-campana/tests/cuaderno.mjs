// Comprueba el cuaderno de laboratorio en ordenador (tecla N) y en móvil emulado (botón «Cuaderno»): se abre, lista
// el ensayo anotado con su resultado principal, guarda la anotación escrita y la conserva al volver a abrirlo.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE_URL || 'http://127.0.0.1:5180/';
const salida = process.env.SALIDA || 'test-results/campana-web/cuaderno';
mkdirSync(salida, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });

// Mezcla de prueba por la capa de estado (20 mL de AgNO3 + 5 mL de NaCl), como la deja una misión.
const mezclar = page => page.evaluate(async () => {
  const { useHood, useLab } = window.__campana;
  useHood.setState({ records: [] });
  useLab.setState({ ppe: { goggles: true, gloves: true } });
  for (const [id, ml] of [['agno3', 20], ['nacl', 5]]) {
    useHood.setState({ places: { ...useHood.getState().places, [id]: 'hood' } });
    useHood.getState().pour(id, ml);
    await new Promise(r => setTimeout(r, 1800));
  }
  return useHood.getState().mixture.additions.length;
});
const leer = page => page.evaluate(() => ({
  visible: !document.querySelector('[data-k=cuaderno]').hidden,
  ensayos: document.querySelectorAll('[data-k=listaCuaderno] article').length,
  principal: document.querySelector('[data-k=listaCuaderno] article b')?.textContent ?? '',
  nota: document.querySelector('[data-k=listaCuaderno] textarea')?.value ?? null,
  guardados: window.__campana.useHood.getState().records.length,
}));
const resultado = {};

{ // Ordenador: tecla N.
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const errores = []; page.on('pageerror', e => errores.push(e.message));
  await page.goto(base);
  await page.getByRole('button', { name: 'Entrar al laboratorio' }).click({ timeout: 180000 });
  await page.waitForTimeout(500);
  const adiciones = await mezclar(page);
  await page.keyboard.press('KeyN'); await page.waitForTimeout(400);
  const abierto = await leer(page);
  await page.locator('[data-k=listaCuaderno] textarea').first().fill('Precipitado blanco lechoso al añadir el cloruro.');
  await page.screenshot({ path: `${salida}/ordenador.png` });
  await page.getByRole('button', { name: 'Volver al laboratorio' }).first().click(); await page.waitForTimeout(400);
  const capturado = await page.evaluate(() => !!document.pointerLockElement);
  await page.keyboard.press('KeyN'); await page.waitForTimeout(400);
  resultado.ordenador = { adiciones, abierto, capturadoAlVolver: capturado, alReabrir: await leer(page), errores };
  await page.close();
}
{ // Móvil emulado: botón «Cuaderno».
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errores = []; page.on('pageerror', e => errores.push(e.message));
  await page.goto(base);
  await page.getByRole('button', { name: 'Entrar al laboratorio' }).tap({ timeout: 180000 });
  await page.waitForTimeout(500);
  const adiciones = await mezclar(page);
  await page.locator('[data-t=cuaderno]').tap(); await page.waitForTimeout(400);
  const abierto = await leer(page);
  await page.locator('[data-k=listaCuaderno] textarea').first().fill('Nota desde el móvil.');
  await page.screenshot({ path: `${salida}/movil.png` });
  await page.getByRole('button', { name: 'Volver al laboratorio' }).first().tap(); await page.waitForTimeout(400);
  const activo = await page.evaluate(() => window.__campana.jugador.activo);
  await page.locator('[data-t=cuaderno]').tap(); await page.waitForTimeout(400);
  resultado.movil = { adiciones, abierto, activoAlVolver: activo, alReabrir: await leer(page), errores };
  await ctx.close();
}
console.log(JSON.stringify(resultado, null, 1));
await browser.close();
