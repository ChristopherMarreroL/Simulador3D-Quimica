import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// Versión web de la estación de la campana. Usa la lógica validada de ../src (estado de la campana y motor químico)
// y los modelos de ../art/export, así que el servidor puede leer la carpeta del repositorio.
const raiz = fileURLToPath(new URL('..', import.meta.url));
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: './',
  server: { host: '127.0.0.1', port: 5180, strictPort: true, fs: { allow: [raiz] } },
  preview: { host: '127.0.0.1', port: 5181, strictPort: true },
  build: { outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 1200, assetsInlineLimit: 0 },
});
