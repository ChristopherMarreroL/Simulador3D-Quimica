// Ejecuta los vectores de referencia de golden/chemistry.json contra este módulo.
// Lo usan el ejecutable independiente (native/ExperimentaChem) y la prueba Automation de Unreal.
#pragma once

#include <string>
#include <string_view>
#include <vector>

#include "ExperimentaChem/Chem.h"

namespace ExperimentaChem
{
	struct FGoldenFamily { std::string Name; int Cases = 0; int Passed = 0; };

	struct FGoldenReport
	{
		/** false si el JSON no se pudo leer; Error dice por qué. */
		bool bParsed = false; std::string Error;
		int Cases = 0; int Passed = 0;
		/** Comprobaciones de tablas (ecuación y ΔH de cada regla, masas molares) que no coinciden. */
		int TableFailures = 0;
		std::vector<FGoldenFamily> Families;
		/** Como mucho MaxFailures líneas: «id paso N.ruta: esperado frente a obtenido». */
		std::vector<std::string> Failures;
		bool AllPassed() const { return bParsed && Cases > 0 && Passed == Cases && TableFailures == 0; }
	};

	/**
	 * JsonText es el contenido de golden/chemistry.json (UTF-8). Aplica la regla de comparación de
	 * golden/lib/compare.ts: relativa 1e-6 con suelo absoluto, pH absoluto 1e-6, color ±1 por canal,
	 * y las relajaciones de las marcas de fragilidad de cada paso.
	 */
	EXPERIMENTACHEM_API FGoldenReport RunGolden(std::string_view JsonText, int MaxFailures = 40);
}
