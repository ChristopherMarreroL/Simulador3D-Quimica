import { conductivity, crystallization } from '../chemistry/solutions';
export const practiceCatalog = {
  conductivity: { title: 'Conductividad eléctrica', station: '02', surface: 'support-1', objective: 'Compara qué soluciones transportan corriente.', calculate: conductivity },
  dissolution: { title: 'Disolución y cristalización', station: '03', surface: 'support-2', objective: 'Disuelve sal y observa qué ocurre al evaporar agua.', calculate: crystallization },
} as const;
export type PracticeId = keyof typeof practiceCatalog;
export type PracticeInput = Parameters<typeof conductivity>[0] | Parameters<typeof crystallization>[0];
