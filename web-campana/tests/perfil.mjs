// Perfil rápido de rendimiento: FPS y llamadas de dibujo en la vista general, con y sin cada grupo de objetos.
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--disable-frame-rate-limit', '--disable-gpu-vsync'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await page.goto(`${process.env.BASE_URL || 'http://127.0.0.1:5180/'}?calidad=${process.env.CALIDAD || 'media'}`);
await page.waitForFunction(() => window.__campana, null, { timeout: 120000 });
await page.evaluate(() => { const j = window.__campana.jugador; j.colocar(5.2, 8.0); j.mirarA(window.__campana.objetos.centro('hood').setY(1.0)); });
const medir = async (nombre, antes) => {
  await page.evaluate(antes);
  await page.waitForTimeout(2500);
  const r = await page.evaluate(async () => { const c = window.__campana; c.fps.tiempos.length = 0; await new Promise(r => setTimeout(r, 6000)); const t = c.fps.tiempos; const i = c.renderer.info.render; return { fps: 1000 / (t.reduce((a, b) => a + b, 0) / t.length), llamadas: i.calls, triangulos: i.triangles }; });
  console.log(nombre.padEnd(28), r.fps.toFixed(1), 'FPS', r.llamadas, 'llamadas', Math.round(r.triangulos / 1000), 'k tri');
};
await medir('todo', () => {});
if (process.env.INTERFAZ) {
  await medir('interfaz de juego', () => { document.querySelector('[data-k=portada]').hidden = true; document.getElementById('hud').classList.remove('en-pausa'); window.__campana.partida.elegir(null); });
  await medir('sin grano', () => { document.getElementById('pelicula').style.display = 'none'; });
  await medir('sin desenfoque de paneles', () => { const e = document.createElement('style'); e.textContent = '* { backdrop-filter: none !important; }'; document.head.append(e); });
  await medir('sin interfaz', () => { document.getElementById('hud').style.display = 'none'; });
} else {
await medir('sin objetos moviles/decor', () => { window.__campana.objetos.raiz.visible = false; });
await medir('sin sala', () => { const c = window.__campana; c.objetos.raiz.visible = true; c.escena.children.forEach(o => { if (o !== c.objetos.raiz && o !== c.jugador.camara) o.visible = false; }); });
await medir('nada', () => { window.__campana.objetos.raiz.visible = false; });
}
await browser.close();
