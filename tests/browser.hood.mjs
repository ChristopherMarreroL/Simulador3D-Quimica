import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Users/chris/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe', headless: true, args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1640, height: 1080 } });
page.setDefaultTimeout(20000);
const errors = []; page.on('pageerror', e => errors.push(e.message));
const hood = () => page.evaluate(() => { const h = window.hoodTest.getState(); return { places: Object.fromEntries(Object.entries(h.places).filter(([, p]) => p !== 'shelf')), additions: h.mixture.additions, log: h.log.map(l => l.events.map(e => e.rule)), records: h.records.length, cylinder: h.cylinder, recipe: h.recipe, error: h.error }; });
const aim = (x, z, tx, ty, tz) => page.evaluate(({ x, z, tx, ty, tz }) => { const c = window.sceneTest.getState().camera; c.position.set(x, 1.65, z); c.lookAt(tx, ty, tz); c.updateMatrixWorld(); }, { x, z, tx, ty, tz });
const waitTarget = target => page.waitForFunction(target => window.labTest.getState().target === target, target);
const click = async () => { await page.mouse.down(); await page.mouse.up(); };
const hold = async ms => { await page.mouse.down(); await page.waitForTimeout(ms); await page.mouse.up(); await page.waitForFunction(() => !window.hoodTest.getState().pouring); };
const idle = () => page.waitForFunction(() => !window.hoodTest.getState().transfer);
// Scene positions (designed, not measured): shelf slots, hood tools (hood at x 4,8 · z −3,6), PPE station by the door.
const bottle = (column, rowY) => [3.3 - 0.435 + column * 0.145, rowY + 0.09];
const HX = 4.8, HZ = -3.6;
try {
  await page.goto(process.env.BASE_URL || 'http://127.0.0.1:5174');
  await page.getByRole('button', { name: /Práctica guiada/ }).waitFor();
  await page.waitForTimeout(1000);
  await page.evaluate(async () => {
    const resources = performance.getEntriesByType('resource');
    const url = path => resources.find(r => new URL(r.name).pathname === path).name;
    window.labTest = (await import(url('/src/state/lab.ts'))).useLab;
    window.hoodTest = (await import(url('/src/state/hood.ts'))).useHood;
    const fiber = await import(resources.find(r => new URL(r.name).pathname.includes('@react-three_fiber')).name);
    window.sceneTest = fiber._roots.get(document.querySelector('canvas')).store;
    window.labTest.setState({ tutorialDone: true });
  });
  // Pick the guided experiment from the selector, as a player would.
  await page.getByRole('button', { name: /Elegir otros experimentos/ }).click();
  await page.getByRole('button', { name: /Campana · experimentos guiados/ }).click();
  await page.getByRole('heading', { name: 'Elige un experimento' }).waitFor();
  assert.equal(await page.locator('.recipe-item').count() >= 15, true);
  await page.locator('.recipe-item', { hasText: 'Prueba de cloruros' }).getByRole('button', { name: /Empezar/ }).click();
  await page.waitForFunction(() => !!document.pointerLockElement);
  await page.locator('.recipe-card').getByText('Ponte gafas y guantes').waitFor();

  // Protection first: without it the bottles cannot be taken.
  let [x, y] = bottle(1, 1.02); await aim(x, -3.6, x, y, -4.68); await waitTarget('reagent:agno3'); await click();
  assert.equal((await hood()).places.agno3, undefined, 'sin protección no se recoge el frasco');
  await aim(-0.59, 3.9, -0.59, 1.45, 4.88); await waitTarget('ppe-goggles'); await click();
  await aim(-0.91, 3.9, -0.91, 1.4, 4.85); await waitTarget('ppe-gloves'); await click();
  assert.deepEqual(await page.evaluate(() => window.labTest.getState().ppe), { goggles: true, gloves: true });
  await page.locator('.recipe-card li.current').getByText('Reúne los reactivos').waitFor();

  // Reagents: AgNO3 in the right hand (click) and NaCl in the left hand (E).
  [x, y] = bottle(1, 1.02); await aim(x, -3.6, x, y, -4.68); await waitTarget('reagent:agno3'); await click();
  await page.keyboard.press('Digit1');
  [x, y] = bottle(0, 1.02); await aim(x, -3.6, x, y, -4.68); await waitTarget('reagent:nacl'); await page.keyboard.press('KeyE');
  assert.deepEqual((await hood()).places, { agno3: 'right', nacl: 'left' });

  // Measure AgNO3 in the graduated cylinder (hold click), then pour it into the flask (E).
  await page.keyboard.press('Digit2');
  await aim(HX - 0.32, -2.2, HX - 0.32, 1.35, HZ + 0.46); await waitTarget('hood-cylinder');
  await page.locator('.prompt').getByText(/Mantén para verter Nitrato de plata/).waitFor();
  // Pour while watching the gauge and release on the 20 mL mark (as a person reads the cylinder).
  await page.mouse.down(); await page.locator('.pour-gauge').getByText(/Objetivo: 20 mL/).waitFor();
  await page.waitForFunction(() => window.hoodTest.getState().cylinder.ml >= 19.2, null, { polling: 50 }); await page.mouse.up();
  await page.waitForFunction(() => !window.hoodTest.getState().pouring);
  const measured = (await hood()).cylinder; assert.equal(measured.reagent, 'agno3'); assert.ok(measured.ml >= 19 && measured.ml <= 23, `probeta: ${measured.ml} mL`);
  await page.keyboard.press('KeyE'); await idle();
  let s = await hood(); assert.equal(s.additions[0].reagent, 'agno3'); assert.equal(s.cylinder.dirty, 'agno3');

  // Measuring NaCl requires rinsing the cylinder first with the wash bottle.
  await page.keyboard.press('Digit1'); await waitTarget('hood-cylinder'); await hold(400);
  assert.match((await page.evaluate(() => window.labTest.getState().message)), /Enjuágala/);
  await aim(HX - 0.58, -2.2, HX - 0.58, 1.25, HZ + 0.52); await waitTarget('hood-washbottle'); await page.keyboard.press('KeyE'); await idle();
  assert.equal((await hood()).cylinder.dirty, null);
  await aim(HX - 0.32, -2.2, HX - 0.32, 1.35, HZ + 0.46); await waitTarget('hood-cylinder');
  await page.mouse.down(); await page.waitForFunction(() => window.hoodTest.getState().cylinder.ml >= 4.8, null, { polling: 50 }); await page.mouse.up(); await page.waitForFunction(() => !window.hoodTest.getState().pouring);
  await page.keyboard.press('KeyE'); await idle();
  s = await hood(); assert.ok(s.log.flat().includes('ksp-AgCl'), 'debe formarse AgCl'); assert.equal(s.recipe.observed, true);
  await page.screenshot({ path: 'test-results/campana-procedimiento.png' });

  // Record in the notebook from the hood panel, then dispose in the waste container.
  await aim(HX + 0.05, -2.2, HX + 0.05, 1.3, HZ + 0.15); await waitTarget('hood'); await page.keyboard.press('KeyE');
  await page.locator('.hood-log').getByText(/sólido blanco: AgCl/).first().waitFor();
  await page.getByRole('button', { name: 'Guardar en el cuaderno' }).click();
  await page.getByRole('button', { name: 'Volver al laboratorio' }).click();
  await page.getByRole('button', { name: 'Entrar al laboratorio' }).click(); await page.waitForFunction(() => !!document.pointerLockElement);
  await aim(HX + 0.66, -2.2, HX + 0.66, 1.3, HZ - 0.2); await waitTarget('hood-waste'); await page.keyboard.press('KeyE'); await idle();
  s = await hood(); assert.equal(s.additions.length, 0); assert.equal(s.records, 1); assert.equal(s.recipe.disposed, true);
  await page.locator('.recipe-card').getByText(/Completado/).waitFor();
  await page.screenshot({ path: 'test-results/campana-completado.png' });

  await page.keyboard.press('Escape');
  await page.evaluate(() => window.labTest.getState().open('notebook'));
  await page.getByRole('combobox', { name: 'Mostrar' }).selectOption('hood');
  await page.locator('.notebook-page').getByText('Campana · mezcla libre').waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.labTest.getState().open('recipes'));
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: 'test-results/campana-tablero-movil.png' });
  assert.deepEqual(errors, []);
  console.log('OK: experimento guiado con flechas (selector, gafas y guantes obligatorios, frascos, probeta con objetivo, enjuague con piseta, AgCl, cuaderno, residuos y completado) y vista móvil.');
} catch (e) { await page.screenshot({ path: 'test-results/campana-fallo.png' }); console.log(await hood().catch(() => ({}))); throw e; } finally { await browser.close(); }
