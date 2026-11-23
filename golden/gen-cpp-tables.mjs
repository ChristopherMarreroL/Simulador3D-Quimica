// Genera las tablas C++ del módulo ExperimentaChem a partir de golden/chemistry.json.
// Uso: node golden/gen-cpp-tables.mjs   (después de `npm run golden`)
// Así las 65 especies, los 27 reactivos y las 99 reglas no se transcriben a mano.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const target = `${here}/../Unreal/Experimenta3D/Source/ExperimentaChem/Private/Generated/ChemTables.inc`;
const { tables } = JSON.parse(readFileSync(`${here}/chemistry.json`, 'utf8'));

const index = new Map(tables.species.map((s, i) => [s.id, i]));
const species = id => { if (!index.has(id)) throw new Error(`Especie desconocida: ${id}`); return index.get(id); };
/** Literal double que C++ lee como el mismo valor: JS ya escribe la forma más corta que vuelve al mismo double. */
const num = x => { if (!Number.isFinite(x)) throw new Error(`No finito: ${x}`); const s = String(x); return /[.e]/.test(s) ? s : `${s}.0`; };
/** Cadena C con los bytes UTF-8 no ASCII en octal: no depende de la codificación del archivo fuente. */
const str = text => text == null ? 'nullptr' : `"${[...Buffer.from(text, 'utf8')].map(b =>
  b === 0x22 ? '\\"' : b === 0x5c ? '\\\\' : b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : `\\${b.toString(8).padStart(3, '0')}`).join('')}"`;
const terms = pairs => `{ ${pairs.map(([id, c]) => `{ ${species(id)}, ${num(c)} }`).join(', ')} }`;
const phase = { aq: 'EPhase::Aq', s: 'EPhase::S', l: 'EPhase::L', g: 'EPhase::G' };
const kind = { water: 'EReagentKind::Water', solution: 'EReagentKind::Solution', solid: 'EReagentKind::Solid', indicator: 'EReagentKind::Indicator' };

const speciesRows = tables.species.map(s =>
  `\t\t{ ${str(s.id)}, ${str(s.label)}, ${str(s.formula)}, ${s.charge}, ${phase[s.phase]}, ${s.dHf !== null}, ${num(s.dHf ?? 0)}, ${str(s.name)}, ${str(s.color)}, ${str(s.colorName)}, ${num(s.molarMass)} },`);
const reagentRows = tables.reagents.map(r =>
  `\t\t{ ${str(r.id)}, ${str(r.name)}, ${kind[r.kind]}, ${num(r.concentration ?? 0)}, ${r.components ? terms(r.components) : '{}'}, ${r.species ? species(r.species) : -1}, ${str(r.indicator)}, ${num(r.range.min)}, ${num(r.range.max)}, ${str(r.range.unit)} },`);
const ruleRows = tables.rules.map(r => r.type === 'complete'
  ? `\t\t{ ${str(r.id)}, ERuleType::Complete, ${str(r.kind)}, ${terms(r.reactants)}, ${terms(r.products)}, { ${r.catalysts.map(species).join(', ')} }, -1, 0.0, ${num(r.vigor)}, ${str(r.title)}, ${str(r.note)} },`
  : `\t\t{ ${str(r.id)}, ERuleType::Solubility, nullptr, ${terms(r.reactants)}, ${terms(r.products)}, {}, ${species(r.solid)}, ${num(r.ksp)}, ${num(r.vigor)}, nullptr, ${str(r.note)} },`);

const c = tables.constants;
const text = `// GENERADO por golden/gen-cpp-tables.mjs a partir de golden/chemistry.json. No editar a mano.
// ${tables.species.length} especies, ${tables.reagents.length} reactivos, ${tables.rules.length} reglas.

namespace Generated
{
	// Constantes ya calculadas por TypeScript (10 ** -2.74, Kw / Kb…): se cargan como literales para no depender de pow().
	constexpr double GasLPerMol = ${num(c.GAS_L_PER_MOL)};
	constexpr double MolarMassBicarbonate = ${num(c.MOLAR_MASS_BICARBONATE)};
	constexpr double KaHAc = ${num(c.ka.HAc)};
	constexpr double KaH2CO3 = ${num(c.ka.H2CO3)};
	constexpr double KaHCO3 = ${num(c.ka.HCO3)};
	constexpr double KaNH4 = ${num(c.ka.NH4)};
	constexpr double KaHSO4 = ${num(c.ka.HSO4)};
	constexpr double KaFe3 = ${num(c.ka.Fe3)};
	constexpr double KaCu2 = ${num(c.ka.Cu2)};
	constexpr double KaZn2 = ${num(c.ka.Zn2)};

	static std::vector<FSpecies> BuildSpecies()
	{
		return {
${speciesRows.join('\n')}
		};
	}

	static std::vector<FReagent> BuildReagents()
	{
		return {
${reagentRows.join('\n')}
		};
	}

	static std::vector<FRule> BuildRules()
	{
		return {
${ruleRows.join('\n')}
		};
	}
}
`;
if (tables.species.length !== 65) throw new Error('Chem.h fija NumSpecies = 65: actualízalo si cambia el número de especies.');
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, text, 'utf8');
console.log(`ChemTables.inc: ${tables.species.length} especies, ${tables.reagents.length} reactivos, ${tables.rules.length} reglas, ${text.length} caracteres`);
