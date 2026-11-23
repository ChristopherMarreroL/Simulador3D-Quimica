// Porte de src/chemistry/sandbox.ts: mezclas libres de la campana.
// Traducción fiel: el orden de las operaciones aritméticas, los umbrales y las iteraciones son los del
// TypeScript. No simplificar expresiones (a * b / c no es a * (b / c) en coma flotante).
#include "ExperimentaChem/Chem.h"

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <limits>
#include <utility>

// La paridad con el TypeScript exige IEEE estricto. Unreal compila los juegos empaquetados con /fp:fast salvo que el
// módulo pida FPSemanticsMode.Precise: con /fp:fast los vectores de referencia fallan (cambia el orden de los empates).
// Este pragma protege el archivo aunque falte ese ajuste; con /fp:precise no tiene efecto.
#if defined(_MSC_VER)
#pragma float_control(precise, on, push)
#endif

namespace ExperimentaChem
{
	// Todo lo interno va en un espacio de nombres propio: Unreal puede unir varios .cpp en una sola unidad.
	namespace SandboxPrivate
	{
		constexpr double Kw = 1e-14;
		constexpr double WaterHeatCapacity = 4.184;        // J g⁻¹ K⁻¹
		constexpr double WaterMolarMl = 18.015 / 0.997;    // mL de agua líquida por mol a 25 °C
		constexpr double GasLPerMol = 0.082057 * 298.15;   // gas ideal a 25 °C y 1 atm

		// Constantes de acidez de constants.ts ya evaluadas (10 ** -2.74, Kw / Kb…). Son los mismos literales que
		// Generated::Ka* de ChemTables.inc (golden/chemistry.json → tables.constants.ka): si cambian allí, cambian aquí.
		constexpr double KaHAc = 0.000018;
		constexpr double KaH2CO3 = 4.3e-7;
		constexpr double KaHCO3 = 4.7e-11;
		constexpr double KaNH4 = 5.555555555555555e-10;
		constexpr double KaHSO4 = 0.012;
		constexpr double KaFe3 = 0.0018197008586099826;
		constexpr double KaCu2 = 5.011872336272725e-7;
		constexpr double KaZn2 = 2.511886431509582e-10;

		using FAmounts = std::array<double, NumSpecies>;

		// ------------------------------------------------------------ Semántica de JavaScript

		/** Math.min de dos valores: NaN si alguno lo es y -0 por debajo de +0. */
		static double JsMin(double A, double B)
		{
			if (std::isnan(A) || std::isnan(B)) { return std::numeric_limits<double>::quiet_NaN(); }
			if (A == 0.0 && B == 0.0) { return std::signbit(A) ? A : B; }
			return A < B ? A : B;
		}

		/** Math.max de dos valores: NaN si alguno lo es y +0 por encima de -0. */
		static double JsMax(double A, double B)
		{
			if (std::isnan(A) || std::isnan(B)) { return std::numeric_limits<double>::quiet_NaN(); }
			if (A == 0.0 && B == 0.0) { return std::signbit(A) ? B : A; }
			return A > B ? A : B;
		}

		/** String(número) para los valores que aparecen en los textos: enteros y decimales cortos. */
		static std::string JsNumber(double Value)
		{
			if (std::isnan(Value)) { return "NaN"; }
			if (std::isinf(Value)) { return Value > 0.0 ? "Infinity" : "-Infinity"; }
			char Buffer[40];
			if (Value == std::floor(Value) && std::fabs(Value) < 1e15)
			{
				std::snprintf(Buffer, sizeof(Buffer), "%lld", static_cast<long long>(Value));
				return Buffer;
			}
			// La forma más corta que vuelve al mismo double, como hace JavaScript.
			for (int Precision = 1; Precision <= 17; ++Precision)
			{
				std::snprintf(Buffer, sizeof(Buffer), "%.*g", Precision, Value);
				if (std::strtod(Buffer, nullptr) == Value) { break; }
			}
			std::string Text = Buffer;
			for (char& Character : Text) { if (Character == ',') { Character = '.'; } }
			return Text;
		}

		/** String.prototype.trim para espacios ASCII. */
		static std::string Trim(const std::string& Text)
		{
			size_t First = 0;
			size_t Last = Text.size();
			while (First < Last && Text[First] == ' ') { ++First; }
			while (Last > First && Text[Last - 1] == ' ') { --Last; }
			return Text.substr(First, Last - First);
		}

		// ------------------------------------------------------------ Acceso a las tablas

		static const FSpecies& SpeciesInfo(int Species) { return GetSpecies()[static_cast<size_t>(Species)]; }
		static double MolOf(const FAmounts& N, int Species) { return N[static_cast<size_t>(Species)]; }
		static double& MolRef(FAmounts& N, int Species) { return N[static_cast<size_t>(Species)]; }

		struct FIds
		{
			int H, OH, H2O, HAc, Ac, HCO3, CO3, NH4, NH3, SO4, Fe3, Fe2, Cu2, Zn2, MnO4, Mn2, I2, CO2, H2, O2;
		};

		static const FIds& Ids()
		{
			static const FIds Table = {
				FindSpecies("H+"), FindSpecies("OH-"), FindSpecies("H2O"), FindSpecies("HAc"), FindSpecies("Ac-"),
				FindSpecies("HCO3-"), FindSpecies("CO3-2"), FindSpecies("NH4+"), FindSpecies("NH3"), FindSpecies("SO4-2"),
				FindSpecies("Fe3+"), FindSpecies("Fe2+"), FindSpecies("Cu2+"), FindSpecies("Zn2+"), FindSpecies("MnO4-"),
				FindSpecies("Mn2+"), FindSpecies("I2"), FindSpecies("CO2"), FindSpecies("H2"), FindSpecies("O2") };
			return Table;
		}

		/** Índice de EGas de una especie gaseosa o -1. */
		static int GasIndex(int Species)
		{
			const FIds& Id = Ids();
			if (Species == Id.CO2) { return static_cast<int>(EGas::CO2); }
			if (Species == Id.H2) { return static_cast<int>(EGas::H2); }
			if (Species == Id.O2) { return static_cast<int>(EGas::O2); }
			return -1;
		}

		static const char* PhaseText(EPhase Phase)
		{
			switch (Phase)
			{
			case EPhase::Aq: return "ac";
			case EPhase::S: return "s";
			case EPhase::L: return "l";
			case EPhase::G: return "g";
			}
			return "";
		}

		static std::string SideText(const std::vector<FTerm>& Terms)
		{
			std::string Text;
			for (size_t Index = 0; Index < Terms.size(); ++Index)
			{
				const FTerm& Term = Terms[Index];
				const FSpecies& Info = SpeciesInfo(Term.Species);
				if (Index > 0) { Text += " + "; }
				if (Term.Amount != 1.0) { Text += JsNumber(Term.Amount); Text += ' '; }
				Text += Info.Label;
				Text += '(';
				Text += PhaseText(Info.Phase);
				Text += ')';
			}
			return Text;
		}

		// ------------------------------------------------------------ Equilibrios y reacciones

		/** logQ de solubilityShift: logaritmo del producto iónico tras precipitar Xi mol. */
		static double LogQ(const FAmounts& N, const std::vector<FTerm>& Ions, double Litres, double Xi)
		{
			double Sum = 0.0;
			for (const FTerm& Ion : Ions)
			{
				const double Left = MolOf(N, Ion.Species) - Ion.Amount * Xi;
				if (Left <= 1e-300) { return -std::numeric_limits<double>::infinity(); }
				Sum += Ion.Amount * std::log(Left / Litres);
			}
			return Sum;
		}

		/** solubilityShift: moles que precipitan (positivo) o se disuelven (negativo) para volver al Ksp. */
		static double SolubilityShift(const FAmounts& N, const FRule& Rule, double Litres)
		{
			const std::vector<FTerm>& Ions = Rule.Reactants;
			const double Solid = MolOf(N, Rule.Solid);
			const double LogK = std::log(Rule.Ksp);
			const double Q0 = LogQ(N, Ions, Litres, 0.0);
			if (Q0 > LogK + 1e-7)
			{
				double Lo = 0.0;
				double Hi = std::numeric_limits<double>::infinity();
				for (const FTerm& Ion : Ions) { Hi = JsMin(Hi, MolOf(N, Ion.Species) / Ion.Amount); }
				for (int Step = 0; Step < 90; ++Step)
				{
					const double Mid = (Lo + Hi) / 2.0;
					if (LogQ(N, Ions, Litres, Mid) > LogK) { Lo = Mid; } else { Hi = Mid; }
				}
				return Lo;
			}
			if (Q0 < LogK - 1e-7 && Solid > 0.0)
			{
				if (LogQ(N, Ions, Litres, -Solid) <= LogK) { return -Solid; }
				double Lo = -Solid;
				double Hi = 0.0;
				for (int Step = 0; Step < 90; ++Step)
				{
					const double Mid = (Lo + Hi) / 2.0;
					if (LogQ(N, Ions, Litres, Mid) > LogK) { Lo = Mid; } else { Hi = Mid; }
				}
				return Hi;
			}
			return 0.0;
		}

		/** shift: avanza la reacción Xi mol. El agua cambia el volumen y los gases salen del matraz abierto. */
		static void Shift(FMixture& Mix, const std::vector<FTerm>& Reactants, const std::vector<FTerm>& Products, double Xi)
		{
			const int Water = Ids().H2O;
			for (int Side = 0; Side < 2; ++Side)
			{
				const std::vector<FTerm>& Terms = Side == 0 ? Reactants : Products;
				const double Sign = Side == 0 ? -1.0 : 1.0;
				for (const FTerm& Term : Terms)
				{
					if (Term.Species == Water)
					{
						Mix.WaterMl = JsMax(0.0, Mix.WaterMl + Sign * Term.Amount * Xi * WaterMolarMl);
						continue;
					}
					if (SpeciesInfo(Term.Species).Phase == EPhase::G)
					{
						const int Gas = GasIndex(Term.Species);
						if (Gas >= 0)
						{
							double& Released = Mix.Released[static_cast<size_t>(Gas)];
							Released = Released + Sign * Term.Amount * Xi;
						}
						continue;
					}
					double& Stored = MolRef(Mix.N, Term.Species);
					const double Next = Stored + Sign * Term.Amount * Xi;
					Stored = Next > 1e-15 ? Next : 0.0;   // 0 equivale a «delete mix.n[id]»
				}
			}
		}

		struct FExtent { int Rule; double Xi; };

		/** react: aplica todas las reglas hasta que nada cambia. Devuelve el avance neto por regla, en orden de primera aparición. */
		static std::vector<FExtent> React(FMixture& Mix)
		{
			std::vector<FExtent> Extents;
			if (Mix.WaterMl <= 0.0) { return Extents; }
			const std::vector<FRule>& Rules = GetRules();
			std::vector<int> Slots(Rules.size(), -1);
			for (int Pass = 0; Pass < 120; ++Pass)
			{
				bool bChanged = false;
				for (size_t RuleIndex = 0; RuleIndex < Rules.size(); ++RuleIndex)
				{
					const FRule& Rule = Rules[RuleIndex];
					double Xi = 0.0;
					if (Rule.Type == ERuleType::Complete)
					{
						if (!Rule.Catalysts.empty())
						{
							bool bCatalysed = false;
							for (const int Catalyst : Rule.Catalysts)
							{
								if (MolOf(Mix.N, Catalyst) > 1e-9) { bCatalysed = true; break; }
							}
							if (!bCatalysed) { continue; }
						}
						Xi = std::numeric_limits<double>::infinity();
						for (const FTerm& Term : Rule.Reactants) { Xi = JsMin(Xi, MolOf(Mix.N, Term.Species) / Term.Amount); }
					}
					else
					{
						Xi = SolubilityShift(Mix.N, Rule, Mix.WaterMl / 1000.0);
					}
					if (!(std::fabs(Xi) > 1e-13)) { continue; }   // también salta con NaN
					Shift(Mix, Rule.Reactants, Rule.Products, Xi);
					if (Slots[RuleIndex] < 0)
					{
						Slots[RuleIndex] = static_cast<int>(Extents.size());
						Extents.push_back({ static_cast<int>(RuleIndex), 0.0 + Xi });
					}
					else
					{
						FExtent& Extent = Extents[static_cast<size_t>(Slots[RuleIndex])];
						Extent.Xi = Extent.Xi + Xi;
					}
					if (std::fabs(Xi) > 1e-11) { bChanged = true; }
				}
				if (!bChanged) { break; }
			}
			return Extents;
		}

		static bool HasTerm(const std::vector<FTerm>& Terms, int Species)
		{
			for (const FTerm& Term : Terms) { if (Term.Species == Species) { return true; } }
			return false;
		}

		/** toEvent: describe el avance neto de una regla en el sentido en que ocurrió. */
		static FEvent ToEvent(int RuleIndex, double Xi)
		{
			const FRule& Rule = GetRules()[static_cast<size_t>(RuleIndex)];
			const bool bForward = Xi > 0.0;
			const std::vector<FTerm>& Reactants = bForward ? Rule.Reactants : Rule.Products;
			const std::vector<FTerm>& Products = bForward ? Rule.Products : Rule.Reactants;

			FEvent Event;
			Event.Rule = RuleIndex;
			Event.Extent = std::fabs(Xi);
			Event.Vigor = Rule.Vigor;
			Event.DeltaH = ReactionEnthalpy(Reactants, Products);
			if (Event.DeltaH.has_value()) { Event.Heat = -*Event.DeltaH * Event.Extent; }
			Event.Equation = EquationText(Reactants, Products);

			if (Rule.Type == ERuleType::Solubility)
			{
				const FSpecies& Solid = SpeciesInfo(Rule.Solid);
				if (bForward)
				{
					Event.Kind = "precipitado";
					Event.Title = std::string("Se forma un s\303\263lido ") + (Solid.ColorName ? Solid.ColorName : "undefined") + ": " + Solid.Label;
					Event.Note = Trim(std::string("Cuando el producto de las concentraciones supera el Ksp, el exceso precipita. ") + Rule.Note);
					Event.Solid = FSpeciesAmount{ Rule.Solid, Event.Extent };
				}
				else
				{
					Event.Kind = "disoluci\303\263n";
					Event.Title = std::string("Se disuelve ") + Solid.Name;
					Event.Note = "El s\303\263lido pasa a la disoluci\303\263n hasta alcanzar su l\303\255mite de solubilidad.";
				}
				return Event;
			}

			Event.Kind = Rule.Kind;
			Event.Title = Rule.Title;
			Event.Note = Rule.Note;
			// Primer producto gaseoso y primer producto sólido que no sea también reactivo.
			for (const FTerm& Term : Products)
			{
				if (SpeciesInfo(Term.Species).Phase == EPhase::G)
				{
					Event.Gas = FSpeciesAmount{ Term.Species, Term.Amount * Event.Extent };
					break;
				}
			}
			for (const FTerm& Term : Products)
			{
				if (SpeciesInfo(Term.Species).Phase == EPhase::S && !HasTerm(Reactants, Term.Species))
				{
					Event.Solid = FSpeciesAmount{ Term.Species, Term.Amount * Event.Extent };
					break;
				}
			}
			return Event;
		}

		// ------------------------------------------------------------ Colores

		struct FRgb { double R, G, B; };
		struct FStop { double X; const char* Color; };
		struct FLayer { FRgb Rgb; double W; };

		static double HexDigit(char Character)
		{
			if (Character >= '0' && Character <= '9') { return static_cast<double>(Character - '0'); }
			if (Character >= 'a' && Character <= 'f') { return static_cast<double>(Character - 'a' + 10); }
			if (Character >= 'A' && Character <= 'F') { return static_cast<double>(Character - 'A' + 10); }
			return 0.0;
		}

		/** hex: "#rrggbb" a tres canales. */
		static FRgb Hex(std::string_view Color)
		{
			if (Color.size() < 7) { return FRgb{ 0.0, 0.0, 0.0 }; }
			return FRgb{
				HexDigit(Color[1]) * 16.0 + HexDigit(Color[2]),
				HexDigit(Color[3]) * 16.0 + HexDigit(Color[4]),
				HexDigit(Color[5]) * 16.0 + HexDigit(Color[6]) };
		}

		static void AppendChannel(std::string& Text, double Value)
		{
			const double Rounded = JsRound(JsMax(0.0, JsMin(255.0, Value)));
			if (std::isnan(Rounded)) { Text += "NaN"; return; }
			static const char Digits[] = "0123456789abcdef";
			const int Channel = static_cast<int>(Rounded);
			Text += Digits[(Channel >> 4) & 15];
			Text += Digits[Channel & 15];
		}

		/** toHex: recorta a 0–255, redondea como Math.round y escribe en minúsculas. */
		static std::string ToHex(const FRgb& Color)
		{
			std::string Text = "#";
			AppendChannel(Text, Color.R);
			AppendChannel(Text, Color.G);
			AppendChannel(Text, Color.B);
			return Text;
		}

		static FRgb Mix2(const FRgb& A, const FRgb& B, double T)
		{
			return FRgb{ A.R + (B.R - A.R) * T, A.G + (B.G - A.G) * T, A.B + (B.B - A.B) * T };
		}

		/** ramp: interpolación lineal por tramos; con NaN cae en el último color, como en JavaScript. */
		static FRgb Ramp(const FStop* Stops, int NumStops, double X)
		{
			if (X <= Stops[0].X) { return Hex(Stops[0].Color); }
			for (int Index = 1; Index < NumStops; ++Index)
			{
				if (X <= Stops[Index].X)
				{
					return Mix2(Hex(Stops[Index - 1].Color), Hex(Stops[Index].Color), (X - Stops[Index - 1].X) / (Stops[Index].X - Stops[Index - 1].X));
				}
			}
			return Hex(Stops[NumStops - 1].Color);
		}

		static void AddLayer(std::vector<FLayer>& Layers, std::string_view Color, double W)
		{
			if (W > 0.005) { Layers.push_back(FLayer{ Hex(Color), JsMin(0.96, W) }); }
		}

		// ------------------------------------------------------------ pH

		struct FAcidSystem
		{
			int Members[2]; int NumMembers; double Z0; double Ka[2]; int NumKa; double Total;
		};
	}

	FMixture EmptyMixture()
	{
		return FMixture();
	}

	std::string EquationText(const std::vector<FTerm>& Reactants, const std::vector<FTerm>& Products)
	{
		using namespace SandboxPrivate;
		return SideText(Reactants) + " \342\206\222 " + SideText(Products);
	}

	std::optional<double> ReactionEnthalpy(const std::vector<FTerm>& Reactants, const std::vector<FTerm>& Products)
	{
		using namespace SandboxPrivate;
		double Total = 0.0;
		for (int Side = 0; Side < 2; ++Side)
		{
			const std::vector<FTerm>& Terms = Side == 0 ? Products : Reactants;
			const double Sign = Side == 0 ? 1.0 : -1.0;
			for (const FTerm& Term : Terms)
			{
				const FSpecies& Info = SpeciesInfo(Term.Species);
				if (!Info.bHasDHf) { return std::nullopt; }
				Total += Sign * Term.Amount * Info.DHf;
			}
		}
		return Total;
	}

	TResult<FMixOutcome> AddReagent(const FMixture& Current, std::string_view ReagentId, double Amount)
	{
		using namespace SandboxPrivate;
		const int ReagentIndex = FindReagent(ReagentId);
		if (ReagentIndex < 0) { return TResult<FMixOutcome>::Fail(EError::UnknownReagent, "Reactivo desconocido."); }
		const FReagent& Reagent = GetReagents()[static_cast<size_t>(ReagentIndex)];
		if (!std::isfinite(Amount) || Amount < Reagent.Min - 1e-9 || Amount > Reagent.Max + 1e-9)
		{
			return TResult<FMixOutcome>::Fail(EError::Range,
				"Usa entre " + FormatEs(Reagent.Min) + " y " + FormatEs(Reagent.Max) + " " + Reagent.Unit + ".");
		}
		const double LiquidMl = Reagent.Kind == EReagentKind::Solid ? 0.0 : Reagent.Kind == EReagentKind::Indicator ? Amount * DropMl : Amount;
		if (Current.WaterMl + LiquidMl > VesselMl)
		{
			return TResult<FMixOutcome>::Fail(EError::Overflow,
				"El matraz se desbordar\303\255a: caben " + JsNumber(VesselMl) + " mL y ya contiene " + JsNumber(JsRound(Current.WaterMl)) + " mL.");
		}

		FMixOutcome Outcome;
		FMixture& Mix = Outcome.Mixture;
		Mix = Current;
		Mix.Additions.push_back(FAddition{ ReagentIndex, Amount });
		if (LiquidMl > 0.0)
		{
			Mix.TemperatureC = Mix.WaterMl + LiquidMl > 0.0 ? (Mix.TemperatureC * Mix.WaterMl + RoomC * LiquidMl) / (Mix.WaterMl + LiquidMl) : RoomC;
		}
		Mix.WaterMl += LiquidMl;
		if (Reagent.Kind == EReagentKind::Solution)
		{
			for (const FTerm& Component : Reagent.Components)
			{
				double& Stored = MolRef(Mix.N, Component.Species);
				Stored = Stored + Component.Amount * Reagent.Concentration * Amount / 1000.0;
			}
		}
		if (Reagent.Kind == EReagentKind::Solid)
		{
			double& Stored = MolRef(Mix.N, Reagent.Species);
			Stored = Stored + Amount / SpeciesInfo(Reagent.Species).MolarMass;
		}
		if (Reagent.Kind == EReagentKind::Indicator
			&& std::find(Mix.Indicators.begin(), Mix.Indicators.end(), Reagent.Indicator) == Mix.Indicators.end())
		{
			Mix.Indicators.emplace_back(Reagent.Indicator);
		}
		if (Current.WaterMl <= 0.0 && Reagent.Kind == EReagentKind::Solid) { Mix.TemperatureC = RoomC; }

		// Todos los avances cuentan para el calor; solo se informan los visibles (>= 1 µmol).
		double HeatKJ = 0.0;
		for (const FExtent& Extent : React(Mix))
		{
			FEvent Event = ToEvent(Extent.Rule, Extent.Xi);
			if (Event.Heat.has_value()) { HeatKJ += *Event.Heat; }
			else if (Event.Extent >= 1e-6) { Mix.bHeatUnknown = true; }
			if (Event.Extent >= 1e-6) { Outcome.Events.push_back(std::move(Event)); }
		}
		const double DeltaT = Mix.WaterMl > 0.0 ? HeatKJ * 1000.0 / (Mix.WaterMl * WaterHeatCapacity) : 0.0;
		Mix.TemperatureC = JsMin(100.0, Mix.TemperatureC + DeltaT);
		Outcome.DeltaT = DeltaT;
		Outcome.HeatKJ = HeatKJ;

		bool bFirst = true;   // todas las adiciones son del mismo reactivo
		for (const FAddition& Addition : Mix.Additions) { if (Addition.Reagent != ReagentIndex) { bFirst = false; break; } }

		if (Mix.WaterMl <= 0.0)
		{
			Outcome.Note = "Sin agua no ocurren reacciones en disoluci\303\263n. A\303\261ade un l\303\255quido.";
		}
		else if (!Outcome.Events.empty())
		{
			Outcome.Note = "";
		}
		else if (ReagentId == "starch")
		{
			Outcome.Note = "El almid\303\263n solo se vuelve azul oscuro si hay yodo (I\342\202\202) en la mezcla.";
		}
		else if (Reagent.Kind == EReagentKind::Indicator)
		{
			const std::optional<double> PH = SolvePH(Mix);
			Outcome.Note = std::string(Reagent.Name) + ": su color corresponde a pH \342\211\210 " + FormatEs(PH.has_value() ? *PH : 7.0, 1)
				+ ". Un indicador no cambia la cantidad de las sustancias.";
		}
		else if (bFirst)
		{
			Outcome.Note = std::string(Reagent.Name) + " en el matraz. A\303\261ade otro reactivo para ver si reaccionan.";
		}
		else if (Reagent.Kind == EReagentKind::Water)
		{
			Outcome.Note = "Diluci\303\263n: las concentraciones disminuyen, pero no hay reacci\303\263n nueva.";
		}
		else
		{
			Outcome.Note = "No se observan cambios seg\303\272n el modelo. Algunas combinaciones reales pueden reaccionar de formas no incluidas aqu\303\255.";
		}
		return TResult<FMixOutcome>::Ok(std::move(Outcome));
	}

	std::optional<double> SolvePH(const FMixture& Mixture)
	{
		using namespace SandboxPrivate;
		if (Mixture.WaterMl <= 0.0) { return std::nullopt; }
		const double V = Mixture.WaterMl / 1000.0;
		const FIds& Id = Ids();
		FAcidSystem Systems[7] = {
			{ { Id.HAc, Id.Ac }, 2, 0.0, { KaHAc, 0.0 }, 1, 0.0 },
			{ { Id.HCO3, Id.CO3 }, 2, 0.0, { KaH2CO3, KaHCO3 }, 2, 0.0 },
			{ { Id.NH4, Id.NH3 }, 2, 1.0, { KaNH4, 0.0 }, 1, 0.0 },
			{ { Id.SO4, -1 }, 1, -1.0, { KaHSO4, 0.0 }, 1, 0.0 },
			{ { Id.Fe3, -1 }, 1, 3.0, { KaFe3, 0.0 }, 1, 0.0 },
			{ { Id.Cu2, -1 }, 1, 2.0, { KaCu2, 0.0 }, 1, 0.0 },
			{ { Id.Zn2, -1 }, 1, 2.0, { KaZn2, 0.0 }, 1, 0.0 } };

		std::array<bool, NumSpecies> Excluded{};
		Excluded[static_cast<size_t>(Id.H)] = true;
		Excluded[static_cast<size_t>(Id.OH)] = true;
		for (FAcidSystem& System : Systems)
		{
			double Sum = 0.0;
			for (int Member = 0; Member < System.NumMembers; ++Member)
			{
				Sum = Sum + MolOf(Mixture.N, System.Members[Member]);
				Excluded[static_cast<size_t>(System.Members[Member])] = true;
			}
			System.Total = Sum / V;
		}

		// Iones espectadores: carga neta de todo lo que no entra en un sistema ácido–base.
		double Strong = 0.0;
		const std::vector<FSpecies>& Species = GetSpecies();
		for (size_t Index = 0; Index < Species.size() && Index < Mixture.N.size(); ++Index)
		{
			const FSpecies& Info = Species[Index];
			if (!Excluded[Index] && Info.Phase == EPhase::Aq && Info.Charge != 0)
			{
				Strong += static_cast<double>(Info.Charge) * Mixture.N[Index] / V;
			}
		}

		const auto Balance = [&Systems, Strong](double PH)
		{
			const double H = std::pow(10.0, -PH);
			double Total = H - Kw / H + Strong;
			for (const FAcidSystem& System : Systems)
			{
				if (System.Total == 0.0 || std::isnan(System.Total)) { continue; }
				double Beta = 1.0;
				double Sum = 1.0;
				double Charge = System.Z0;
				for (int J = 0; J < System.NumKa; ++J)
				{
					Beta *= System.Ka[J] / H;
					Sum += Beta;
					Charge += Beta * (System.Z0 - static_cast<double>(J) - 1.0);
				}
				Total += System.Total * Charge / Sum;
			}
			return Total;
		};

		double Lo = -2.0;
		double Hi = 16.0;
		for (int Step = 0; Step < 80; ++Step)
		{
			const double Mid = (Lo + Hi) / 2.0;
			if (Balance(Mid) > 0.0) { Lo = Mid; } else { Hi = Mid; }
		}
		return (Lo + Hi) / 2.0;
	}

	std::optional<FIndicatorColor> IndicatorColor(std::string_view Indicator, double PH)
	{
		using namespace SandboxPrivate;
		// Escalas visuales aproximadas; no son datos espectrofotométricos.
		if (Indicator == "universal")
		{
			static const FStop UniversalStops[] = {
				{ 0.0, "#c4161c" }, { 2.0, "#e8402a" }, { 3.0, "#f2702a" }, { 4.0, "#f7a21b" }, { 5.0, "#f9cf1a" }, { 6.0, "#c6d424" }, { 7.0, "#4cb349" },
				{ 8.0, "#1d9f8c" }, { 9.0, "#1f84bd" }, { 10.0, "#2a55a8" }, { 11.0, "#3e3c98" }, { 12.0, "#58308e" }, { 14.0, "#6a1f78" } };
			return FIndicatorColor{ ToHex(Ramp(UniversalStops, 13, PH)), 0.75 };
		}
		if (Indicator == "bromothymol")
		{
			static const FStop BromothymolStops[] = { { 6.0, "#e2c21c" }, { 6.8, "#8fb23a" }, { 7.6, "#2453b0" } };
			return FIndicatorColor{ ToHex(Ramp(BromothymolStops, 3, PH)), 0.7 };
		}
		if (Indicator == "phenolphthalein")
		{
			const double T = JsMax(0.0, JsMin(1.0, (PH - 8.2) / 1.8));
			if (T > 0.0) { return FIndicatorColor{ "#e0218a", 0.82 * T }; }
			return std::nullopt;
		}
		return std::nullopt;
	}

	FSolutionColor SolutionColor(const FMixture& Mixture, std::optional<double> PH)
	{
		using namespace SandboxPrivate;
		const double V = Mixture.WaterMl / 1000.0;
		if (V <= 0.0) { return FSolutionColor{ "#dbeef4", 0.0 }; }
		const FIds& Id = Ids();
		std::vector<FLayer> Layers;
		const auto C = [&Mixture, V](int Species) { return MolOf(Mixture.N, Species) / V; };
		const bool bStarch = std::find(Mixture.Indicators.begin(), Mixture.Indicators.end(), "starch") != Mixture.Indicators.end() && C(Id.I2) > 2e-6;
		AddLayer(Layers, "#2f8fe0", 1.0 - std::exp(-3.5 * C(Id.Cu2)));
		AddLayer(Layers, "#d98a0b", 1.0 - std::exp(-14.0 * C(Id.Fe3)));
		AddLayer(Layers, "#a8d890", 1.0 - std::exp(-2.5 * C(Id.Fe2)));
		AddLayer(Layers, "#7a1fa2", 1.0 - std::exp(-2200.0 * C(Id.MnO4)));
		AddLayer(Layers, "#f2d5e3", 1.0 - std::exp(-0.4 * C(Id.Mn2)));
		AddLayer(Layers, bStarch ? "#141653" : "#8a4a10", 1.0 - std::exp(-(bStarch ? 9000.0 : 500.0) * C(Id.I2)));
		if (PH.has_value())
		{
			for (const std::string& Indicator : Mixture.Indicators)
			{
				const std::optional<FIndicatorColor> Ind = IndicatorColor(Indicator, *PH);
				if (Ind.has_value()) { AddLayer(Layers, Ind->Color, Ind->Strength); }
			}
		}
		if (Layers.empty()) { return FSolutionColor{ "#cfe6ee", 0.3 }; }
		double Total = 0.0;
		for (const FLayer& Layer : Layers) { Total = Total + Layer.W; }
		FRgb Rgb{ 0.0, 0.0, 0.0 };
		for (const FLayer& Layer : Layers)
		{
			Rgb = FRgb{ Rgb.R + Layer.Rgb.R * Layer.W / Total, Rgb.G + Layer.Rgb.G * Layer.W / Total, Rgb.B + Layer.Rgb.B * Layer.W / Total };
		}
		double Clear = 1.0;
		for (const FLayer& Layer : Layers) { Clear = Clear * (1.0 - Layer.W); }
		const double Opacity = 1.0 - Clear;
		return FSolutionColor{ ToHex(Rgb), 0.2 + 0.72 * Opacity };
	}

	FAnalysis AnalyzeMixture(const FMixture& Mixture)
	{
		using namespace SandboxPrivate;
		FAnalysis Analysis;
		Analysis.PH = SolvePH(Mixture);
		const double V = Mixture.WaterMl / 1000.0;
		const FIds& Id = Ids();
		const std::vector<FSpecies>& Species = GetSpecies();
		const int Count = static_cast<int>((std::min)(Species.size(), Mixture.N.size()));

		for (int Index = 0; Index < Count; ++Index)
		{
			const double Mol = MolOf(Mixture.N, Index);
			if (SpeciesInfo(Index).Phase == EPhase::S && Mol > 1e-7)
			{
				Analysis.Solids.push_back(FSolidInfo{ Index, Mol, Mol * SpeciesInfo(Index).MolarMass });
			}
		}
		std::stable_sort(Analysis.Solids.begin(), Analysis.Solids.end(),
			[](const FSolidInfo& A, const FSolidInfo& B) { return B.Grams - A.Grams < 0.0; });

		if (V > 0.0)
		{
			for (int Index = 0; Index < Count; ++Index)
			{
				const double Mol = MolOf(Mixture.N, Index);
				if (SpeciesInfo(Index).Phase == EPhase::Aq && Index != Id.H && Index != Id.OH && Mol / V > 1e-5)
				{
					Analysis.Dissolved.push_back(FDissolvedInfo{ Index, Mol / V });
				}
			}
			std::stable_sort(Analysis.Dissolved.begin(), Analysis.Dissolved.end(),
				[](const FDissolvedInfo& A, const FDissolvedInfo& B) { return B.Molarity - A.Molarity < 0.0; });
		}

		for (int Gas = 0; Gas < 3; ++Gas)
		{
			const double Mol = Mixture.Released[static_cast<size_t>(Gas)];
			if (Mol > 1e-7) { Analysis.Gases.push_back(FGasInfo{ static_cast<EGas>(Gas), Mol, Mol * GasLPerMol }); }
		}

		Analysis.Color = SolutionColor(Mixture, Analysis.PH);
		Analysis.VolumeMl = Mixture.WaterMl;
		Analysis.TemperatureC = Mixture.TemperatureC;
		Analysis.bAmmoniaSmell = V > 0.0 && MolOf(Mixture.N, Id.NH3) / V > 0.01;
		return Analysis;
	}

	double GasLitres(double Mol)
	{
		using namespace SandboxPrivate;
		return Mol * GasLPerMol;
	}
}

#if defined(_MSC_VER)
#pragma float_control(pop)
#endif
