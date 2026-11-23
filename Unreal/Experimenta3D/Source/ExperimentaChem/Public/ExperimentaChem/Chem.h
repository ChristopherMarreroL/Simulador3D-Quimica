// Motor químico de Experimenta 3D: porte a C++ estándar de src/chemistry (TypeScript).
//
// Reglas de este módulo:
// - Solo C++17 y la biblioteca estándar: ningún tipo de Unreal, sin excepciones, sin RTTI, sin E/S.
// - Reproduce el comportamiento del TypeScript tal cual, incluidas sus rarezas (ver golden/README.md).
//   La paridad se comprueba con golden/chemistry.json; no «mejores» un algoritmo sin regenerar los vectores.
// - Todo el texto es UTF-8.
#pragma once

#include <array>
#include <optional>
#include <string>
#include <string_view>
#include <vector>

// Unreal define EXPERIMENTACHEM_API al compilar el módulo; fuera del motor no hace falta exportar nada.
#ifndef EXPERIMENTACHEM_API
#define EXPERIMENTACHEM_API
#endif

namespace ExperimentaChem
{
	// ---------------------------------------------------------------- Tablas (generadas desde golden/chemistry.json)

	enum class EPhase { Aq, S, L, G };
	enum class EReagentKind { Water, Solution, Solid, Indicator };
	enum class ERuleType { Complete, Solubility };

	/** Coeficiente o cantidad de una especie. `Species` es un índice de GetSpecies(). */
	struct FTerm { int Species; double Amount; };

	struct FSpecies
	{
		const char* Id; const char* Label; const char* Formula; int Charge; EPhase Phase;
		bool bHasDHf; double DHf;      // kJ/mol; sin valor de referencia si bHasDHf es false
		const char* Name;
		const char* Color;             // "#rrggbb" o nullptr si es incoloro
		const char* ColorName;         // nullptr si no tiene
		double MolarMass;              // g/mol, tal como lo calcula molarMass(formula) en TypeScript
	};

	struct FReagent
	{
		const char* Id; const char* Name; EReagentKind Kind;
		double Concentration;                 // mol/L (solo Solution)
		std::vector<FTerm> Components;        // iones por mol de soluto (solo Solution)
		int Species;                          // especie sólida (solo Solid); -1 en otro caso
		const char* Indicator;                // id del indicador (solo Indicator); nullptr en otro caso
		double Min, Max;                      // rango válido de cantidad
		const char* Unit;                     // "mL", "g" o "gotas"
	};

	struct FRule
	{
		const char* Id; ERuleType Type;
		const char* Kind;                     // solo Complete: "neutralización", "gas", "disolución", "redox" o "descomposición"
		std::vector<FTerm> Reactants;         // Complete: reactivos. Solubility: iones (sentido de precipitación).
		std::vector<FTerm> Products;          // Complete: productos. Solubility: sólido y, si la hay, agua.
		std::vector<int> Catalysts;           // solo Complete; vacío si no los necesita
		int Solid;                            // solo Solubility; -1 en otro caso
		double Ksp;                           // solo Solubility
		double Vigor;
		const char* Title;                    // solo Complete
		const char* Note;
	};

	/** En el orden de `speciesIds`: lo usan solvePH y analyzeMixture. */
	EXPERIMENTACHEM_API const std::vector<FSpecies>& GetSpecies();
	/** En el orden de declaración de `reagents`. */
	EXPERIMENTACHEM_API const std::vector<FReagent>& GetReagents();
	/** En orden de prioridad: react() las recorre así en cada pasada. */
	EXPERIMENTACHEM_API const std::vector<FRule>& GetRules();
	/** Índice de la especie o -1. */
	EXPERIMENTACHEM_API int FindSpecies(std::string_view Id);
	/** Índice del reactivo o -1. */
	EXPERIMENTACHEM_API int FindReagent(std::string_view Id);

	constexpr int NumSpecies = 65;
	constexpr double VesselMl = 500.0;
	constexpr double RoomC = 25.0;
	constexpr double DropMl = 0.05;

	// ---------------------------------------------------------------- Errores

	enum class EError { None, UnknownReagent, Range, Overflow, UnknownElement, BadFormula };

	/** Sustituye a las excepciones de TypeScript. Si bOk es false, Value no es válido y Message lleva el texto exacto. */
	template <typename T>
	struct TResult
	{
		bool bOk = false; EError Code = EError::None; std::string Message; T Value{};
		static TResult Ok(T InValue) { TResult R; R.bOk = true; R.Value = std::move(InValue); return R; }
		static TResult Fail(EError InCode, std::string InMessage) { TResult R; R.Code = InCode; R.Message = std::move(InMessage); return R; }
	};

	// ---------------------------------------------------------------- Campana: mezclas libres (sandbox.ts)

	enum class EGas { CO2 = 0, H2 = 1, O2 = 2 };

	struct FAddition { int Reagent; double Amount; };

	struct FMixture
	{
		/** Moles por especie, indexado como GetSpecies(). 0 equivale a «clave ausente» en TypeScript. */
		std::array<double, NumSpecies> N{};
		double WaterMl = 0.0;
		double TemperatureC = RoomC;
		/** Ids de indicador sin repetir, en orden de primera adición. */
		std::vector<std::string> Indicators;
		std::vector<FAddition> Additions;
		/** Moles acumulados de CO2, H2 y O2 (índice EGas). 0 equivale a «clave ausente». */
		std::array<double, 3> Released{};
		bool bHeatUnknown = false;
	};

	struct FSpeciesAmount { int Species; double Mol; };

	struct FEvent
	{
		int Rule;                              // índice de GetRules()
		std::string Kind;                      // Complete: el de la regla. Solubility: "precipitado" o "disolución".
		std::string Title, Note, Equation;
		double Extent; double Vigor;
		std::optional<double> DeltaH;          // kJ por mol de reacción en el sentido del evento
		std::optional<double> Heat;            // kJ liberados a la mezcla
		std::optional<FSpeciesAmount> Gas, Solid;
	};

	struct FMixOutcome
	{
		FMixture Mixture; std::vector<FEvent> Events; double DeltaT = 0.0; double HeatKJ = 0.0; std::string Note;
	};

	EXPERIMENTACHEM_API FMixture EmptyMixture();
	/** addReagent: añade un reactivo a temperatura ambiente y deja reaccionar la mezcla. No modifica Current. */
	EXPERIMENTACHEM_API TResult<FMixOutcome> AddReagent(const FMixture& Current, std::string_view ReagentId, double Amount);
	/** solvePH: sin líquido devuelve nullopt. */
	EXPERIMENTACHEM_API std::optional<double> SolvePH(const FMixture& Mixture);

	struct FIndicatorColor { std::string Color; double Strength; };
	/** indicatorColor: nullopt cuando TypeScript devuelve null. */
	EXPERIMENTACHEM_API std::optional<FIndicatorColor> IndicatorColor(std::string_view Indicator, double PH);

	struct FSolutionColor { std::string Color; double Opacity; };
	/** solutionColor: PH nullopt equivale a pasar null (los indicadores no cuentan). */
	EXPERIMENTACHEM_API FSolutionColor SolutionColor(const FMixture& Mixture, std::optional<double> PH);

	struct FSolidInfo { int Species; double Mol; double Grams; };
	struct FDissolvedInfo { int Species; double Molarity; };
	struct FGasInfo { EGas Gas; double Mol; double Litres; };
	struct FAnalysis
	{
		std::optional<double> PH; FSolutionColor Color;
		std::vector<FSolidInfo> Solids;        // por gramos descendente, orden estable
		std::vector<FDissolvedInfo> Dissolved; // por molaridad descendente, orden estable
		std::vector<FGasInfo> Gases;           // CO2, H2, O2
		double VolumeMl = 0.0; double TemperatureC = RoomC; bool bAmmoniaSmell = false;
	};
	EXPERIMENTACHEM_API FAnalysis AnalyzeMixture(const FMixture& Mixture);
	EXPERIMENTACHEM_API double GasLitres(double Mol);

	/** equationText y reactionEnthalpy, expuestas para comprobarlas contra las tablas. */
	EXPERIMENTACHEM_API std::string EquationText(const std::vector<FTerm>& Reactants, const std::vector<FTerm>& Products);
	EXPERIMENTACHEM_API std::optional<double> ReactionEnthalpy(const std::vector<FTerm>& Reactants, const std::vector<FTerm>& Products);

	// ---------------------------------------------------------------- Fórmulas (formula.ts)

	EXPERIMENTACHEM_API TResult<double> MolarMass(std::string_view Formula);

	// ---------------------------------------------------------------- Mesas 01–03 (reaction.ts, solutions.ts)

	struct FReactionResult
	{
		double AcidMoles, BicarbonateMoles, Co2Moles; std::string Limiting; double AcidRemaining, BicarbonateRemaining, Co2Litres;
	};
	EXPERIMENTACHEM_API TResult<FReactionResult> CalculateReaction(double VinegarMl, double Concentration, double BicarbonateG);

	struct FConductivityResult { double MicroSiemens, Brightness, IonMolarity; };
	/** Solution: "water", "salt" o "sugar". */
	EXPERIMENTACHEM_API TResult<FConductivityResult> Conductivity(std::string_view Solution, double Concentration);

	struct FCrystallizationResult { double InitialDissolved, InitialSolid, RemainingWater, EvaporatedWater, Dissolved, Solid, NewCrystals; };
	EXPERIMENTACHEM_API TResult<FCrystallizationResult> Crystallization(double WaterG, double SaltG, double EvaporationPercent);

	// ---------------------------------------------------------------- Texto (equivalentes a toLocaleString('es') y Math.round)

	/** Número en español con coma decimal y como mucho MaxFractionDigits decimales, sin ceros finales; mitad hacia fuera de cero. */
	EXPERIMENTACHEM_API std::string FormatEs(double Value, int MaxFractionDigits = 3);
	/** Math.round de JavaScript: entero más cercano con la mitad hacia +∞; conserva NaN, ±∞ y -0. No es floor(x + 0,5). */
	EXPERIMENTACHEM_API double JsRound(double Value);
}
