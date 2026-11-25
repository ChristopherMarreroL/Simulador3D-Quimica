// Comprueba el cuaderno de laboratorio en ordenador (tecla N) y en móvil emulado (botón «Cuaderno»): se abre, lista
// el ensayo anotado explicado en palabras (qué pasó, peligro, problema, utilidad y cada sustancia por separado, con los
// cálculos plegados), guarda la anotación y la conserva; y las pestañas de consulta de mezclas y fichas de sustancias.
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
  apartados: [...document.querySelectorAll('[data-k=listaCuaderno] article:first-of-type h5')].map(h => h.childNodes[0].textContent.trim()),
  riesgo: document.querySelector('[data-k=listaCuaderno] article .riesgo .sello')?.textContent ?? '',
  sustancias: [...document.querySelectorAll('[data-k=listaCuaderno] article:first-of-type .sust h6')].map(h => h.childNodes[0].textContent.trim()),
  calculosPlegados: !document.querySelector('[data-k=listaCuaderno] article details:not(.separado)')?.open,
}));
// Pestañas: consulta de cualquier mezcla y ficha de cada sustancia.
const pestanas = async (page, pulsar) => {
  const r = {};
  await pulsar(page.locator('[data-p=consulta]')); await page.waitForTimeout(200);
  await page.locator('[data-c="0"]').selectOption('pbno3'); await page.locator('[data-c="1"]').selectOption('ki'); await page.waitForTimeout(200);
  r.consulta = await page.evaluate(() => ({ titulo: document.querySelector('.lista.consulta article b')?.textContent, riesgo: document.querySelector('.lista.consulta .riesgo .sello')?.textContent, desecho: document.querySelector('.lista.consulta section:nth-of-type(3)')?.textContent.toLowerCase().includes('nunca al fregadero') }));
  await page.screenshot({ path: `${salida}/${r.movil ? 'movil' : 'x'}_consulta_${page.viewportSize().width}.png` });
  await pulsar(page.locator('[data-p=sustancias]')); await page.waitForTimeout(300);
  r.fichas = await page.locator('.lista.sustancias article').count();
  await page.screenshot({ path: `${salida}/sustancias_${page.viewportSize().width}.png` });
  await pulsar(page.locator('[data-par="cu,agno3"]')); await page.waitForTimeout(300);
  r.trasChip = await page.evaluate(() => ({ pestana: document.querySelector('.pestanas .activa')?.textContent, titulo: document.querySelector('.lista.consulta article b')?.textContent }));
  await pulsar(page.locator('[data-p=ensayos]')); await page.waitForTimeout(200);
  return r;
};
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
  await page.screenshot({ path: `${salida}/ordenador_resumen.png` });
  await page.locator('[data-k=listaCuaderno] textarea').first().fill('Precipitado blanco lechoso al añadir el cloruro.');
  await page.screenshot({ path: `${salida}/ordenador.png` });
  const fichas = await pestanas(page, l => l.click());
  await page.locator('[data-k=listaCuaderno] textarea').first().fill('Precipitado blanco lechoso al añadir el cloruro.');
  await page.getByRole('button', { name: 'Volver al laboratorio' }).first().click(); await page.waitForTimeout(400);
  const capturado = await page.evaluate(() => !!document.pointerLockElement);
  await page.keyboard.press('KeyN'); await page.waitForTimeout(400);
  resultado.ordenador = { adiciones, abierto, fichas, capturadoAlVolver: capturado, alReabrir: await leer(page), errores };
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
  const fichas = await pestanas(page, l => l.tap());
  await page.locator('[data-k=listaCuaderno] textarea').first().fill('Nota desde el móvil.');
  await page.getByRole('button', { name: 'Volver al laboratorio' }).first().tap(); await page.waitForTimeout(400);
  const activo = await page.evaluate(() => window.__campana.jugador.activo);
  await page.locator('[data-t=cuaderno]').tap(); await page.waitForTimeout(400);
  resultado.movil = { adiciones, abierto, fichas, activoAlVolver: activo, alReabrir: await leer(page), errores };
  await ctx.close();
}
console.log(JSON.stringify(resultado, null, 1));
await browser.close();
