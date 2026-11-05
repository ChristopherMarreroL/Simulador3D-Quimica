export type ItemId = 'beaker' | 'vinegar' | 'bicarbonate';
export const items: Record<ItemId, { name: string; formula: string; description: string; color: string; position: [number, number, number] }> = {
  beaker: { name: 'Vaso de precipitados', formula: '250 mL', description: 'Recipiente de vidrio. Colócalo en la mesa para preparar la mezcla.', color: '#9ecbd4', position: [-2.1, 1.16, -3.95] },
  vinegar: { name: 'Vinagre', formula: 'CH₃COOH (ac)', description: 'Solución acuosa de ácido acético · 0,83 mol/L. Evita el contacto ocular y no ingieras reactivos.', color: '#dbad58', position: [-3.15, 1.16, -3.95] },
  bicarbonate: { name: 'Bicarbonato de sodio', formula: 'NaHCO₃ (s)', description: 'Sólido blanco · 84,0066 g/mol. Evita inhalar el polvo. Reacción disponible: ácido acético.', color: '#68a6b2', position: [-4.15, 1.16, -3.95] },
};
export const guidedSteps = [
  ['Busca un recipiente', 'Sigue el indicador al vaso de precipitados. Apunta y presiona E.'],
  ['Prepara la mesa', 'Lleva el vaso a la mesa central y presiona E para colocarlo.'],
  ['Recoge el vinagre', 'Busca el frasco ámbar en el estante de reactivos.'],
  ['Vierte el vinagre', 'Con el vinagre en una mano, usa E en la mesa y elige una cantidad.'],
  ['Recoge el bicarbonato', 'Busca el frasco azul en el estante. Puedes cambiar de mano con 1 y 2.'],
  ['Completa la mezcla', 'Usa E en la mesa para añadir bicarbonato al vinagre.'],
  ['Observa y explica', 'Observa la efervescencia y abre los resultados de la estación.'],
];
export const tutorialSteps = [
  ['Da tus primeros pasos', 'Camina con W, A, S y D.'],
  ['Mira a tu alrededor', 'Mueve el mouse para orientar la cámara.'],
  ['Encuentra el vaso', 'Acércate al estante y apunta al vaso con el puntero central.'],
  ['Recógelo', 'Presiona E para transportar el vaso.'],
  ['Conoce tus manos', 'Presiona 1 o 2 para seleccionar la mano izquierda o derecha.'],
  ['Coloca el vaso', 'Acércate a la mesa central, apunta a su superficie y presiona E.'],
  ['Abre la estación', 'Apunta otra vez a la mesa y presiona E para ver sus controles.'],
];
