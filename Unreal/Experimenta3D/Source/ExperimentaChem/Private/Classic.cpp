#include "ExperimentaChem/Chem.h"

#include <algorithm>
#include <cmath>
#include <utility>

// IEEE estricto aunque el módulo se compile sin FPSemanticsMode.Precise (ver Sandbox.cpp): con /fp:fast el compilador
// reagrupa las operaciones y los resultados dejan de coincidir en bits con el TypeScript.
#if defined(_MSC_VER)
#pragma float_control(precise, on, push)
#endif

// Porte de src/chemistry/reaction.ts y solutions.ts (mesas 01–03). Los límites son estrictos, sin tolerancia,
// y el orden de las operaciones es el del TypeScript: los residuos de coma flotante forman parte del contrato.
// El guion de los mensajes (U+2013) va en un literal aparte cuando le sigue una cifra, para no alargar el escape octal.
namespace ExperimentaChem
{
	namespace ClassicDetail
	{
		/** MOLAR_MASS_BICARBONATE de reaction.ts; formula.ts da 84,006 para NaHCO3 (rareza congelada). */
		constexpr double MolarMassBicarbonate = 84.0066;
	}

	TResult<FReactionResult> CalculateReaction(double VinegarMl, double Concentration, double BicarbonateG)
	{
		if (!(std::isfinite(VinegarMl) && std::isfinite(Concentration) && std::isfinite(BicarbonateG))
			|| VinegarMl < 1.0 || VinegarMl > 150.0 || Concentration < 0.01 || Concentration > 2.0 || BicarbonateG < 0.01 || BicarbonateG > 10.0)
		{
			return TResult<FReactionResult>::Fail(EError::Range, "Usa 1\342\200\223" "150 mL de vinagre, 0,01\342\200\223" "2 mol/L y 0,01\342\200\223" "10 g de bicarbonato.");
		}
		const double AcidMoles = VinegarMl / 1000.0 * Concentration;
		const double BicarbonateMoles = BicarbonateG / ClassicDetail::MolarMassBicarbonate;
		const double Co2Moles = (std::min)(AcidMoles, BicarbonateMoles);
		FReactionResult Result;
		Result.AcidMoles = AcidMoles;
		Result.BicarbonateMoles = BicarbonateMoles;
		Result.Co2Moles = Co2Moles;
		Result.Limiting = std::fabs(AcidMoles - BicarbonateMoles) < 1e-9 ? "Proporci\303\263n estequiom\303\251trica"
			: AcidMoles < BicarbonateMoles ? "\303\201cido ac\303\251tico" : "Bicarbonato de sodio";
		Result.AcidRemaining = (std::max)(0.0, AcidMoles - Co2Moles);
		Result.BicarbonateRemaining = (std::max)(0.0, BicarbonateMoles - Co2Moles);
		// Gas ideal seco a 25 °C y 1 atm. Se multiplica en dos pasos, como en reaction.ts, no por la constante ya multiplicada.
		Result.Co2Litres = Co2Moles * 0.082057 * 298.15;
		return TResult<FReactionResult>::Ok(std::move(Result));
	}

	TResult<FConductivityResult> Conductivity(std::string_view Solution, double Concentration)
	{
		const bool bSalt = Solution == "salt";
		if (!(Solution == "water" || bSalt || Solution == "sugar") || !std::isfinite(Concentration) || Concentration < 0.001 || Concentration > 0.02)
		{
			return TResult<FConductivityResult>::Fail(EError::Range, "Usa una concentraci\303\263n de 0,001 a 0,020 mol/L.");
		}
		// Dilución límite a 25 °C sobre el fondo del agua pura (0,055 µS/cm); el azúcar no aporta iones.
		FConductivityResult Result;
		Result.MicroSiemens = 0.055 + (bSalt ? 126.4 * Concentration * 1000.0 : 0.0);
		Result.Brightness = bSalt ? (std::min)(1.0, Result.MicroSiemens / 2528.055) : 0.0;
		Result.IonMolarity = bSalt ? 2.0 * Concentration : 0.0;
		return TResult<FConductivityResult>::Ok(Result);
	}

	TResult<FCrystallizationResult> Crystallization(double WaterG, double SaltG, double EvaporationPercent)
	{
		if (!(std::isfinite(WaterG) && std::isfinite(SaltG) && std::isfinite(EvaporationPercent))
			|| WaterG < 50.0 || WaterG > 150.0 || SaltG < 1.0 || SaltG > 50.0 || EvaporationPercent < 0.0 || EvaporationPercent > 90.0)
		{
			return TResult<FCrystallizationResult>::Fail(EError::Range, "Usa 50\342\200\223" "150 g de agua, 1\342\200\223" "50 g de sal y 0\342\200\223" "90 % de evaporaci\303\263n.");
		}
		// Equilibrio a 20 °C con la solubilidad redondeada del NaCl: 36 g por 100 g de agua.
		FCrystallizationResult Result;
		Result.InitialDissolved = (std::min)(SaltG, 0.36 * WaterG);
		Result.InitialSolid = SaltG - Result.InitialDissolved;
		Result.RemainingWater = WaterG * (1.0 - EvaporationPercent / 100.0);
		Result.EvaporatedWater = WaterG - Result.RemainingWater;
		Result.Dissolved = (std::min)(SaltG, 0.36 * Result.RemainingWater);
		Result.Solid = SaltG - Result.Dissolved;
		Result.NewCrystals = (std::max)(0.0, Result.Solid - Result.InitialSolid);
		return TResult<FCrystallizationResult>::Ok(Result);
	}
}

#if defined(_MSC_VER)
#pragma float_control(pop)
#endif
