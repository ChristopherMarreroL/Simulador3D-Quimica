/** Standard atomic weights (IUPAC, abridged to the elements used by the sandbox). */
const atomicWeights: Record<string, number> = {
  H: 1.008, C: 12.011, N: 14.007, O: 15.999, Na: 22.99, Mg: 24.305, S: 32.06, Cl: 35.45, K: 39.098,
  Ca: 40.078, Mn: 54.938, Fe: 55.845, Cu: 63.546, Zn: 65.38, Ag: 107.868, I: 126.904, Ba: 137.327, Pb: 207.2,
};

/** Molar mass (g/mol) of a neutral ASCII formula such as "Cu(OH)2" or "NaHCO3" (no charges). */
export function molarMass(formula: string): number {
  const stack: number[] = [0];
  const pattern = /([A-Z][a-z]?)(\d*)|(\()|(\))(\d*)/g;
  let match: RegExpExecArray | null;
  let consumed = 0;
  while ((match = pattern.exec(formula))) {
    consumed += match[0].length;
    if (match[1]) {
      const weight = atomicWeights[match[1]];
      if (weight === undefined) throw new Error(`Elemento desconocido: ${match[1]}`);
      stack[stack.length - 1] += weight * (match[2] ? Number(match[2]) : 1);
    } else if (match[3]) stack.push(0);
    else {
      if (stack.length < 2) throw new Error(`Fórmula no válida: ${formula}`);
      const group = stack.pop()!;
      stack[stack.length - 1] += group * (match[5] ? Number(match[5]) : 1);
    }
  }
  if (consumed !== formula.length || stack.length !== 1 || !formula) throw new Error(`Fórmula no válida: ${formula}`);
  return stack[0];
}
