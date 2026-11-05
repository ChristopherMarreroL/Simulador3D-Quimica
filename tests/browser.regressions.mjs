import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Users/chris/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe', headless: true, args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1640, height: 1080 } });
page.setDefaultTimeout(15000);
const errors = []; page.on('pageerror', e => errors.push(e.message));
const state = () => page.evaluate(() => { const s = window.labTest.getState(); return { locations: s.locations, target: s.target, panel: s.panel, mode: s.mode, vinegarMl: s.vinegarMl, records: s.records.length }; });
const aim = (x, z, tx, ty, tz) => page.evaluate(({ x, z, tx, ty, tz }) => { const c = window.sceneTest.getState().camera; c.position.set(x, 1.65, z); c.lookAt(tx, ty, tz); c.updateMatrixWorld(); }, { x, z, tx, ty, tz });
const waitTarget = target => page.waitForFunction(target => window.labTest.getState().target === target, target);
try {
  await page.goto(process.env.BASE_URL || 'http://127.0.0.1:5174');
  await page.getByRole('button', { name: /Práctica guiada/ }).waitFor();
  await page.waitForTimeout(1000);
  await page.evaluate(async () => {
    const resources = performance.getEntriesByType('resource');
    const labUrl = resources.find(r => new URL(r.name).pathname === '/src/state/lab.ts').name;
    const fiberUrl = resources.find(r => new URL(r.name).pathname.includes('@react-three_fiber')).name;
    window.labTest = (await import(labUrl)).useLab;
    const fiber = await import(fiberUrl);
    window.sceneTest = fiber._roots.get(document.querySelector('canvas')).store;
    window.labTest.setState({ tutorialDone: true }); window.labTest.getState().start('guided');
  });
  await page.getByRole('button', { name: 'Entrar al laboratorio' }).click();
  await page.waitForFunction(() => !!document.pointerLockElement);

  // Real raycast + keyboard pickup, placement and return. Only the approach positions are fixtures.
  await aim(-2.1, -3.15, -2.1, 1.36, -3.95); await waitTarget('beaker'); await page.keyboard.press('KeyE');
  assert.equal((await state()).locations.beaker, 'right');
  await aim(0.2, 0.85, 0.2, 1.18, -0.5); await waitTarget('bench'); await page.keyboard.press('KeyE');
  assert.equal((await state()).locations.beaker, 'bench');
  await aim(-3.15, -3.15, -3.15, 1.35, -3.95); await waitTarget('vinegar'); await page.keyboard.press('KeyE');
  assert.equal((await state()).locations.vinegar, 'right');
  await aim(-3.15, -3.15, -3.55, 1.16, -3.9); await waitTarget('shelf'); await page.keyboard.press('KeyQ');
  assert.equal((await state()).locations.vinegar, 'shelf');
  await page.keyboard.press('Digit1');
  await aim(-4.15, -3.15, -4.15, 1.36, -3.95); await waitTarget('bicarbonate'); await page.keyboard.press('KeyE');
  assert.equal((await state()).locations.bicarbonate, 'left');
  await aim(-4.15, -3.15, -4.55, 1.16, -3.9); await waitTarget('shelf'); await page.keyboard.press('KeyQ');
  assert.equal((await state()).locations.bicarbonate, 'shelf');

  // The camera must stay in the same location when opening and closing a station.
  await aim(0.2, 0.85, 0.2, 1.18, -0.5); await waitTarget('beaker');
  await page.evaluate(() => { window.cameraBefore = window.sceneTest.getState().camera.position.toArray(); window.labTest.getState().open('station'); });
  await page.getByRole('dialog').waitFor();
  await page.getByRole('button', { name: 'Volver al laboratorio' }).click();
  assert.deepEqual(await page.evaluate(() => window.sceneTest.getState().camera.position.toArray()), await page.evaluate(() => window.cameraBefore));

  // A prepared completed mixture reproduces the reported final-step cleanup problem.
  await page.evaluate(() => { window.labTest.setState({ vinegarMl: 50, bicarbonateG: 5 }); });
  await page.getByRole('button', { name: 'Entrar al laboratorio' }).click();
  await waitTarget('beaker'); await page.keyboard.press('KeyR');
  assert.equal((await state()).vinegarMl, 0);
  await page.keyboard.press('KeyE'); assert.equal((await state()).locations.beaker, 'left');

  // Record actual frame positions: no reverse motion when moving along a fixed heading.
  await aim(-1.2, 2.9, -1.2, 1.65, -4);
  await page.evaluate(() => {
    window.samples = []; const c = window.sceneTest.getState().camera;
    let count = 0; function sample() { window.samples.push(c.position.toArray()); if (++count < 90) requestAnimationFrame(sample); }
    requestAnimationFrame(sample);
  });
  await page.keyboard.down('KeyW'); await page.waitForFunction(() => window.samples.length >= 90); await page.keyboard.up('KeyW');
  const positions = await page.evaluate(() => window.samples);
  assert.ok(positions[0][2] - positions.at(-1)[2] > 0.5, 'el jugador debe haberse desplazado durante la muestra');
  for (let i = 1; i < positions.length; i++) { assert.ok(positions[i][2] <= positions[i - 1][2] + 1e-6); assert.ok(Math.abs(positions[i][0] + 1.2) < 1e-6); }
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.pointerLockElement);
  await page.getByRole('button', { name: 'Entrar al laboratorio' }).waitFor();
  await page.evaluate(() => { window.labTest.setState({ locations: { beaker: 'shelf', vinegar: 'shelf', bicarbonate: 'shelf' } }); const c = window.sceneTest.getState().camera; c.position.set(0, 1.65, 3.5); c.lookAt(0.8, 0.65, -0.5); });
  await page.getByRole('button', { name: 'Entrar al laboratorio' }).click();
  await page.screenshot({ path: 'test-results/rotulos-corregidos.png' });
  await page.keyboard.press('Escape');

  await page.evaluate(() => window.labTest.getState().open('periodic'));
  await page.getByRole('button', { name: '11 Sodio Na', exact: true }).click();
  await page.getByRole('complementary', { name: 'Propiedades del elemento seleccionado' }).getByRole('heading', { name: 'Sodio' }).waitFor();
  await page.getByRole('searchbox', { name: 'Buscar elemento' }).fill('oxigeno');
  await page.getByText('1 de 118 elementos coinciden', { exact: false }).waitFor();
  await page.getByRole('button', { name: '8 Oxígeno O', exact: true }).click();
  await page.getByRole('combobox', { name: 'Colorear por' }).selectOption('electronegativity');
  await page.screenshot({ path: 'test-results/tabla-interactiva.png' });
  await page.getByRole('button', { name: 'Restablecer filtros' }).click();
  await page.getByRole('combobox', { name: 'Familia', exact: true }).selectOption('Noble gas');
  await page.getByRole('button', { name: '2 Helio He', exact: true }).click();
  assert.equal(await page.getByRole('complementary', { name: 'Propiedades del elemento seleccionado' }).getByText('No disponible', { exact: true }).count() > 0, true);
  await page.getByRole('button', { name: 'Restablecer filtros' }).click();
  await page.getByRole('button', { name: '1 Hidrógeno H', exact: true }).focus(); await page.keyboard.press('ArrowRight');
  assert.equal(await page.getByRole('button', { name: '2 Helio He', exact: true }).getAttribute('aria-pressed'), 'true');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/tabla-movil.png' });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.ok(await page.evaluate(() => { const r = document.querySelector('[role=dialog]').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; }));
  await page.getByRole('button', { name: 'Cerrar panel' }).click();
  assert.deepEqual(errors, []);
  console.log('OK: raycasting de recogida/colocación/devolución, limpieza con R, conservación de cámara, movimiento sin retroceso, tabla interactiva y vista móvil.');
} catch (e) { await page.screenshot({ path: 'test-results/regresion-fallo.png' }); console.log(await state().catch(() => ({}))); throw e; } finally { await browser.close(); }
