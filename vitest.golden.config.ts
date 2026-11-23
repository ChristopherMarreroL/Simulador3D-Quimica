import { defineConfig } from 'vitest/config';

// Exportadores de vectores de referencia (motor químico y capa de estado de la campana): `npm run golden`.
// No forman parte de `npm test`.
export default defineConfig({ test: { include: ['golden/export.golden.ts', 'golden/steps/export.steps.ts'], testTimeout: 600000, silent: false } });
