import { amountRange, reagentIds, reagents, type ReagentId } from '../../src/chemistry/reagents';
import { addReagent, analyzeMixture, emptyMixture, type Addition, type Mixture, type SandboxEvent } from '../../src/chemistry/sandbox';
import { species, type SpeciesId } from '../../src/chemistry/species';
import { hoodRecipes, type HoodRecipe } from '../../src/experiments/hoodRecipes';

/**
 * Explicaciones en lenguaje sencillo para el cuaderno (25 de noviembre de 2026). No añade química: repite la mezcla
 * con el mismo modelo validado (src/chemistry/sandbox.ts) y traduce a palabras lo que ese modelo calcula: qué pasó,
 * si es peligroso, si es problemático, para qué sirve y cómo se desecha, de la mezcla y de cada sustancia.
 * Si el modelo no predice nada, se dice así; nunca se inventa una reacción.
 */
export type Nivel = 'bajo' | 'precaucion' | 'alto';
export const NIVELES: Record<Nivel, string> = { bajo: 'Riesgo bajo', precaucion: 'Precaución', alto: 'Peligroso' };
const ORDEN: Nivel[] = ['bajo', 'precaucion', 'alto'];
const peor = (a: Nivel, b: Nivel): Nivel => ORDEN.indexOf(a) >= ORDEN.indexOf(b) ? a : b;

interface Ficha { queEs: string; sirve: string; nivel: Nivel; riesgo: string }
/** Cada sustancia de la estantería por separado. */
export const SUSTANCIAS: Record<ReagentId, Ficha> = {
  water: { queEs: 'Agua pura, sin sales ni minerales.', sirve: 'Diluir mezclas, disolver sólidos y enjuagar el material.', nivel: 'bajo', riesgo: 'No tiene peligro.' },
  hcl: { queEs: 'Un ácido fuerte disuelto en agua. Es el mismo ácido que hay en el estómago.', sirve: 'Limpiar óxido y cal, ajustar la acidez y hacer reaccionar metales y carbonatos.', nivel: 'precaucion', riesgo: 'Quema la piel y los ojos. Siempre con gafas y guantes.' },
  h2so4: { queEs: 'Un ácido fuerte disuelto en agua. Es el ácido de las baterías de coche.', sirve: 'Fabricar abonos y detergentes; en el laboratorio da acidez y aporta sulfato.', nivel: 'precaucion', riesgo: 'Quema la piel y los ojos. Se añade siempre el ácido al agua, nunca al revés.' },
  acetic: { queEs: 'Un ácido débil: es lo que da su sabor y olor al vinagre.', sirve: 'Cocinar, conservar alimentos y quitar la cal; en el laboratorio es el ácido suave.', nivel: 'bajo', riesgo: 'Irrita los ojos; por lo demás es poco peligroso a esta concentración.' },
  naoh: { queEs: 'Una base fuerte disuelta en agua, conocida como sosa cáustica.', sirve: 'Fabricar jabón y desatascar tuberías; en el laboratorio neutraliza ácidos y hace aparecer sólidos de metales.', nivel: 'precaucion', riesgo: 'Quema la piel y sobre todo los ojos. Siempre con gafas y guantes.' },
  na2co3: { queEs: 'Una sal básica disuelta en agua, conocida como sosa de lavar.', sirve: 'Detergentes, fabricar vidrio y ablandar el agua dura.', nivel: 'bajo', riesgo: 'Irrita los ojos.' },
  nahco3: { queEs: 'Un polvo blanco ligeramente básico: el bicarbonato de la cocina.', sirve: 'Hacer subir los bizcochos, calmar la acidez de estómago y neutralizar ácidos derramados.', nivel: 'bajo', riesgo: 'Casi inofensivo; solo evita respirar el polvo.' },
  phenolphthalein: { queEs: 'Un indicador: un colorante que cambia de color según la acidez.', sirve: 'Avisar de que una mezcla es básica: se pone rosa. En ácido o neutro no tiene color.', nivel: 'bajo', riesgo: 'Va disuelto en alcohol, que es inflamable. Se usan solo unas gotas.' },
  universal: { queEs: 'Un indicador: una mezcla de colorantes que cambia de color según la acidez.', sirve: 'Saber de un vistazo si algo es ácido (rojo), neutro (verde) o básico (violeta).', nivel: 'bajo', riesgo: 'Va disuelto en alcohol, que es inflamable. Se usan solo unas gotas.' },
  bromothymol: { queEs: 'Un indicador: un colorante que cambia de color cerca del punto neutro.', sirve: 'Distinguir lo ligeramente ácido (amarillo) de lo ligeramente básico (azul); se usa en acuarios y piscinas.', nivel: 'bajo', riesgo: 'Va disuelto en alcohol, que es inflamable. Se usan solo unas gotas.' },
  starch: { queEs: 'Almidón cocido en agua, como el de la harina o la patata.', sirve: 'Detectar yodo: se vuelve azul muy oscuro cuando lo hay.', nivel: 'bajo', riesgo: 'No tiene peligro.' },
  h2o2: { queEs: 'Agua oxigenada, la misma de la farmacia.', sirve: 'Desinfectar heridas y blanquear; en el laboratorio da oxígeno y oxida otras sustancias.', nivel: 'bajo', riesgo: 'Irrita los ojos. Se estropea con la luz, por eso va en frasco oscuro.' },
  kmno4: { queEs: 'Una sal violeta muy intensa que oxida a otras sustancias.', sirve: 'Desinfectar y potabilizar agua; en el laboratorio sirve para medir cuánto hay de otra sustancia porque pierde el color al reaccionar.', nivel: 'precaucion', riesgo: 'Es nociva, mancha la piel de marrón y aviva el fuego si toca materiales que arden.' },
  ki: { queEs: 'Una sal blanca disuelta en agua que aporta yoduro.', sirve: 'Se añade a la sal de mesa yodada; en el laboratorio forma yodo y sólidos de colores con plata y plomo.', nivel: 'bajo', riesgo: 'Poco peligrosa; no se debe ingerir.' },
  nacl: { queEs: 'Sal común de cocina disuelta en agua.', sirve: 'Cocinar y conservar; en el laboratorio aporta cloruro, por ejemplo para la prueba con nitrato de plata.', nivel: 'bajo', riesgo: 'No tiene peligro.' },
  agno3: { queEs: 'Una sal de plata disuelta en agua.', sirve: 'Detectar cloruros y yoduros en el agua, fabricar espejos y fotografía clásica.', nivel: 'precaucion', riesgo: 'Irrita y deja manchas negras en la piel que tardan días en irse. Es tóxica para los peces.' },
  cuso4: { queEs: 'Una sal de cobre de color azul disuelta en agua.', sirve: 'Fungicida en agricultura (caldo bordelés) y para recubrir piezas con cobre.', nivel: 'precaucion', riesgo: 'Nociva si se ingiere y tóxica para la vida acuática.' },
  fecl3: { queEs: 'Una sal de hierro de color amarillo anaranjado; su disolución es ácida.', sirve: 'Limpiar el agua en las depuradoras y grabar circuitos impresos.', nivel: 'precaucion', riesgo: 'Corrosiva e irritante; mancha la ropa y la piel.' },
  pbno3: { queEs: 'Una sal de plomo disuelta en agua.', sirve: 'Solo para demostraciones como la «lluvia de oro». Hoy se evita siempre que se puede.', nivel: 'alto', riesgo: 'Tóxica: el plomo se acumula en el cuerpo y daña el sistema nervioso y al feto. En un laboratorio escolar real no se usaría.' },
  bacl2: { queEs: 'Una sal de bario disuelta en agua.', sirve: 'Detectar sulfatos: con ellos forma un sólido blanco.', nivel: 'alto', riesgo: 'Tóxica si se ingiere. Hay que lavarse las manos después de usarla.' },
  cacl2: { queEs: 'Una sal blanca que absorbe mucha agua.', sirve: 'Derretir el hielo de las carreteras, secar el aire y hacer bolsas de calor.', nivel: 'bajo', riesgo: 'Irrita los ojos y se calienta al disolverse.' },
  nh4no3: { queEs: 'Una sal blanca muy soluble.', sirve: 'Abono para el campo y bolsas de frío instantáneo.', nivel: 'precaucion', riesgo: 'Aviva el fuego y, en grandes cantidades y con calor, puede explotar. En el matraz, disuelta, no da problemas.' },
  caco3: { queEs: 'El material del mármol, la tiza, la caliza y las cáscaras de huevo.', sirve: 'Construcción, cemento y antiácidos.', nivel: 'bajo', riesgo: 'No tiene peligro.' },
  zn: { queEs: 'Un metal gris bastante activo, en granos.', sirve: 'Proteger el hierro de la oxidación (galvanizado) y fabricar pilas.', nivel: 'bajo', riesgo: 'En granos es seguro; en polvo fino puede arder.' },
  mg: { queEs: 'Un metal ligero y muy activo, en cinta.', sirve: 'Aleaciones ligeras, bengalas y fuegos artificiales.', nivel: 'precaucion', riesgo: 'Arde con una luz blanca muy intensa: nunca cerca de una llama.' },
  cu: { queEs: 'Un metal rojizo poco activo, en alambre.', sirve: 'Cables eléctricos, tuberías y monedas.', nivel: 'bajo', riesgo: 'No tiene peligro.' },
  fe: { queEs: 'Hierro, el metal más usado; aquí en clavos.', sirve: 'Construcción, herramientas y acero.', nivel: 'bajo', riesgo: 'No tiene peligro.' },
};

interface Producto { nivel: Nivel; nota: string }
/** Lo que el modelo puede formar: gases, sólidos y dos sustancias disueltas que conviene conocer. */
export const PRODUCTOS: Partial<Record<SpeciesId, Producto>> = {
  CO2: { nivel: 'bajo', nota: 'Dióxido de carbono: el gas de las bebidas con burbujas. No arde ni es tóxico en esta cantidad; solo hay que dejarlo salir sin tapar el matraz.' },
  H2: { nivel: 'precaucion', nota: 'Hidrógeno: un gas muy inflamable que puede explotar si se acumula. Extractor encendido y ninguna llama cerca.' },
  O2: { nivel: 'precaucion', nota: 'Oxígeno: no arde, pero hace que todo lo demás arda con mucha más fuerza. Lejos de llamas y brasas.' },
  NH3: { nivel: 'precaucion', nota: 'Amoníaco: olor muy picante, irrita los ojos y la nariz. Se trabaja con el extractor encendido.' },
  I2: { nivel: 'precaucion', nota: 'Yodo: da el color pardo. Mancha la piel y la ropa e irrita; es el mismo que se usaba como desinfectante.' },
  AgCl: { nivel: 'bajo', nota: 'Cloruro de plata: sólido blanco que se oscurece con la luz (así funcionaba la fotografía antigua).' },
  AgI: { nivel: 'bajo', nota: 'Yoduro de plata: sólido amarillo pálido, sensible a la luz.' },
  Ag2SO4: { nivel: 'bajo', nota: 'Sulfato de plata: sólido blanco poco soluble.' },
  Ag2CO3: { nivel: 'bajo', nota: 'Carbonato de plata: sólido amarillo pálido.' },
  Ag2O: { nivel: 'bajo', nota: 'Óxido de plata: sólido marrón oscuro que mancha.' },
  Ag: { nivel: 'bajo', nota: 'Plata metálica: cristales grises. Tiene valor y se recupera, no se tira.' },
  PbCl2: { nivel: 'alto', nota: 'Cloruro de plomo: sólido blanco tóxico.' },
  PbI2: { nivel: 'alto', nota: 'Yoduro de plomo: el sólido amarillo de la «lluvia de oro». Es tóxico.' },
  PbSO4: { nivel: 'alto', nota: 'Sulfato de plomo: sólido blanco tóxico, el mismo que se forma en las baterías de coche.' },
  PbCO3: { nivel: 'alto', nota: 'Carbonato de plomo: sólido blanco tóxico; fue un pigmento de pintura hoy prohibido.' },
  'Pb(OH)2': { nivel: 'alto', nota: 'Hidróxido de plomo: sólido blanco tóxico.' },
  Pb: { nivel: 'alto', nota: 'Plomo metálico: gris oscuro y tóxico.' },
  BaSO4: { nivel: 'bajo', nota: 'Sulfato de bario: sólido blanco tan insoluble que no es tóxico; es la papilla que se bebe para algunas radiografías.' },
  BaCO3: { nivel: 'alto', nota: 'Carbonato de bario: sólido blanco tóxico, porque el ácido del estómago lo disuelve.' },
  CaCO3: { nivel: 'bajo', nota: 'Carbonato de calcio: la cal que deja el agua dura en grifos y hervidores.' },
  CaSO4: { nivel: 'bajo', nota: 'Sulfato de calcio: es yeso.' },
  'Ca(OH)2': { nivel: 'precaucion', nota: 'Hidróxido de calcio: cal apagada. Irrita la piel y los ojos.' },
  'Cu(OH)2': { nivel: 'precaucion', nota: 'Hidróxido de cobre: sólido azul celeste gelatinoso. Nocivo para la vida acuática.' },
  CuCO3: { nivel: 'precaucion', nota: 'Carbonato de cobre: sólido verde azulado, parecido al verdín del cobre viejo.' },
  CuI: { nivel: 'precaucion', nota: 'Yoduro de cobre: sólido de color crema.' },
  Cu: { nivel: 'bajo', nota: 'Cobre metálico: depósito rojizo.' },
  'Fe(OH)3': { nivel: 'bajo', nota: 'Hidróxido de hierro: sólido marrón rojizo, pariente del óxido de los clavos.' },
  'Fe(OH)2': { nivel: 'bajo', nota: 'Hidróxido de hierro(II): sólido verde grisáceo que con el aire se vuelve marrón.' },
  Fe: { nivel: 'bajo', nota: 'Hierro metálico.' },
  'Mg(OH)2': { nivel: 'bajo', nota: 'Hidróxido de magnesio: sólido blanco; es la «leche de magnesia» que se toma como antiácido.' },
  MgCO3: { nivel: 'bajo', nota: 'Carbonato de magnesio: el polvo blanco que usan gimnastas y escaladores.' },
  'Zn(OH)2': { nivel: 'bajo', nota: 'Hidróxido de cinc: sólido blanco gelatinoso.' },
  ZnCO3: { nivel: 'bajo', nota: 'Carbonato de cinc: sólido blanco.' },
  Zn: { nivel: 'bajo', nota: 'Cinc metálico.' },
  Mg: { nivel: 'precaucion', nota: 'Magnesio metálico: arde con facilidad.' },
  MnO2: { nivel: 'precaucion', nota: 'Dióxido de manganeso: sólido marrón oscuro que mancha; es lo que hay dentro de las pilas.' },
};

interface Paso { titulo: string; paso: string; sirve: string }
const nombre = (id: string) => species[id as SpeciesId]?.name ?? id;
const SIRVE = {
  neutral: 'La neutralización es lo que hace un antiácido en el estómago, y la forma correcta de tratar un derrame de ácido o de base.',
  co2: 'Es la reacción que hace subir los bizcochos, la de las pastillas efervescentes y la de algunos extintores.',
  caliza: 'Así se quita la cal con vinagre, y así reconocen los geólogos una roca caliza: le echan ácido y burbujea.',
  hidrogeno: 'Es la forma clásica de obtener hidrógeno en el laboratorio y demuestra qué metales son «activos».',
  actividad: 'Ordena los metales del más al menos activo y se usa para recubrir piezas o recuperar metales valiosos de una disolución.',
  valoracion: 'Como el color cambia justo cuando se acaba una de las sustancias, sirve para medir cuánta había (una valoración).',
  yodo: 'Formar yodo y verlo con almidón es un método clásico para medir oxidantes, como el cloro del agua.',
  hidroxido: 'El color del sólido delata qué metal hay en el agua, y así se retiran los metales de las aguas contaminadas.',
  dureza: 'Es lo que forma la cal en tuberías y hervidores, y también la forma de «ablandar» el agua dura.',
  redisolver: 'Demuestra que estos sólidos se deshacen con ácido: por eso los ácidos limpian la cal y el óxido.',
};
/** Traduce a palabras cada cambio que el modelo puede calcular. La prueba comprueba que no queda ninguno sin texto. */
export function explicarRegla(e: Pick<SandboxEvent, 'rule' | 'kind' | 'title' | 'solid' | 'gas'>): Paso {
  const r = e.rule;
  const fijos: Record<string, Paso> = {
    'neutral-strong': { titulo: 'El ácido y la base se neutralizaron', paso: 'El ácido y la base se anularon entre sí: formaron agua y una sal, y la mezcla se calentó.', sirve: SIRVE.neutral },
    'neutral-acetic': { titulo: 'La base neutralizó el vinagre', paso: 'La sosa neutralizó el ácido del vinagre: se formó agua y una sal llamada acetato.', sirve: SIRVE.neutral },
    'neutral-ammonium': { titulo: 'Se formó amoníaco', paso: 'La base transformó la sal de amonio en amoníaco, que se nota por su olor picante.', sirve: 'Es la prueba clásica para saber si un abono o una sal contiene amonio: se le añade una base y huele a amoníaco.' },
    'neutral-bicarbonate': { titulo: 'El bicarbonato pasó a carbonato', paso: 'La base convirtió el bicarbonato en carbonato. No se ve nada a simple vista.', sirve: 'Muestra que el bicarbonato puede comportarse como ácido frente a una base más fuerte.' },
    'carbonate-strong': { titulo: 'El carbonato absorbió parte del ácido', paso: 'El carbonato atrapó parte del ácido y se convirtió en bicarbonato. Todavía no hay burbujas: aparecen si se añade más ácido.', sirve: SIRVE.neutral },
    'carbonate-acetic': { titulo: 'El carbonato absorbió parte del vinagre', paso: 'El carbonato atrapó parte del ácido del vinagre y pasó a bicarbonato.', sirve: SIRVE.neutral },
    'ammonia-strong': { titulo: 'El ácido neutralizó el amoníaco', paso: 'El ácido neutralizó el amoníaco y el olor desaparece.', sirve: 'Así se fabrican abonos como el nitrato de amonio.' },
    'ammonia-acetic': { titulo: 'El vinagre neutralizó el amoníaco', paso: 'El vinagre neutralizó el amoníaco y el olor desaparece.', sirve: SIRVE.neutral },
    'co2-strong': { titulo: 'Burbujeó: se liberó dióxido de carbono', paso: 'El ácido reaccionó con el bicarbonato y salieron burbujas de dióxido de carbono.', sirve: SIRVE.co2 },
    'co2-acetic': { titulo: 'Burbujeó: se liberó dióxido de carbono', paso: 'El vinagre reaccionó con el bicarbonato y salieron burbujas de dióxido de carbono.', sirve: SIRVE.co2 },
    'acetate-strong': { titulo: 'El ácido fuerte desplazó al débil', paso: 'El ácido fuerte devolvió el acetato a su forma de ácido acético (vinagre). No se ve nada, pero la mezcla huele a vinagre.', sirve: 'Regla general: un ácido fuerte siempre desplaza a uno débil de sus sales.' },
    'bicarbonate-solid-strong': { titulo: 'El bicarbonato burbujeó en el ácido', paso: 'El polvo de bicarbonato reaccionó con el ácido con mucha efervescencia y soltó dióxido de carbono.', sirve: SIRVE.co2 },
    'bicarbonate-solid-acetic': { titulo: 'Vinagre y bicarbonato: burbujas', paso: 'El bicarbonato reaccionó con el vinagre con mucha efervescencia, soltó dióxido de carbono y la mezcla se enfrió un poco.', sirve: SIRVE.co2 },
    'permanganate-peroxide': { titulo: 'El violeta desapareció', paso: 'El permanganato violeta reaccionó con el agua oxigenada en medio ácido: perdió el color y salieron burbujas de oxígeno.', sirve: SIRVE.valoracion },
    'permanganate-iodide': { titulo: 'El violeta se volvió pardo', paso: 'El permanganato transformó el yoduro en yodo: el violeta desaparece y queda el color pardo del yodo.', sirve: SIRVE.yodo },
    'permanganate-iron': { titulo: 'El violeta desapareció', paso: 'El permanganato reaccionó con el hierro disuelto y perdió su color violeta.', sirve: SIRVE.valoracion },
    'peroxide-iodide': { titulo: 'Apareció yodo pardo', paso: 'El agua oxigenada, con ayuda del ácido, transformó el yoduro en yodo de color pardo.', sirve: SIRVE.yodo },
    'iron-iodide': { titulo: 'Apareció yodo pardo', paso: 'La sal de hierro transformó el yoduro en yodo: la mezcla se vuelve parda.', sirve: SIRVE.yodo },
    'copper-iodide': { titulo: 'Apareció yodo y un sólido crema', paso: 'El cobre azul reaccionó con el yoduro: se formó yodo pardo y un sólido de color crema (yoduro de cobre).', sirve: 'Es un método clásico para medir cuánto cobre hay en una muestra.' },
    'permanganate-peroxide-neutral': { titulo: 'Burbujas y un sólido marrón', paso: 'Sin ácido, el permanganato y el agua oxigenada dieron burbujas de oxígeno y un sólido marrón oscuro (dióxido de manganeso).', sirve: 'Muestra que la misma pareja de sustancias da productos distintos según haya ácido o no.' },
    'peroxide-decomposition': { titulo: 'El agua oxigenada se descompuso', paso: 'El agua oxigenada se rompió de golpe en agua y oxígeno: mucha espuma y calor. Lo que la aceleró (el catalizador) no se gasta.', sirve: 'Es el experimento de la «pasta de dientes de elefante» y explica por qué el agua oxigenada hace espuma en una herida.' },
  };
  if (fijos[r]) return fijos[r];
  let m = /^acid-(.+)-(H\+|HAc)$/.exec(r);
  if (m) {
    const acido = m[2] === 'HAc' ? 'el vinagre' : 'el ácido';
    return e.kind === 'gas'
      ? { titulo: `El ácido atacó al ${nombre(m[1])} y burbujeó`, paso: `${acido[0].toUpperCase()}${acido.slice(1)} deshizo el ${nombre(m[1])} y salieron burbujas de dióxido de carbono.`, sirve: SIRVE.caliza }
      : { titulo: `El ácido disolvió el ${nombre(m[1])}`, paso: `${acido[0].toUpperCase()}${acido.slice(1)} deshizo el ${nombre(m[1])} y el metal volvió a quedar disuelto: el sólido desaparece.`, sirve: SIRVE.redisolver };
  }
  m = /^metal-(\w+)-(.+)$/.exec(r);
  if (m) {
    const metal = nombre(m[1]).replace(' metálico', '').replace(' metálica', '');
    if (m[2] === 'H+') return { titulo: `El ${metal} burbujeó en el ácido`, paso: `El ${metal} se fue deshaciendo en el ácido y soltó burbujas de hidrógeno; además la mezcla se calentó.`, sirve: SIRVE.hidrogeno };
    if (m[2] === 'HAc') return { titulo: `El ${metal} burbujeó en el vinagre`, paso: `El ${metal} reaccionó con el vinagre y soltó burbujas de hidrógeno. En la realidad es bastante más lento que con un ácido fuerte.`, sirve: SIRVE.hidrogeno };
    if (m[2] === 'Fe3+') return { titulo: `El ${metal} reaccionó con la sal de hierro`, paso: `El ${metal} se fue deshaciendo en la sal de hierro, que pierde su color anaranjado. No se deposita ningún metal.`, sirve: m[1] === 'Cu' ? 'Así se graban los circuitos impresos: la sal de hierro se come el cobre sobrante.' : SIRVE.actividad };
    const otro = (e.solid ? nombre(e.solid.id) : 'otro metal').replace(' metálico', '').replace(' metálica', '');
    return { titulo: `El ${metal} desplazó a ${otro === 'plata' ? 'la' : 'el'} ${otro}`, paso: `El ${metal}, más activo, se disolvió y a cambio apareció ${otro} en forma de metal sobre su superficie.`,
      sirve: otro === 'plata' ? 'Así se forma el «árbol de plata» y así se recupera la plata de disoluciones usadas.' : SIRVE.actividad };
  }
  m = /^ksp-(.+)$/.exec(r);
  if (m) {
    const s = species[m[1] as SpeciesId];
    if (e.kind === 'disolución') {
      if (m[1] === 'CaCl2(s)') return { titulo: 'Se disolvió y calentó el agua', paso: 'El cloruro de calcio se disolvió y el agua se calentó: al disolverse suelta calor.', sirve: 'Es el principio de las bolsas de calor instantáneo y de la sal que derrite el hielo en las carreteras.' };
      if (m[1] === 'NH4NO3(s)') return { titulo: 'Se disolvió y enfrió el agua', paso: 'El nitrato de amonio se disolvió y el agua se enfrió: al disolverse absorbe calor.', sirve: 'Es el principio de las bolsas de frío instantáneo para golpes y torceduras.' };
      if (m[1] === 'NaHCO3(s)') return { titulo: 'El bicarbonato se disolvió', paso: 'El bicarbonato se disolvió en el agua, que se enfría un poco y queda ligeramente básica.', sirve: 'Así se prepara el bicarbonato que se toma como antiácido.' };
      return { titulo: `Se disolvió ${s.name}`, paso: `Una parte del ${s.name} se disolvió en el líquido.`, sirve: 'Muestra que hasta los sólidos «insolubles» se disuelven un poco.' };
    }
    const color = s.colorName ? ` de color ${s.colorName}` : '';
    const usos: Record<string, string> = {
      AgCl: 'Es la prueba para saber si un agua contiene cloruros (sal): si al añadir nitrato de plata se enturbia de blanco, los tiene.',
      AgI: 'Es la prueba para detectar yoduros: dan un sólido amarillo pálido con la plata.',
      BaSO4: 'Es la prueba para saber si un agua contiene sulfatos: con bario se enturbia de blanco.',
      PbI2: 'Es la demostración de la «lluvia de oro» y una forma de reconocer el plomo.',
      CaCO3: SIRVE.dureza, MgCO3: SIRVE.dureza, CaSO4: 'Así se forma el yeso.',
    };
    const uso = usos[m[1]] ?? (/\(OH\)|Ag2O/.test(m[1]) ? SIRVE.hidroxido : 'Sirve para reconocer qué hay disuelto: cada pareja da un sólido de aspecto distinto, y así se separan sustancias del agua.');
    return { titulo: `Apareció un sólido${color}`, paso: `Dos sustancias disueltas se juntaron y formaron ${s.name}, un sólido${color} que no se disuelve: enturbia el líquido y acaba cayendo al fondo.`, sirve: uso };
  }
  return { titulo: e.title, paso: e.title + '.', sirve: '' };
}

const METALES: Record<string, string> = { Pb: 'plomo', Ba: 'bario', Ag: 'plata', Cu: 'cobre', Mn: 'manganeso', Zn: 'cinc', Fe: 'hierro' };
const cantidad = (a: Addition) => { const r = reagents[a.reagent], u = amountRange(r).unit; return `${a.amount.toLocaleString('es', { maximumFractionDigits: 2 })} ${u}`; };
const lista = (xs: string[]) => xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`;

export interface Explicacion {
  titulo: string; mision: string | null;
  quePaso: string[]; resultado: string[];
  nivel: Nivel; peligro: string[];
  problema: string; desecho: string;
  sirve: string[];
  sustancias: { id: ReagentId; nombre: string; cantidad: string; queEs: string; sirve: string; nivel: Nivel; riesgo: string }[];
  productos: { nombre: string; nivel: Nivel; nota: string }[];
  datos: { volumen: number; temperatura: number; pH: number | null; ecuaciones: string[]; solidos: string[]; gases: string[] };
}

/** Repite la mezcla con el modelo, en trozos que respeten sus límites, y devuelve los cambios en orden. */
function repetir(adiciones: Addition[]) {
  let mezcla: Mixture = emptyMixture();
  const eventos: SandboxEvent[] = [];
  let tMax = mezcla.temperatureC, tMin = mezcla.temperatureC;
  for (const a of adiciones) {
    if (!reagents[a.reagent]) continue;
    const rango = amountRange(reagents[a.reagent]);
    let resto = a.amount;
    while (resto > 1e-9) {
      const trozo = Math.max(rango.min, Math.min(rango.max, resto));
      try { const r = addReagent(mezcla, a.reagent, trozo); mezcla = r.mixture; eventos.push(...r.events); } catch { break; }
      tMax = Math.max(tMax, mezcla.temperatureC); tMin = Math.min(tMin, mezcla.temperatureC);
      resto -= trozo;
    }
  }
  return { mezcla, eventos, tMax, tMin };
}

const palabraPH = (pH: number) => pH < 3 ? 'muy ácida' : pH < 6 ? 'ácida' : pH <= 8 ? 'prácticamente neutra' : pH <= 11 ? 'básica' : 'muy básica';

/** La misión a la que corresponde una mezcla: mismos reactivos y los mismos cambios que la misión exige. */
function misionDe(adiciones: Addition[], reglas: Set<string>): HoodRecipe | null {
  const usados = new Set(adiciones.map(a => a.reagent));
  return hoodRecipes.find(r => r.adds.every(a => usados.has(a.reagent)) && usados.size === new Set(r.adds.map(a => a.reagent)).size && r.expect.every(x => reglas.has(x))) ?? null;
}

/** Explicación completa de una mezcla: el conjunto y cada sustancia por separado. */
export function explicar(adiciones: Addition[]): Explicacion {
  const { mezcla, eventos, tMax, tMin } = repetir(adiciones);
  const a = analyzeMixture(mezcla);
  const vistos = new Set<string>(), pasos: Paso[] = [];
  for (const e of eventos) { const clave = `${e.rule}|${e.kind}`; if (vistos.has(clave)) continue; vistos.add(clave); pasos.push(explicarRegla(e)); }
  const reglas = new Set(eventos.map(e => e.rule));
  const mision = misionDe(adiciones, reglas);
  const ids = [...new Set(adiciones.map(x => x.reagent))].filter(id => reagents[id]);
  const liquido = mezcla.waterMl > 0;
  const soloIndicadores = ids.filter(id => reagents[id].kind !== 'indicator' && id !== 'water');

  // Qué pasó.
  const quePaso = pasos.map(p => p.paso);
  if (!liquido) quePaso.push('Solo hay sólidos en el matraz. Sin un líquido no pueden reaccionar: añade agua o una disolución.');
  else if (!pasos.length) quePaso.push(soloIndicadores.length < 2
    ? 'Solo hay una sustancia en el matraz, así que no tiene con qué reaccionar. Añade otra para ver si pasa algo.'
    : 'Estas sustancias se mezclan sin reaccionar: según el modelo del laboratorio no cambia nada. Algunas mezclas reales pueden reaccionar de formas que este modelo no incluye.');

  // Cómo quedó.
  const resultado: string[] = [];
  if (liquido && a.pH !== null) resultado.push(`La mezcla final es ${palabraPH(a.pH)}.`);
  for (const id of mezcla.indicators) {
    if (id === 'starch') resultado.push((mezcla.n.I2 ?? 0) > 1e-7 ? 'El almidón se puso azul muy oscuro: confirma que hay yodo.' : 'El almidón no cambió de color porque no hay yodo.');
    else if (a.pH !== null) resultado.push(`${reagents[id].name}: su color confirma que la mezcla es ${palabraPH(a.pH)}. Un indicador solo avisa, no cambia la mezcla.`);
  }
  if (tMax - 25 >= 1.5) resultado.push(`Se calentó hasta unos ${Math.round(tMax)} °C${tMax >= 50 ? ': el matraz quema al tocarlo' : ''}.`);
  if (25 - tMin >= 1.5) resultado.push(`Se enfrió hasta unos ${Math.round(tMin)} °C.`);
  if (a.solids.length) resultado.push(`En el fondo queda ${lista(a.solids.map(s => `${s.name}${s.colorName ? ` (${s.colorName})` : ''}`))}.`);
  else if (eventos.some(e => e.kind === 'precipitado')) resultado.push('El sólido que se había formado volvió a disolverse: el líquido queda sin poso.');
  if (a.gases.length) resultado.push(`Se desprendió ${lista(a.gases.map(g => nombre(g.id)))}.`);
  if (a.ammoniaSmell) resultado.push('Huele a amoníaco.');

  // Productos que conviene conocer.
  const idsProducto = new Set<SpeciesId>([...a.solids.map(s => s.id), ...a.gases.map(g => g.id as SpeciesId)]);
  if (a.ammoniaSmell) idsProducto.add('NH3');
  if (liquido && (mezcla.n.I2 ?? 0) > 1e-6) idsProducto.add('I2');
  const reactivoSolido = new Set(ids.map(id => { const r = reagents[id]; return r.kind === 'solid' ? r.species : null; }));
  const productos = [...idsProducto].filter(id => PRODUCTOS[id] && !reactivoSolido.has(id)).map(id => ({ nombre: nombre(id), ...PRODUCTOS[id]! }));

  // ¿Es peligroso?
  let nivel: Nivel = 'bajo';
  const peligro: string[] = [];
  const sustancias = ids.map(id => ({ id, nombre: reagents[id].name, cantidad: lista(adiciones.filter(x => x.reagent === id).map(cantidad)), ...SUSTANCIAS[id] }));
  for (const s of sustancias) if (s.nivel !== 'bajo') { nivel = peor(nivel, s.nivel); peligro.push(`${s.nombre}: ${s.riesgo}`); }
  for (const p of productos) if (p.nivel !== 'bajo') { nivel = peor(nivel, p.nivel); peligro.push(p.nota); }
  if (liquido && a.pH !== null && (a.pH < 2 || a.pH > 12)) { nivel = peor(nivel, 'precaucion'); peligro.push(`La mezcla final es ${palabraPH(a.pH)}: quema la piel y los ojos.`); }
  if (tMax >= 50) { nivel = peor(nivel, 'precaucion'); peligro.push('Se calienta mucho: puede quemar y salpicar.'); }
  if (!peligro.length) peligro.push('Nada de lo que hay en el matraz es peligroso en estas cantidades. Aun así, en el laboratorio se llevan siempre gafas y guantes.');

  // ¿Es problemático? Residuos.
  // Cuentan los metales disueltos o en sólidos formados; un trozo de metal de la estantería que sobra no contamina.
  const presentes = (Object.keys(mezcla.n) as SpeciesId[]).filter(id => (mezcla.n[id] ?? 0) > 1e-7 && !reactivoSolido.has(id));
  const metales = [...new Set(presentes.map(id => METALES[/^(Pb|Ba|Ag|Cu|Mn|Zn|Fe)(?![a-z])/.exec(id)?.[1] ?? '']).filter(Boolean))];
  const pesados = metales.filter(x => x !== 'hierro');
  const sobrante = ids.filter(id => { const r = reagents[id]; return r.category === 'metal' && r.kind === 'solid' && (mezcla.n[r.species] ?? 0) > 1e-7; });
  let problema: string, desecho: string;
  if (pesados.length) {
    problema = `Sí: contiene ${lista(pesados)}, que contamina el agua y daña a los seres vivos aunque sea en poca cantidad.`;
    desecho = 'Nunca al fregadero. Va al bidón de residuos de metales, que recoge una empresa especializada.';
  } else if (liquido && a.pH !== null && (a.pH < 4 || a.pH > 10)) {
    problema = `Un poco: es ${palabraPH(a.pH)} y así dañaría las tuberías y la vida del agua.`;
    desecho = `Primero se neutraliza (${a.pH < 4 ? 'con bicarbonato' : 'con un poco de vinagre'}) y después va al bidón de residuos acuosos.`;
  } else if (metales.length) {
    problema = 'Poco: lleva hierro, que no es tóxico pero mancha y no debe ir al desagüe.';
    desecho = 'Va al bidón de residuos de metales.';
  } else {
    problema = 'No: son sustancias corrientes y poco contaminantes en estas cantidades.';
    desecho = liquido ? 'Va al bidón de residuos acuosos.' : 'Los sólidos sin usar no se devuelven al frasco: van al contenedor de residuos sólidos.';
  }
  if (mision) desecho = `${mision.waste} ${pesados.length && !/fregadero/.test(mision.waste) ? 'Nunca al fregadero.' : ''}`.trim();
  if (sobrante.length) desecho += ' El metal que sobra se enjuaga y se guarda para otra vez.';

  // ¿Para qué sirve?
  const sirve = [...new Set([...(mision ? [`Objetivo de la misión: ${mision.goal}`] : []), ...pasos.map(p => p.sirve).filter(Boolean)])];
  if (!sirve.length) sirve.push(pasos.length ? '' : 'Aquí no hay reacción, pero comprobar que dos sustancias no reaccionan también es un resultado: así se sabe qué se puede guardar o mezclar sin riesgo.');

  const principal = pasos.find(p => /burbuj|Burbuj|sólido|desplazó|violeta|yodo|descompuso/.test(p.titulo)) ?? pasos[pasos.length - 1];
  return {
    titulo: mision?.title ?? principal?.titulo ?? (!liquido ? 'Sólidos sin líquido' : soloIndicadores.length < 2 ? 'Una sola sustancia' : 'No reaccionan'),
    mision: mision?.id ?? null, quePaso, resultado, nivel, peligro, problema, desecho, sirve: sirve.filter(Boolean), sustancias, productos,
    datos: { volumen: a.volumeMl, temperatura: a.temperatureC, pH: a.pH, ecuaciones: [...new Set(eventos.map(e => e.equation))], solidos: a.solids.map(s => s.label), gases: a.gases.map(g => `${g.label} ${(g.mol * 1000).toLocaleString('es', { maximumFractionDigits: 2 })} mmol`) },
  };
}

/** Cantidades típicas para consultar una mezcla sin hacerla: 20 mL, 1 g o 3 gotas; con agua si no hay ningún líquido. */
export function mezclaDeConsulta(ids: ReagentId[]): Addition[] {
  const tipica = (id: ReagentId): Addition => { const r = reagents[id]; return { reagent: id, amount: r.kind === 'solid' ? 1 : r.kind === 'indicator' ? 3 : r.kind === 'water' ? 50 : 20 }; };
  const unicos = [...new Set(ids)];
  const hayLiquido = unicos.some(id => reagents[id].kind === 'solution' || reagents[id].kind === 'water');
  const orden = [...unicos].sort((x, y) => Number(reagents[x].kind === 'solid' || reagents[x].kind === 'indicator') - Number(reagents[y].kind === 'solid' || reagents[y].kind === 'indicator'));
  return [...(hayLiquido ? [] : [tipica('water')]), ...orden.map(tipica)];
}

let parejas: Map<ReagentId, ReagentId[]> | null = null;
/** Para cada sustancia, con cuáles de las otras reacciona según el modelo (todas las parejas posibles, cantidades típicas). */
export function parejasQueReaccionan() {
  if (parejas) return parejas;
  parejas = new Map(reagentIds.map(id => [id, [] as ReagentId[]]));
  const solo = new Map(reagentIds.map(id => [id, new Set(repetir(mezclaDeConsulta([id])).eventos.map(e => e.rule))]));
  for (let i = 0; i < reagentIds.length; i++) for (let j = i + 1; j < reagentIds.length; j++) {
    const x = reagentIds[i], y = reagentIds[j];
    if (reagents[x].kind === 'indicator' || reagents[y].kind === 'indicator' || x === 'water' || y === 'water') continue;
    // Solo cuenta lo que ocurre por estar juntas, no lo que cada una hace sola en agua (disolverse).
    const nuevas = repetir(mezclaDeConsulta([x, y])).eventos.filter(e => !solo.get(x)!.has(e.rule) && !solo.get(y)!.has(e.rule));
    if (nuevas.some(e => e.extent >= 1e-4)) { parejas.get(x)!.push(y); parejas.get(y)!.push(x); }
  }
  return parejas;
}
