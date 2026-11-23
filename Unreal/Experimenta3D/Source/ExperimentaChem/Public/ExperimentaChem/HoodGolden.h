// Ejecuta los vectores de la capa de estado de la campana (golden/steps.json) contra Hood.h.
// Lo usan el ejecutable independiente (native/ExperimentaChem, steps_golden) y la prueba Automation de Unreal.
#pragma once

#include <string>
#include <string_view>
#include <vector>

#include "ExperimentaChem/Golden.h"

namespace ExperimentaChem
{
	struct FStepsReport
	{
		/** false si el JSON no se pudo leer; Error dice por qué. */
		bool bParsed = false; std::string Error;
		int Cases = 0; int Passed = 0; int Ops = 0;
		/** Comprobaciones de tablas (constantes, orden del estante, textos de pasos y de eventos) que no coinciden. */
		int TableFailures = 0;
		std::vector<FGoldenFamily> Families;
		/** Como mucho MaxFailures líneas: «id op N (operación).ruta: esperado frente a obtenido». */
		std::vector<std::string> Failures;
		bool AllPassed() const { return bParsed && Cases > 0 && Passed == Cases && TableFailures == 0; }
	};

	/**
	 * JsonText es el contenido de golden/steps.json (UTF-8). Aplica la regla de golden/steps/lib/compare.ts:
	 * reconstruye el estado completo tras cada operación aplicando `cambia` y lo compara con el del porte;
	 * exactos los textos, enumeraciones, el reloj y lo que la capa calcula con aritmética simple (mL, gramos,
	 * cantidades, contadores); con la tolerancia de chemistry.json lo que sale del motor químico.
	 * Omit son claves del estado que no se comparan (por ejemplo "burst"); vacío compara todas.
	 */
	EXPERIMENTACHEM_API FStepsReport RunStepsGolden(std::string_view JsonText, int MaxFailures = 40, const std::vector<std::string>& Omit = {});
}
