#include "ExperimentaChem/Hood.h"

#include <algorithm>
#include <cmath>
#include <utility>

#include "MiniJson.h"

// IEEE estricto aunque el módulo se compile sin FPSemanticsMode.Precise (ver Sandbox.cpp), y sin FMA:
// «ml + caudal · segundos» tiene que dar los mismos bits que en JavaScript.
#if defined(_MSC_VER)
#pragma float_control(precise, on, push)
#pragma fp_contract(off)
#endif

// Porte de src/state/hood.ts, de las ramas de la campana de src/state/lab.ts y de src/experiments/hoodRecipes.ts.
// Cada función conserva el orden de las comprobaciones y de las operaciones del TypeScript; los comentarios
// remiten a la regla congelada de golden/README.md cuando el comportamiento sorprende.
namespace ExperimentaChem
{
	namespace HoodDetail
	{
		const FReagent& R(int Reagent) { return GetReagents()[static_cast<size_t>(Reagent)]; }
		std::string NameOf(int Reagent) { return R(Reagent).Name; }
		std::string Js(double Value) { return MiniJson::NumberToString(Value); }
		bool StartsWith(std::string_view Text, std::string_view Prefix) { return Text.size() >= Prefix.size() && Text.compare(0, Prefix.size(), Prefix) == 0; }
		const char* HandText(EHand Hand) { return Hand == EHand::Left ? "izquierda" : "derecha"; }
		bool InHand(EPlace Place) { return Place == EPlace::Left || Place == EPlace::Right; }
		EPlace PlaceOf(EHand Hand) { return Hand == EHand::Left ? EPlace::Left : EPlace::Right; }
		EPipettePlace PipettePlaceOf(EHand Hand) { return Hand == EHand::Left ? EPipettePlace::Left : EPipettePlace::Right; }
		/** Math.max de JavaScript para dos números (NaN si alguno lo es). */
		double JsMax(double A, double B) { if (std::isnan(A) || std::isnan(B)) { return A + B; } return A > B ? A : B; }

		/** mergeEvents: funde por regla y sentido sumando avance, calor y moles; un calor desconocido sigue desconocido. */
		std::vector<FEvent> MergeEvents(const std::vector<FEvent>& A, const std::vector<FEvent>& B)
		{
			std::vector<FEvent> Out = A;
			for (const FEvent& E : B)
			{
				auto Same = std::find_if(Out.begin(), Out.end(), [&E](const FEvent& X) { return X.Rule == E.Rule && X.Kind == E.Kind; });
				if (Same == Out.end()) { Out.push_back(E); continue; }
				Same->Extent += E.Extent;
				if (!Same->Heat.has_value() || !E.Heat.has_value()) { Same->Heat.reset(); }
				else { Same->Heat = *Same->Heat + *E.Heat; }
				if (Same->Gas.has_value() && E.Gas.has_value()) { Same->Gas->Mol = Same->Gas->Mol + E.Gas->Mol; }
				if (Same->Solid.has_value() && E.Solid.has_value()) { Same->Solid->Mol = Same->Solid->Mol + E.Solid->Mol; }
			}
			return Out;
		}

		const char* const ShelfIds[NumReagents] = {
			"phenolphthalein", "universal", "bromothymol", "starch", "h2o2", "kmno4", "ki", "water", "hcl", "h2so4",
			"acetic", "naoh", "na2co3", "nahco3", "nacl", "agno3", "cuso4", "fecl3", "pbno3", "bacl2",
			"cacl2", "nh4no3", "caco3", "zn", "mg", "cu", "fe" };

		int Rg(const char* Id) { return FindReagent(Id); }
		FRecipeAdd P(const char* Id, double Amount) { return { Rg(Id), Amount, ETool::Probeta }; }
		FRecipeAdd B(const char* Id, double Amount) { return { Rg(Id), Amount, ETool::Balanza }; }
		FRecipeAdd G(const char* Id, double Amount) { return { Rg(Id), Amount, ETool::Gotero }; }

		std::vector<FHoodRecipe> MakeRecipes()
		{
			return {
				{ "neutralizacion", "Neutralizaci\303\263n con indicador", "HCl + NaOH \342\206\222 NaCl + H\342\202\202O", "B\303\241sico",
					"Ver c\303\263mo el indicador universal pasa de rojo a verde al neutralizar un \303\241cido fuerte.", "Rojo con el \303\241cido; verde cerca de pH 7 y la mezcla se calienta.",
					"Disoluci\303\263n salina neutra: residuos acuosos.", "HCl y NaOH son corrosivos.", { P("hcl", 20), G("universal", 3), P("naoh", 20) }, { "neutral-strong" } },
				{ "volcan", "Vinagre y bicarbonato", "NaHCO\342\202\203 + CH\342\202\203COOH \342\206\222 CH\342\202\203COONa + H\342\202\202O + CO\342\202\202", "B\303\241sico",
					"Producir CO\342\202\202 y notar que la mezcla se enfr\303\255a.", "Efervescencia intensa y descenso de temperatura.",
					"Acetato de sodio en agua: residuos acuosos.", "No tapes el recipiente mientras libera gas.", { P("acetic", 50), B("nahco3", 2) }, { "bicarbonate-solid-acetic" } },
				{ "lluvia-oro", "Lluvia de oro", "Pb(NO\342\202\203)\342\202\202 + 2 KI \342\206\222 PbI\342\202\202 \342\206\223 + 2 KNO\342\202\203", "Intermedio",
					"Formar cristales amarillos de yoduro de plomo(II).", "Precipitado amarillo intenso.",
					"Contiene plomo: residuos de metales pesados, nunca al fregadero.", "El nitrato de plomo es t\303\263xico.", { P("pbno3", 20), P("ki", 10) }, { "ksp-PbI2" } },
				{ "cloruro-plata", "Prueba de cloruros", "AgNO\342\202\203 + NaCl \342\206\222 AgCl \342\206\223 + NaNO\342\202\203", "B\303\241sico",
					"Detectar iones cloruro con nitrato de plata.", "Precipitado blanco lechoso de AgCl.",
					"Contiene plata: residuos de metales.", "El nitrato de plata mancha la piel.", { P("agno3", 20), P("nacl", 5) }, { "ksp-AgCl" } },
				{ "cobre-azul", "Hidr\303\263xido de cobre azul", "CuSO\342\202\204 + 2 NaOH \342\206\222 Cu(OH)\342\202\202 \342\206\223 + Na\342\202\202SO\342\202\204", "B\303\241sico",
					"Precipitar Cu(OH)\342\202\202 y redisolverlo con \303\241cido.", "S\303\263lido azul celeste que desaparece al a\303\261adir HCl.",
					"Contiene cobre: residuos de metales.", "NaOH y HCl son corrosivos.", { P("cuso4", 10), P("naoh", 10), P("hcl", 20) }, { "ksp-Cu(OH)2", "acid-Cu(OH)2-H+" } },
				{ "hierro-rojo", "Hidr\303\263xido de hierro(III)", "FeCl\342\202\203 + 3 NaOH \342\206\222 Fe(OH)\342\202\203 \342\206\223 + 3 NaCl", "B\303\241sico",
					"Formar un precipitado pardo rojizo.", "S\303\263lido marr\303\263n rojizo y gelatinoso.",
					"Contiene hierro: residuos de metales.", "El FeCl\342\202\203 es corrosivo.", { P("fecl3", 20), P("naoh", 10) }, { "ksp-Fe(OH)3" } },
				{ "elefante", "Descomposici\303\263n del per\303\263xido", "2 H\342\202\202O\342\202\202 \342\206\222 2 H\342\202\202O + O\342\202\202  (catalizador: I\342\201\273)", "Intermedio",
					"Acelerar la descomposici\303\263n del agua oxigenada con yoduro.", "Espuma de ox\303\255geno y la mezcla se calienta mucho.",
					"Agua con yoduro: residuos acuosos.", "Libera gas y calor: no te acerques a la boca del matraz.", { P("h2o2", 100), P("ki", 10) }, { "peroxide-decomposition" } },
				{ "magnesio", "Magnesio en \303\241cido", "Mg + 2 HCl \342\206\222 MgCl\342\202\202 + H\342\202\202", "Intermedio",
					"Ver un metal activo desplazar hidr\303\263geno.", "Burbujas de H\342\202\202 y gran aumento de temperatura.",
					"Disoluci\303\263n \303\241cida: neutraliza antes de desechar.", "El hidr\303\263geno es inflamable: extractor encendido y sin llamas.", { P("hcl", 50), B("mg", 0.3) }, { "metal-Mg-H+" } },
				{ "cobre-cinc", "El cinc desplaza al cobre", "Zn + CuSO\342\202\204 \342\206\222 ZnSO\342\202\204 + Cu", "B\303\241sico",
					"Depositar cobre met\303\241lico sobre el cinc.", "El azul se aclara y aparece cobre rojizo.",
					"Contiene cobre y cinc: residuos de metales.", "Lava tus guantes si tocas el sulfato de cobre.", { P("cuso4", 40), B("zn", 2) }, { "metal-Zn-Cu2+" } },
				{ "arbol-plata", "\303\201rbol de plata", "Cu + 2 AgNO\342\202\203 \342\206\222 Cu(NO\342\202\203)\342\202\202 + 2 Ag", "Intermedio",
					"Formar cristales de plata sobre cobre.", "Plata gris sobre el alambre y la disoluci\303\263n se vuelve azul.",
					"Contiene plata y cobre: residuos de metales.", "El nitrato de plata mancha la piel.", { P("agno3", 30), B("cu", 1) }, { "metal-Cu-Ag+" } },
				{ "sulfato-bario", "Prueba de sulfatos", "BaCl\342\202\202 + H\342\202\202SO\342\202\204 \342\206\222 BaSO\342\202\204 \342\206\223 + 2 HCl", "B\303\241sico",
					"Detectar sulfatos con cloruro de bario.", "Precipitado blanco muy fino.",
					"Contiene bario: residuos de metales.", "El cloruro de bario es t\303\263xico.", { P("bacl2", 20), P("h2so4", 10) }, { "ksp-BaSO4" } },
				{ "permanganato", "El permanganato pierde el color", "2 MnO\342\202\204\342\201\273 + 5 H\342\202\202O\342\202\202 + 6 H\342\201\272 \342\206\222 2 Mn\302\262\342\201\272 + 5 O\342\202\202 + 8 H\342\202\202O", "Intermedio",
					"Ver una reacci\303\263n redox que decolora la disoluci\303\263n.", "El violeta desaparece y salen burbujas.",
					"Disoluci\303\263n \303\241cida con manganeso: residuos de metales.", "Permanganato y \303\241cido sulf\303\272rico son oxidante y corrosivo.", { P("kmno4", 10), P("h2so4", 10), P("h2o2", 10) }, { "permanganate-peroxide" } },
				{ "yodo-almidon", "Yodo y almid\303\263n", "2 Fe\302\263\342\201\272 + 2 I\342\201\273 \342\206\222 2 Fe\302\262\342\201\272 + I\342\202\202", "Intermedio",
					"Formar yodo y detectarlo con almid\303\263n.", "Color pardo y luego azul muy oscuro con el almid\303\263n.",
					"Contiene hierro y yodo: residuos acuosos.", "El FeCl\342\202\203 es corrosivo.", { P("fecl3", 20), P("ki", 10), G("starch", 3) }, { "iron-iodide" } },
				{ "frio", "Disoluci\303\263n que enfr\303\255a", "NH\342\202\204NO\342\202\203(s) \342\206\222 NH\342\202\204\342\201\272 + NO\342\202\203\342\201\273   \316\224H > 0", "B\303\241sico",
					"Medir el descenso de temperatura de una disoluci\303\263n endot\303\251rmica.", "La temperatura baja varios grados.",
					"Disoluci\303\263n de nitrato: residuos acuosos.", "El nitrato de amonio es comburente.", { P("water", 50), B("nh4no3", 5) }, { "ksp-NH4NO3(s)" } },
				{ "calor", "Disoluci\303\263n que calienta", "CaCl\342\202\202(s) \342\206\222 Ca\302\262\342\201\272 + 2 Cl\342\201\273   \316\224H < 0", "B\303\241sico",
					"Medir el aumento de temperatura de una disoluci\303\263n exot\303\251rmica.", "La temperatura sube varios grados.",
					"Disoluci\303\263n salina: residuos acuosos.", "El CaCl\342\202\202 irrita los ojos.", { P("water", 50), B("cacl2", 5) }, { "ksp-CaCl2(s)" } },
				{ "fenolftaleina", "Rosa que desaparece", "CH\342\202\203COOH + NaOH \342\206\222 CH\342\202\203COONa + H\342\202\202O", "B\303\241sico",
					"Ver la fenolftale\303\255na rosa en base y su p\303\251rdida de color al a\303\261adir \303\241cido.", "Rosa intenso que se vuelve incoloro.",
					"Acetato en agua: residuos acuosos.", "El NaOH es corrosivo.", { P("naoh", 10), P("water", 40), G("phenolphthalein", 3), P("acetic", 30) }, { "neutral-acetic" } },
			};
		}

		const char* const ClosedSash = "La ventana est\303\241 cerrada. S\303\272bela a la altura de trabajo para trabajar dentro.";
		const char* const ClosedSashShort = "La ventana est\303\241 cerrada. S\303\272bela para trabajar dentro.";
		const char* const CylinderFull = "La probeta est\303\241 llena (100 mL).";
		const char* const PipetteFull = "La pipeta est\303\241 llena (10 mL).";
		const char* const SolidsOnBalance = "Los s\303\263lidos se pesan en la balanza.";
		const char* const IndicatorsByDrops = "Los indicadores se a\303\261aden gota a gota directamente al matraz.";
	}

	using namespace HoodDetail;

	// ---------------------------------------------------------------- Constantes y tablas

	FStreamRate StreamRate(EReagentKind Kind)
	{
		switch (Kind)
		{
		case EReagentKind::Solution: return { 15.0, 2.5 };
		case EReagentKind::Water: return { 15.0, 2.5 };
		case EReagentKind::Solid: return { 1.0, 0.1 };
		case EReagentKind::Indicator: return { 2.0, 1.0 };
		}
		return { 0.0, 1.0 };
	}

	double SpatulaRate(double HeldSeconds) { return (std::min)(1.0, 0.25 + HeldSeconds * 0.3); }

	const std::array<int, NumReagents>& GetShelfOrder()
	{
		static const std::array<int, NumReagents> Order = []
		{
			std::array<int, NumReagents> Out{};
			for (int Index = 0; Index < NumReagents; ++Index) { Out[static_cast<size_t>(Index)] = FindReagent(ShelfIds[Index]); }
			return Out;
		}();
		return Order;
	}

	const std::vector<FHoodRecipe>& GetHoodRecipes()
	{
		static const std::vector<FHoodRecipe> Recipes = MakeRecipes();
		return Recipes;
	}

	int FindHoodRecipe(std::string_view Id)
	{
		const std::vector<FHoodRecipe>& Recipes = GetHoodRecipes();
		for (size_t Index = 0; Index < Recipes.size(); ++Index)
		{
			if (Id == Recipes[Index].Id) { return static_cast<int>(Index); }
		}
		return -1;
	}

	std::string AmountText(int Reagent, double Amount)
	{
		const std::string N = FormatEs(Amount, 2);
		const EReagentKind Kind = R(Reagent).Kind;
		return Kind == EReagentKind::Solid ? N + " g" : Kind == EReagentKind::Indicator ? N + " gotas" : N + " mL";
	}

	// ---------------------------------------------------------------- useHood

	FHood::FHood()
	{
		Places.fill(EPlace::Shelf);
		Mixture = EmptyMixture();
	}

	void FHood::Advance(double Ms)
	{
		const double End = Now + Ms;
		while (Timer.What != ETimer::None && Timer.Due <= End)
		{
			const FTimer Fired = Timer;
			Timer = FTimer();
			Now = (std::max)(Now, Fired.Due);
			RunTimer(Fired);
		}
		Now = End;
	}

	int FHood::HeldIn(EHand Hand) const
	{
		const EPlace Wanted = PlaceOf(Hand);
		for (int Reagent : GetShelfOrder())
		{
			if (Places[static_cast<size_t>(Reagent)] == Wanted) { return Reagent; }
		}
		return -1;
	}

	std::string FHood::Pick(int Reagent, EHand Hand)
	{
		if (Pouring.has_value() && Pouring->Reagent == Reagent) { return "Espera a que termine el vertido."; }
		if (InHand(Places[static_cast<size_t>(Reagent)])) { return NameOf(Reagent) + " ya est\303\241 en tu mano."; }
		// No comprueba si la mano ya lleva otro frasco: lo impide lab.interact (regla 18).
		Places[static_cast<size_t>(Reagent)] = PlaceOf(Hand);
		return NameOf(Reagent) + " en la mano " + HandText(Hand) + ". Ll\303\251valo a la campana.";
	}

	std::string FHood::Put(EHand Hand, EPlace Where)
	{
		const int Reagent = HeldIn(Hand);
		if (Reagent < 0) { return "La mano seleccionada no sostiene un frasco."; }
		if (Where == EPlace::Hood && std::count(Places.begin(), Places.end(), EPlace::Hood) >= HoodTraySlots)
		{
			return "La bandeja de la campana admite " + Js(HoodTraySlots) + " frascos. Devuelve alguno a la estanter\303\255a.";
		}
		Places[static_cast<size_t>(Reagent)] = Where;
		return Where == EPlace::Shelf ? NameOf(Reagent) + " devuelto a la estanter\303\255a, tapado." : NameOf(Reagent) + " colocado en la bandeja de la campana.";
	}

	bool FHood::Apply(int Reagent, double Amount, bool bMerge)
	{
		const std::string Before = AnalyzeMixture(Mixture).Color.Color;
		TResult<FMixOutcome> Out = AddReagent(Mixture, R(Reagent).Id, Amount);
		if (!Out.bOk) { Error = Out.Message; Pouring.reset(); return false; }
		const FAnalysis After = AnalyzeMixture(Out.Value.Mixture);
		FMixture NewMixture = std::move(Out.Value.Mixture);
		const std::vector<FEvent>& Events = Out.Value.Events;

		if (bMerge && Stream.AdditionIndex >= 0 && Stream.AdditionIndex == static_cast<int>(NewMixture.Additions.size()) - 2)
		{
			const FAddition Previous = NewMixture.Additions[static_cast<size_t>(Stream.AdditionIndex)];
			NewMixture.Additions.resize(NewMixture.Additions.size() - 2);
			NewMixture.Additions.push_back({ Reagent, JsRound((Previous.Amount + Amount) * 1000.0) / 1000.0 });
		}
		if (bMerge) { Stream.AdditionIndex = static_cast<int>(NewMixture.Additions.size()) - 1; }

		double GasMol = 0.0;
		for (const FEvent& E : Events) { GasMol = GasMol + (E.Gas.has_value() ? E.Gas->Mol : 0.0); }
		const FEvent* Formed = nullptr;
		for (const FEvent& E : Events)
		{
			if (E.Kind == "precipitado" || (E.Solid.has_value() && E.Kind != "disoluci\303\263n")) { Formed = &E; break; }
		}
		double Vigor = 0.0;
		for (const FEvent& E : Events) { Vigor = JsMax(Vigor, E.Gas.has_value() ? E.Vigor : 0.0); }

		// El registro: una gota del mismo clic se funde con la entrada anterior (regla 9); si no, entrada nueva con tope de 40.
		if (bMerge && !Log.empty() && Log.back().Id == Stream.EntryId)
		{
			FHoodLogEntry& Last = Log.back();
			const bool bLastHadEvents = !Last.Events.empty();
			Last.Amount = Last.Amount + Amount;
			Last.Events = MergeEvents(Last.Events, Events);
			Last.DeltaT = Last.DeltaT + Out.Value.DeltaT;
			Last.Note = !Events.empty() ? std::string() : bLastHadEvents ? std::string() : Out.Value.Note;
		}
		else
		{
			FHoodLogEntry Entry;
			Entry.Id = EntryCount++;
			Entry.At = Now; Entry.Reagent = Reagent; Entry.Amount = Amount;
			Entry.Events = Events; Entry.DeltaT = Out.Value.DeltaT; Entry.Note = Out.Value.Note;
			if (bMerge) { Stream.EntryId = Entry.Id; }
			Log.push_back(std::move(Entry));
			if (Log.size() > static_cast<size_t>(HoodLogMax)) { Log.erase(Log.begin(), Log.begin() + static_cast<std::ptrdiff_t>(Log.size() - HoodLogMax)); }
		}

		if (Recipe.has_value())
		{
			const int Def = Recipe->Recipe;
			bool bObserved = Recipe->bObserved;
			if (!bObserved && Def >= 0)
			{
				// def.expect.every(rule => log.some(l => l.events.some(e => e.rule === rule))): mira el registro entero (regla 23).
				bObserved = true;
				for (const char* Rule : GetHoodRecipes()[static_cast<size_t>(Def)].Expect)
				{
					bool bSeen = false;
					for (const FHoodLogEntry& Entry : Log)
					{
						for (const FEvent& E : Entry.Events) { if (GetRules()[static_cast<size_t>(E.Rule)].Id == std::string_view(Rule)) { bSeen = true; break; } }
						if (bSeen) { break; }
					}
					if (!bSeen) { bObserved = false; break; }
				}
			}
			std::optional<double>& Added = Recipe->Added[static_cast<size_t>(Reagent)];
			Added = (Added.has_value() ? *Added : 0.0) + Amount;
			Recipe->bObserved = bObserved;
		}

		const std::optional<FHoodBurst> Current = Burst;
		const bool bKeep = Current.has_value() && Now - Current->At < 1500.0 && !(GasMol != 0.0 && !std::isnan(GasMol)) && Formed == nullptr;
		Mixture = std::move(NewMixture);
		SavedAt.reset();
		if (Pouring.has_value() && Pouring->bStream) { Pouring->Amount = Pouring->Amount + Amount; }
		if (!bKeep)
		{
			FHoodBurst Next;
			Next.At = Now;
			Next.GasMol = JsMax(GasMol, Current.has_value() && bMerge && Now - Current->At < 2000.0 ? Current->GasMol * 0.8 : 0.0);
			Next.Vigor = JsMax(Vigor, bMerge && Current.has_value() ? Current->Vigor * 0.9 : 0.0);
			if (Formed != nullptr && Formed->Solid.has_value())
			{
				const char* Color = GetSpecies()[static_cast<size_t>(Formed->Solid->Species)].Color;
				Next.SolidColor = std::string(Color != nullptr ? Color : "#f2f2ee");
			}
			Next.DeltaT = Out.Value.DeltaT;
			Next.bColorChange = Before != After.Color.Color;
			Burst = Next;
		}
		return true;
	}

	void FHood::TransferThen(ETransfer Kind, int Reagent)
	{
		Timer = FTimer();
		Transfer = FTransferState{ Kind, Reagent, Now };
		Error.clear();
		Timer.What = ETimer::Transfer;
		Timer.Kind = Kind;
		Timer.Reagent = Reagent;
		Timer.Due = Now + (Kind == ETransfer::Rinse ? RinseMs : PourMs);
	}

	void FHood::RunTimer(const FTimer& Fired)
	{
		if (Fired.What == ETimer::Pour)
		{
			if (Pouring.has_value() && Pouring->Reagent == Fired.Reagent && !Pouring->bStream)
			{
				Apply(Fired.Reagent, Fired.Amount, false);
				Pouring.reset();
			}
			return;
		}
		if (Fired.What != ETimer::Transfer || !Transfer.has_value() || Transfer->Kind != Fired.Kind) { return; }
		switch (Fired.Kind)
		{
		case ETransfer::Cylinder:
			if (Apply(Fired.Reagent, Fired.Amount, false)) { Cylinder = FCylinder{ -1, 0.0, Fired.Reagent }; }
			break;
		case ETransfer::Pipette:
			if (Apply(Fired.Reagent, Fired.Amount, false)) { Pipette.Reagent = -1; Pipette.Ml = 0.0; Pipette.Dirty = Fired.Reagent; }
			break;
		case ETransfer::Balance:
			if (Apply(Fired.Reagent, Fired.Amount, false)) { Balance = FBalance(); }
			break;
		case ETransfer::Rinse:
			Cylinder = FCylinder();
			if (Fired.bPipetteDirty) { Pipette.Reagent = -1; Pipette.Ml = 0.0; Pipette.Dirty = -1; }
			break;
		case ETransfer::Waste:
			if (Recipe.has_value())
			{
				// Con el paso «clean» pendiente el desecho borra lo añadido y lo observado y no cuenta como desecho (reglas 24 y 25).
				if (Recipe->bCleanNeeded) { Recipe->bCleanNeeded = false; Recipe->Added = {}; Recipe->bObserved = false; }
				else { Recipe->bDisposed = Recipe->bObserved || Recipe->bDisposed; }
			}
			Mixture = EmptyMixture(); Log.clear(); Burst.reset(); SavedAt.reset(); Disposals += 1;
			break;
		case ETransfer::Bottle:
			break;
		}
		Transfer.reset();
	}

	bool FHood::Pour(int Reagent, double Amount)
	{
		if (Busy()) { return false; }
		if (Places[static_cast<size_t>(Reagent)] == EPlace::Shelf) { Error = "Ese frasco est\303\241 en la estanter\303\255a: tr\303\241elo a la campana."; return false; }
		if (Sash == ESash::Closed) { Error = ClosedSash; return false; }
		const TResult<FMixOutcome> Check = AddReagent(Mixture, R(Reagent).Id, Amount);
		if (!Check.bOk) { Error = Check.Message; return false; }
		Pouring = FPouring{ Reagent, Amount, Now, false, std::nullopt };
		Error.clear();
		Timer = FTimer();
		Timer.What = ETimer::Pour; Timer.Due = Now + PourMs; Timer.Reagent = Reagent; Timer.Amount = Amount;
		return true;
	}

	bool FHood::StartStream(int Reagent, EStreamTarget Target)
	{
		const FReagent& Re = R(Reagent);
		if (Busy() || Places[static_cast<size_t>(Reagent)] == EPlace::Shelf) { return false; }
		if (Sash == ESash::Closed) { Error = ClosedSash; return false; }
		if (Target == EStreamTarget::Flask && Re.Kind != EReagentKind::Indicator)
		{
			Error = Re.Kind == EReagentKind::Solid
				? "Pesa primero " + std::string(Re.Name) + " en la balanza y luego a\303\261\303\241delo al matraz."
				: "Mide primero " + std::string(Re.Name) + " en la probeta graduada y luego vi\303\251rtela en el matraz.";
			return false;
		}
		if (Target == EStreamTarget::Cylinder)
		{
			if (Re.Kind == EReagentKind::Solid || Re.Kind == EReagentKind::Indicator) { Error = Re.Kind == EReagentKind::Solid ? SolidsOnBalance : IndicatorsByDrops; return false; }
			if (Cylinder.Ml > 0.05 && Cylinder.Reagent != Reagent) { Error = "La probeta contiene " + NameOf(Cylinder.Reagent) + ": vi\303\251rtela en el matraz o enju\303\241gala antes."; return false; }
			if (Cylinder.Ml <= 0.05 && Cylinder.Dirty >= 0 && Cylinder.Dirty != Reagent) { Error = "La probeta tiene restos de " + NameOf(Cylinder.Dirty) + ". Enju\303\241gala con la piseta antes de medir otro reactivo."; return false; }
			if (Cylinder.Ml >= CylinderMl - 0.05) { Error = CylinderFull; return false; }
		}
		if (Target == EStreamTarget::Pipette)
		{
			if (Pipette.Place != EPipettePlace::Hood) { Error = "La pipeta no est\303\241 en su soporte. Tr\303\241ela del gabinete de pipetas."; return false; }
			if (Re.Kind == EReagentKind::Solid || Re.Kind == EReagentKind::Indicator) { Error = Re.Kind == EReagentKind::Solid ? SolidsOnBalance : IndicatorsByDrops; return false; }
			if (Pipette.Ml > 0.05 && Pipette.Reagent != Reagent) { Error = "La pipeta contiene " + NameOf(Pipette.Reagent) + ": desc\303\241rgala en el matraz o enju\303\241gala antes."; return false; }
			if (Pipette.Ml <= 0.05 && Pipette.Dirty >= 0 && Pipette.Dirty != Reagent) { Error = "La pipeta tiene restos de " + NameOf(Pipette.Dirty) + ". Enju\303\241gala con la piseta antes de usar otro reactivo."; return false; }
			if (Pipette.Ml >= PipetteMl - 0.005) { Error = PipetteFull; return false; }
		}
		if (Target == EStreamTarget::Balance)
		{
			if (Re.Kind != EReagentKind::Solid) { Error = "En la balanza solo se pesan s\303\263lidos."; return false; }
			if (Balance.Grams > 0.001 && Balance.Reagent != Reagent) { Error = "La balanza tiene " + NameOf(Balance.Reagent) + ": a\303\261\303\241delo al matraz antes de pesar otro s\303\263lido."; return false; }
		}
		ResetStream();
		Pouring = FPouring{ Reagent, 0.0, Now, true, Target };
		Error.clear();
		return true;
	}

	void FHood::StreamTick(double Seconds)
	{
		if (!Pouring.has_value() || !Pouring->bStream) { return; }
		const FPouring P = *Pouring;
		const FReagent& Re = R(P.Reagent);
		// Los primeros 0,3 s (del reloj, no de Seconds) inclinan el frasco o cargan la espátula.
		const double Held = (Now - P.StartedAt) / 1000.0;
		if (Held < TiltSeconds) { return; }
		const EStreamTarget Target = P.Target.value_or(EStreamTarget::Flask);
		if (Target == EStreamTarget::Cylinder)
		{
			const double Ml = (std::min)(CylinderMl, Cylinder.Ml + CylinderRate * Seconds);
			Cylinder = FCylinder{ P.Reagent, Ml, P.Reagent };
			Pouring->Amount = Ml;
			if (Ml >= CylinderMl) { Pouring.reset(); Error = CylinderFull; }
			return;
		}
		if (Target == EStreamTarget::Pipette)
		{
			const double Ml = (std::min)(PipetteMl, Pipette.Ml + PipetteRate * Seconds);
			Pipette.Reagent = P.Reagent; Pipette.Ml = Ml; Pipette.Dirty = P.Reagent;
			Pouring->Amount = Ml;
			if (Ml >= PipetteMl) { Pouring.reset(); Error = PipetteFull; }
			return;
		}
		if (Target == EStreamTarget::Balance)
		{
			const double Max = Re.Kind == EReagentKind::Solid ? Re.Max : 10.0;
			const double Grams = (std::min)(Max, Balance.Grams + SpatulaRate(Held) * Seconds);
			Balance = FBalance{ P.Reagent, Grams };
			Pouring->Amount = Grams;
			if (Grams >= Max) { Pouring.reset(); Error = "M\303\241ximo para este experimento: " + Js(Max) + " g."; }
			return;
		}
		const FStreamRate Rate = StreamRate(Re.Kind);
		Stream.Pending += Rate.Rate * Seconds;
		while (Stream.Pending >= Rate.Step && Pouring.has_value() && Pouring->bStream)
		{
			Stream.Pending -= Rate.Step;
			if (!Apply(P.Reagent, Rate.Step, true)) { Pouring.reset(); return; }
		}
	}

	void FHood::StopStream()
	{
		if (Pouring.has_value() && Pouring->bStream) { Pouring.reset(); }
		ResetStream();
	}

	bool FHood::PourCylinder()
	{
		const int Reagent = Cylinder.Reagent; const double Ml = Cylinder.Ml;
		if (Busy()) { return false; }
		if (Reagent < 0 || Ml < 1.0) { Error = "La probeta est\303\241 vac\303\255a. Ll\303\251nala vertiendo un frasco sobre ella (mant\303\251n el clic)."; return false; }
		if (Sash == ESash::Closed) { Error = ClosedSashShort; return false; }
		// El desborde se comprueba con la lectura sin redondear y se vierte la redondeada (regla 4).
		if (Mixture.WaterMl + Ml > VesselMl) { Error = "El matraz se desbordar\303\255a: caben " + Js(VesselMl) + " mL."; return false; }
		const double Amount = JsRound(Ml * 10.0) / 10.0;
		TransferThen(ETransfer::Cylinder, Reagent);
		Timer.Amount = Amount;
		return true;
	}

	std::string FHood::TakePipette(EHand Hand)
	{
		if (Busy()) { return "Espera a que termine el vertido."; }
		if (Pipette.Place == EPipettePlace::Left || Pipette.Place == EPipettePlace::Right) { return "La pipeta ya est\303\241 en tu mano."; }
		Pipette.Place = PipettePlaceOf(Hand);
		return std::string("Pipeta de 10 mL en la mano ") + HandText(Hand) + ". Ll\303\251vala a su soporte en la campana.";
	}

	std::string FHood::PutPipette(EHand Hand, EPipettePlace Where)
	{
		if (Pipette.Place != PipettePlaceOf(Hand)) { return "La mano seleccionada no sostiene la pipeta."; }
		if (Where == EPipettePlace::Cabinet && Pipette.Ml > 0.05) { return "La pipeta contiene l\303\255quido: desc\303\241rgala en el matraz antes de guardarla."; }
		Pipette.Place = Where;
		return Where == EPipettePlace::Hood ? "Pipeta colocada en su soporte de la campana." : "Pipeta guardada en su gabinete.";
	}

	bool FHood::PourPipette()
	{
		const int Reagent = Pipette.Reagent; const double Ml = Pipette.Ml;
		if (Busy()) { return false; }
		if (Pipette.Place != EPipettePlace::Hood) { Error = "El soporte est\303\241 vac\303\255o. Trae la pipeta del gabinete de pipetas."; return false; }
		if (Reagent < 0 || Ml < 0.1) { Error = "La pipeta est\303\241 vac\303\255a. Con un frasco en la mano, mant\303\251n el clic sobre ella para aspirar."; return false; }
		if (Sash == ESash::Closed) { Error = ClosedSashShort; return false; }
		if (Mixture.WaterMl + Ml > VesselMl) { Error = "El matraz se desbordar\303\255a: caben " + Js(VesselMl) + " mL."; return false; }
		const double Amount = JsRound(Ml * 10.0) / 10.0;
		TransferThen(ETransfer::Pipette, Reagent);
		Timer.Amount = Amount;
		return true;
	}

	bool FHood::PourBalance()
	{
		const int Reagent = Balance.Reagent; const double Grams = Balance.Grams;
		if (Busy()) { return false; }
		if (Reagent < 0 || Grams < 0.05) { Error = "No hay s\303\263lido pesado. Con el frasco en la mano, mant\303\251n el clic sobre la balanza para a\303\261adirlo con la esp\303\241tula."; return false; }
		// Sin comprobar la ventana ni el desborde: el motor lo rechaza al acabar la animación (reglas 10 y 15).
		const double Amount = JsRound(Grams * 100.0) / 100.0;
		TransferThen(ETransfer::Balance, Reagent);
		Timer.Amount = Amount;
		return true;
	}

	bool FHood::RinseCylinder()
	{
		if (Busy()) { return false; }
		const bool bPipetteDirty = Pipette.Place == EPipettePlace::Hood && (Pipette.Dirty >= 0 || Pipette.Ml > 0.05);
		if (Cylinder.Dirty < 0 && Cylinder.Ml <= 0.05 && !bPipetteDirty) { Error = "La probeta ya est\303\241 limpia."; return false; }
		// La piseta enjuaga la probeta y, si está en su soporte, también la pipeta.
		TransferThen(ETransfer::Rinse, -1);
		Timer.bPipetteDirty = bPipetteDirty;
		return true;
	}

	bool FHood::Dispose()
	{
		if (Busy()) { return false; }
		if (Mixture.Additions.empty()) { Error = "El matraz est\303\241 vac\303\255o."; return false; }
		TransferThen(ETransfer::Waste, -1);
		return true;
	}

	void FHood::SelectRecipe(std::string_view Id)
	{
		const int Def = Id.empty() ? -1 : FindHoodRecipe(Id);
		if (Def >= 0)
		{
			FRecipeRun Run;
			Run.Recipe = Def;
			Run.bCleanNeeded = !Mixture.Additions.empty();
			Recipe = Run;
		}
		else { Recipe.reset(); }
		Error.clear();
	}

	void FHood::Empty()
	{
		Timer = FTimer();
		Mixture = EmptyMixture(); Log.clear(); Burst.reset(); Pouring.reset(); Transfer.reset(); SavedAt.reset(); Error.clear();
		Disposals += 1;
	}

	std::string FHood::ToggleSash()
	{
		Sash = Sash == ESash::Open ? ESash::Work : ESash::Open;
		return Sash == ESash::Open
			? "Ventana subida por completo: \303\272sala para colocar material y b\303\241jala antes de mezclar."
			: "Ventana a la altura de trabajo: protege tu cara mientras mezclas.";
	}

	void FHood::Toggle(EToggle Key)
	{
		if (Key == EToggle::Light) { bLight = !bLight; }
		else if (Key == EToggle::Fan) { bFan = !bFan; }
		else { bStirring = !bStirring; }
	}

	void FHood::Save()
	{
		if (Mixture.Additions.empty()) { return; }
		const FAnalysis A = AnalyzeMixture(Mixture);
		FHoodRecord Record;
		Record.Id = static_cast<long long>(Records.size());
		Record.At = Now;
		Record.Additions = Mixture.Additions;
		Record.PH = A.PH; Record.TemperatureC = A.TemperatureC; Record.VolumeMl = A.VolumeMl;
		for (const FSolidInfo& Solid : A.Solids) { Record.Solids.push_back(GetSpecies()[static_cast<size_t>(Solid.Species)].Label); }
		static const char* const GasSpecies[3] = { "CO2", "H2", "O2" };
		for (const FGasInfo& Gas : A.Gases)
		{
			const int Species = FindSpecies(GasSpecies[static_cast<int>(Gas.Gas)]);
			Record.Gases.push_back({ Species >= 0 ? GetSpecies()[static_cast<size_t>(Species)].Label : GasSpecies[static_cast<int>(Gas.Gas)], Gas.Mol });
		}
		for (const FHoodLogEntry& Entry : Log)
		{
			FHoodRecordLog Line{ Entry.Reagent, Entry.Amount, {}, {} };
			for (const FEvent& E : Entry.Events) { Line.Titles.push_back(E.Title); Line.Equations.push_back(E.Equation); }
			Record.Log.push_back(std::move(Line));
		}
		Records.push_back(std::move(Record));
		if (Records.size() > static_cast<size_t>(HoodRecordsMax)) { Records.erase(Records.begin(), Records.begin() + static_cast<std::ptrdiff_t>(Records.size() - HoodRecordsMax)); }
		SavedAt = Now;
		if (Recipe.has_value()) { Recipe->bSaved = true; }
	}

	void FHood::Annotate(long long RecordId, std::string Observation)
	{
		for (FHoodRecord& Record : Records) { if (Record.Id == RecordId) { Record.Observation = Observation; } }
	}

	void FHood::ReturnAll()
	{
		for (EPlace& Place : Places) { if (Place == EPlace::Hood) { Place = EPlace::Shelf; } }
	}

	void FHood::EmptyTools()
	{
		Cylinder = FCylinder(); Balance = FBalance(); Pipette = FPipette();
	}

	void FHood::ResetSession()
	{
		// No reinicia el contador de ids ni el chorro: en TypeScript son variables del módulo.
		Timer = FTimer();
		Places.fill(EPlace::Shelf);
		Mixture = EmptyMixture(); Log.clear(); Burst.reset(); Pouring.reset(); Transfer.reset();
		EmptyTools();
		Disposals = 0; Recipe.reset(); Sash = ESash::Work; bLight = true; bFan = true; bStirring = false; SavedAt.reset(); Error.clear();
	}

	void FHood::CancelPour()
	{
		Timer = FTimer();
		ResetStream();
		Pouring.reset(); Transfer.reset();
	}

	int HoodGuidedIndex(const FHood& Hood)
	{
		bool bReacted = false;
		for (const FHoodLogEntry& Entry : Hood.Log) { if (!Entry.Events.empty()) { bReacted = true; break; } }
		if (Hood.Mixture.Additions.size() >= 2 && bReacted) { return 3; }
		if (!Hood.Mixture.Additions.empty()) { return 2; }
		for (EPlace Place : Hood.Places) { if (Place != EPlace::Shelf) { return 1; } }
		return 0;
	}

	std::vector<FRecipeStep> RecipeSteps(const FHoodRecipe& Def, const FRecipeRun& Run, const FHood& Hood, const FPpe& Ppe)
	{
		std::vector<FRecipeStep> Steps;
		auto Place = [&Hood](int Reagent) { return Hood.Places[static_cast<size_t>(Reagent)]; };
		auto AddedOf = [&Run](int Reagent) { const std::optional<double>& A = Run.Added[static_cast<size_t>(Reagent)]; return A.has_value() ? *A : 0.0; };

		FRecipeStep PpeStep{ "ppe", "Ponte gafas y guantes", "Estaci\303\263n de protecci\303\263n junto a la puerta.", Ppe.bGoggles && Ppe.bGloves, {} };
		if (!Ppe.bGoggles) { PpeStep.Targets.push_back({ "ppe-goggles", "Gafas" }); }
		if (!Ppe.bGloves) { PpeStep.Targets.push_back({ "ppe-gloves", "Guantes" }); }
		Steps.push_back(std::move(PpeStep));
		if (Run.bCleanNeeded) { Steps.push_back({ "clean", "Vac\303\255a el matraz en residuos", "Empieza siempre con el material limpio.", false, { { "hood-waste", "Residuos" } } }); }

		std::vector<int> Needed;
		for (const FRecipeAdd& Add : Def.Adds) { if (std::find(Needed.begin(), Needed.end(), Add.Reagent) == Needed.end()) { Needed.push_back(Add.Reagent); } }
		FRecipeStep Collect{ "collect", "Re\303\272ne los reactivos", "", false, {} };
		for (size_t Index = 0; Index < Needed.size(); ++Index)
		{
			if (Index > 0) { Collect.Detail += " \302\267 "; }
			Collect.Detail += NameOf(Needed[Index]);
			double FirstAmount = 0.0;
			for (const FRecipeAdd& Add : Def.Adds) { if (Add.Reagent == Needed[Index]) { FirstAmount = Add.Amount; break; } }
			if (Place(Needed[Index]) == EPlace::Shelf && AddedOf(Needed[Index]) < FirstAmount * 0.9)
			{
				Collect.Targets.push_back({ "reagent:" + std::string(R(Needed[Index]).Id), NameOf(Needed[Index]) });
			}
		}
		Collect.bDone = Collect.Targets.empty();
		Steps.push_back(std::move(Collect));

		for (size_t Index = 0; Index < Def.Adds.size(); ++Index)
		{
			const FRecipeAdd& Add = Def.Adds[Index];
			const std::string Name = NameOf(Add.Reagent);
			const std::string Amount = AmountText(Add.Reagent, Add.Amount);
			const std::string BottleTarget = "reagent:" + std::string(R(Add.Reagent).Id);
			const bool bDone = AddedOf(Add.Reagent) >= Add.Amount * 0.9;
			const bool bInHand = InHand(Place(Add.Reagent));
			std::vector<FRecipeTarget> Targets;
			if (!bDone)
			{
				if (Add.Tool == ETool::Probeta)
				{
					// Orden de decisión de la regla 21.
					const bool bMeasured = Hood.Cylinder.Reagent == Add.Reagent && Hood.Cylinder.Ml >= Add.Amount * 0.9;
					if (bMeasured) { Targets = { { "hood-cylinder", "E \302\267 Verter en el matraz" } }; }
					else if (Hood.Cylinder.Ml <= 0.05 && Hood.Cylinder.Dirty >= 0 && Hood.Cylinder.Dirty != Add.Reagent) { Targets = { { "hood-washbottle", "Enjuaga la probeta" } }; }
					else if (bInHand) { Targets = { { "hood-cylinder", "Llena hasta " + Amount } }; }
					else { Targets = { { BottleTarget, Name } }; }
				}
				else if (Add.Tool == ETool::Balanza)
				{
					const bool bWeighed = Hood.Balance.Reagent == Add.Reagent && Hood.Balance.Grams >= Add.Amount * 0.9;
					if (bWeighed) { Targets = { { "hood-balance", "E \302\267 A\303\261adir al matraz" } }; }
					else if (bInHand) { Targets = { { "hood-balance", "Pesa " + Amount } }; }
					else { Targets = { { BottleTarget, Name } }; }
				}
				else { Targets = bInHand ? std::vector<FRecipeTarget>{ { "hood", Amount + " al matraz" } } : std::vector<FRecipeTarget>{ { BottleTarget, Name } }; }
			}
			FRecipeStep Step;
			Step.Key = "add-" + std::to_string(Index);
			Step.Title = Add.Tool == ETool::Probeta ? "Mide " + Amount + " de " + Name + " en la probeta y vi\303\251rtelos en el matraz"
				: Add.Tool == ETool::Balanza ? "Pesa " + Amount + " de " + Name + " en la balanza y a\303\261\303\241delos al matraz"
				: "A\303\261ade " + Amount + " de " + Name + " con el gotero";
			Step.Detail = Add.Tool == ETool::Probeta ? "Mant\303\251n el clic sobre la probeta y lee la marca."
				: Add.Tool == ETool::Balanza ? "Mant\303\251n el clic sobre la balanza para usar la esp\303\241tula."
				: "Mant\303\251n el clic sobre el matraz: cae una gota cada medio segundo.";
			Step.bDone = bDone;
			Step.Targets = std::move(Targets);
			Steps.push_back(std::move(Step));
		}
		Steps.push_back({ "observe", "Observa el resultado", Def.Observe, Run.bObserved, { { "hood", "Observa" } } });
		Steps.push_back({ "save", "An\303\263talo en el cuaderno", "E en la campana \342\206\222 \302\253Guardar en el cuaderno\302\273.", Run.bSaved || Run.bDisposed, { { "hood", "E \302\267 Guardar" } } });
		Steps.push_back({ "dispose", "Desecha la mezcla en residuos", Def.Waste, Run.bDisposed, { { "hood-waste", "E \302\267 Residuos" } } });
		return Steps;
	}

	// ---------------------------------------------------------------- useLab (ramas de la campana)

	bool IsHoodTarget(std::string_view Target)
	{
		return !Target.empty() && (StartsWith(Target, "reagent:") || StartsWith(Target, "hood") || StartsWith(Target, "ppe-") || Target == "reagent-shelf" || Target == "recipe-board");
	}

	namespace HoodDetail
	{
		struct FItem { const char* Id; const char* Name; };
		const FItem Items[3] = { { "beaker", "Vaso de precipitados" }, { "vinegar", "Vinagre" }, { "bicarbonate", "Bicarbonato de sodio" } };
		bool IsSurface(std::string_view Id) { return Id == "shelf" || Id == "bench" || Id == "support-1" || Id == "support-2"; }
		const char* SurfaceName(std::string_view Id)
		{
			if (Id == "shelf") { return "Reactivos y material"; }
			if (Id == "bench") { return "Mesa de reacci\303\263n"; }
			if (Id == "support-1") { return "Mesa 02 \302\267 Conductividad"; }
			return "Mesa 03 \302\267 Cristalizaci\303\263n";
		}
		const char* HandName(EHand Hand) { return Hand == EHand::Left ? "left" : "right"; }
	}

	std::string* FLabSession::LocationOf(std::string_view Item)
	{
		if (Item == "beaker") { return &BeakerAt; }
		if (Item == "vinegar") { return &VinegarAt; }
		if (Item == "bicarbonate") { return &BicarbonateAt; }
		return nullptr;
	}

	bool FLabSession::HandBusy() const
	{
		const std::string HandId = HandName(Hand);
		return BeakerAt == HandId || VinegarAt == HandId || BicarbonateAt == HandId || Hood.HeldIn(Hand) >= 0 || Hood.Pipette.Place == PipettePlaceOf(Hand);
	}

	void FLabSession::Start(ELabMode InMode)
	{
		Hood.ResetSession();
		RequestedMode = InMode; ActivePractice = "reaction";
		Mode = !bTutorialDone || InMode == ELabMode::Tutorial ? ELabMode::Tutorial : InMode;
		Tutorial = 0; Moved = 0.0; Looked = 0.0; Hand = EHand::Right; Ppe = FPpe();
		BeakerAt = "shelf"; VinegarAt = "shelf"; BicarbonateAt = "shelf";
		Panel.clear(); Target.clear(); Message.clear();
	}

	void FLabSession::Menu()
	{
		Hood.CancelPour();
		Mode.reset(); bLocked = false; Panel.clear();
	}

	void FLabSession::SelectHand(EHand InHand)
	{
		Hand = InHand;
		if (Mode == ELabMode::Tutorial && Tutorial == 4) { Tutorial = 5; }
	}

	void FLabSession::SetTarget(std::string_view InTarget)
	{
		Target = std::string(InTarget);
		if (Mode == ELabMode::Tutorial && Tutorial == 2 && InTarget == "beaker") { Tutorial = 3; }
	}

	void FLabSession::Progress(bool bMove, double Amount)
	{
		if (Mode != ELabMode::Tutorial) { return; }
		if (bMove && Tutorial == 0) { Moved = Moved + Amount; Tutorial = Moved > 1.0 ? 1 : 0; }
		if (!bMove && Tutorial == 1) { Looked = Looked + Amount; Tutorial = Looked > 150.0 ? 2 : 1; }
	}

	void FLabSession::Open(std::string_view InPanel)
	{
		Panel = std::string(InPanel); bLocked = false; Message.clear();
	}

	void FLabSession::Interact()
	{
		// Instantánea del estado, como `const s = get()` en lab.ts.
		const std::optional<ELabMode> SMode = Mode;
		const std::string SActive = ActivePractice;
		const std::string T = Target;
		const bool bTutorial = SMode == ELabMode::Tutorial;
		const bool bBusy = HandBusy();

		if (T == "tool:pipette")
		{
			if (bTutorial) { Message = "Termina el tutorial para usar el material de los gabinetes."; return; }
			if (bBusy) { Message = "Esta mano est\303\241 ocupada. Cambia con 1 / 2 o deja el objeto con Q."; return; }
			Message = Hood.TakePipette(Hand);
			if (SMode == ELabMode::Free) { ActivePractice = "hood"; }
			return;
		}
		if (IsHoodTarget(T))
		{
			if (bTutorial) { Message = "Termina el tutorial para usar la estanter\303\255a y la campana."; return; }
			auto Report = [this](bool bOk, const std::string& Done) { Message = bOk ? Done : Hood.Error; };
			if (T == "ppe-goggles") { Message = Ppe.bGoggles ? "Ya llevas las gafas de seguridad." : "Gafas de seguridad puestas. Protegen tus ojos de salpicaduras."; Ppe.bGoggles = true; return; }
			if (T == "ppe-gloves") { Message = Ppe.bGloves ? "Ya llevas guantes." : "Guantes de nitrilo puestos. Ya puedes manipular reactivos."; Ppe.bGloves = true; return; }
			if (Hood.Pipette.Place == PipettePlaceOf(Hand) && StartsWith(T, "hood")) { Message = Hood.PutPipette(Hand, EPipettePlace::Hood); return; }
			if (T == "hood-pipette")
			{
				const double Ml = Hood.Pipette.Ml;
				const bool bOk = Hood.PourPipette();
				Report(bOk, "Descargas " + FormatEs(Ml, 1) + " mL de la pipeta en el matraz\342\200\246");
				return;
			}
			if (T == "recipe-board") { ActivePractice = "hood"; Open("recipes"); return; }
			if (StartsWith(T, "reagent:"))
			{
				const int Reagent = FindReagent(std::string_view(T).substr(8));
				if (!Ppe.bGoggles || !Ppe.bGloves)
				{
					Message = std::string("Antes de tocar reactivos ponte ") + (!Ppe.bGoggles && !Ppe.bGloves ? "las gafas y los guantes" : !Ppe.bGoggles ? "las gafas" : "los guantes")
						+ ": estaci\303\263n de protecci\303\263n junto a la puerta.";
					return;
				}
				if (bBusy) { Message = "Esta mano est\303\241 ocupada. Cambia con 1 / 2 o deja el objeto con Q."; return; }
				if (Reagent < 0) { return; }
				Message = Hood.Pick(Reagent, Hand);
				if (SActive != "hood" && SMode == ELabMode::Free) { ActivePractice = "hood"; }
			}
			else if (T == "hood") { ActivePractice = "hood"; Open("hood"); }
			else if (T == "hood-sash") { Message = Hood.ToggleSash(); }
			else if (T == "hood-cylinder")
			{
				const double Ml = Hood.Cylinder.Ml;
				const bool bOk = Hood.PourCylinder();
				Report(bOk, "Viertes " + Js(JsRound(Ml)) + " mL de la probeta en el matraz\342\200\246");
			}
			else if (T == "hood-balance") { const bool bOk = Hood.PourBalance(); Report(bOk, "A\303\261ades el s\303\263lido pesado al matraz\342\200\246"); }
			else if (T == "hood-washbottle") { const bool bOk = Hood.RinseCylinder(); Report(bOk, "Enjuagas la probeta con agua destilada de la piseta\342\200\246"); }
			else if (T == "hood-waste") { const bool bOk = Hood.Dispose(); Report(bOk, "Viertes la mezcla en el recipiente de residuos\342\200\246"); }
			else { Message = "Apunta a un frasco y pulsa E para recogerlo. Q devuelve a la estanter\303\255a el frasco de tu mano."; }
			return;
		}
		if (!bTutorial && (T == "support-1" || T == "support-2"))
		{
			const char* Id = T == "support-1" ? "conductivity" : "dissolution";
			ActivePractice = Id; Open(Id); return;
		}
		if (std::string* Location = LocationOf(T))
		{
			// La mezcla del vaso de la práctica 01 no se porta: el vaso siempre está vacío.
			if (bTutorial && (T != "beaker" || Tutorial != 3)) { Message = "Sigue los pasos del tutorial."; return; }
			if (bBusy) { Message = "Esta mano est\303\241 ocupada. Cambia con 1 / 2 o coloca el objeto con Q."; return; }
			*Location = HandName(Hand);
			for (const FItem& Item : Items) { if (T == Item.Id) { Message = std::string(Item.Name) + " en la mano " + HandText(Hand) + "."; } }
			if (bTutorial) { Tutorial = 4; }
		}
		if (T == "bench")
		{
			if (!bTutorial) { ActivePractice = "reaction"; }
			const bool bBeakerHeld = BeakerAt == "left" || BeakerAt == "right";
			if (bBeakerHeld)
			{
				if (bTutorial && Tutorial != 5) { return; }
				BeakerAt = "bench"; Message = "Vaso colocado en la mesa.";
				if (bTutorial) { Tutorial = 6; }
			}
			else
			{
				if (bTutorial)
				{
					if (Tutorial != 6) { return; }
					bTutorialDone = true;
					Mode = RequestedMode == ELabMode::Tutorial ? ELabMode::Guided : RequestedMode;
					Message = "\302\241Tutorial completado! Prepara tu primer experimento.";
				}
				if (bTutorial && SActive != "reaction") { Open(""); }
				else { Open("station"); }
			}
		}
		if (T == "periodic" && !bTutorial) { Open("periodic"); }
		if (!T.empty() && T != "bench" && IsSurface(T)) { Drop(); }
	}

	void FLabSession::Drop()
	{
		const int Held = Hood.HeldIn(Hand);
		const std::string T = Target;
		if (Hood.Pipette.Place == PipettePlaceOf(Hand))
		{
			Message = StartsWith(T, "hood") ? Hood.PutPipette(Hand, EPipettePlace::Hood)
				: T == "cabinet:pipetas" ? Hood.PutPipette(Hand, EPipettePlace::Cabinet)
				: "Apunta a la campana o al gabinete de pipetas y pulsa Q para dejar la pipeta.";
			return;
		}
		if (Held >= 0)
		{
			const int Aimed = StartsWith(T, "reagent:") ? FindReagent(std::string_view(T).substr(8)) : -1;
			const bool bOnShelf = T == "reagent-shelf" || (Aimed >= 0 && Hood.Places[static_cast<size_t>(Aimed)] == EPlace::Shelf);
			const bool bInHood = StartsWith(T, "hood") || (Aimed >= 0 && Hood.Places[static_cast<size_t>(Aimed)] == EPlace::Hood);
			Message = bOnShelf ? Hood.Put(Hand, EPlace::Shelf) : bInHood ? Hood.Put(Hand, EPlace::Hood)
				: "Apunta a la estanter\303\255a de reactivos o a la campana y pulsa Q para dejar el frasco.";
			return;
		}
		// placementSurface: la superficie apuntada, o aquella en la que está el objeto apuntado.
		std::string Surface;
		if (IsSurface(T)) { Surface = T; }
		else if (const std::string* Location = LocationOf(T)) { if (IsSurface(*Location)) { Surface = *Location; } }
		if (Surface.empty()) { Message = "Apunta a Reactivos y material o a una mesa y pulsa Q para colocar el objeto."; return; }
		if (Mode == ELabMode::Tutorial)
		{
			if (Surface == "bench") { Interact(); }
			else { Message = "En este paso coloca el vaso en la mesa de reacci\303\263n."; }
			return;
		}
		const std::string HandId = HandName(Hand);
		for (const FItem& Item : Items)
		{
			std::string* Location = LocationOf(Item.Id);
			if (*Location != HandId) { continue; }
			*Location = Surface; Target = Surface;
			Message = std::string(Item.Name) + " colocado en " + SurfaceName(Surface) + ".";
			return;
		}
		Message = "La mano seleccionada est\303\241 libre. Cambia de mano con 1 / 2.";
	}
}

#if defined(_MSC_VER)
#pragma float_control(pop)
#endif
