#include "ExperimentaChem/HoodGolden.h"

#include <algorithm>
#include <cmath>
#include <map>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

#include "ExperimentaChem/Hood.h"
#include "GoldenCommon.h"
#include "MiniJson.h"

// Equivalente en C++ de golden/steps/lib/harness.ts (ejecutar cada operación y capturar el estado observable en
// forma canónica) y de golden/steps/lib/compare.ts (reconstruir estados completos y compararlos). Si cambian,
// cambia esto. No contiene reglas de juego: cada operación llama a una acción de FLabSession o de FHood.
namespace ExperimentaChem
{
namespace
{
	using namespace GoldenImpl;

	// ---------------------------------------------------------------- Forma canónica del estado (capture)

	FValue Bool(bool bValue) { return FValue::MakeBool(bValue); }
	FValue ReagentOrNull(int Reagent) { return Reagent >= 0 ? Str(GetReagents()[static_cast<size_t>(Reagent)].Id) : FValue::MakeNull(); }
	const char* ReagentId(int Reagent) { return GetReagents()[static_cast<size_t>(Reagent)].Id; }

	const char* PlaceName(EPlace Place)
	{
		switch (Place)
		{
		case EPlace::Shelf: return "shelf";
		case EPlace::Hood: return "hood";
		case EPlace::Left: return "left";
		case EPlace::Right: return "right";
		}
		return "?";
	}
	const char* SashName(ESash Sash) { return Sash == ESash::Closed ? "closed" : Sash == ESash::Work ? "work" : "open"; }
	const char* TargetName(EStreamTarget Target)
	{
		switch (Target)
		{
		case EStreamTarget::Flask: return "flask";
		case EStreamTarget::Cylinder: return "cylinder";
		case EStreamTarget::Balance: return "balance";
		case EStreamTarget::Pipette: return "pipette";
		}
		return "?";
	}
	const char* TransferName(ETransfer Kind)
	{
		switch (Kind)
		{
		case ETransfer::Bottle: return "bottle";
		case ETransfer::Cylinder: return "cylinder";
		case ETransfer::Balance: return "balance";
		case ETransfer::Waste: return "waste";
		case ETransfer::Rinse: return "rinse";
		case ETransfer::Pipette: return "pipette";
		}
		return "?";
	}
	const char* ModeName(ELabMode Mode) { return Mode == ELabMode::Free ? "free" : Mode == ELabMode::Guided ? "guided" : "tutorial"; }

	/** Textos de evento observados, por «regla|sentido» (recordTexts de golden/lib/harness.ts). */
	using FEventTexts = std::map<std::string, FValue>;

	void RecordTexts(FEventTexts& Texts, const FEvent& E)
	{
		const std::string Key = RuleId(E.Rule) + "|" + E.Kind;
		if (Texts.count(Key) != 0) { return; }
		FValue Entry = FValue::MakeObject();
		Entry.Set("rule", Str(RuleId(E.Rule)));
		Entry.Set("kind", Str(E.Kind));
		Entry.Set("title", Str(E.Title));
		Entry.Set("note", Str(E.Note));
		Entry.Set("equation", Str(E.Equation));
		Entry.Set("vigor", Num(E.Vigor));
		Entry.Set("deltaH", OptNum(E.DeltaH));
		Texts.emplace(Key, std::move(Entry));
	}

	FValue Additions(const std::vector<FAddition>& List)
	{
		FValue Out = FValue::MakeArray();
		for (const FAddition& A : List)
		{
			FValue Item = FValue::MakeObject();
			Item.Set("reagent", Str(ReagentId(A.Reagent)));
			Item.Set("amount", Num(A.Amount));
			Out.Push(std::move(Item));
		}
		return Out;
	}

	FValue Capture(const FLabSession& S, FEventTexts& Texts)
	{
		const FHood& H = S.Hood;
		FValue Out = FValue::MakeObject();
		Out.Set("mode", S.Mode.has_value() ? Str(ModeName(*S.Mode)) : FValue::MakeNull());
		Out.Set("hand", Str(S.Hand == EHand::Left ? "left" : "right"));
		FValue Ppe = FValue::MakeObject();
		Ppe.Set("goggles", Bool(S.Ppe.bGoggles));
		Ppe.Set("gloves", Bool(S.Ppe.bGloves));
		Out.Set("ppe", std::move(Ppe));
		Out.Set("message", Str(S.Message));
		Out.Set("panel", S.Panel.empty() ? FValue::MakeNull() : Str(S.Panel));
		Out.Set("activePractice", Str(S.ActivePractice));
		FValue Locations = FValue::MakeObject();
		Locations.Set("beaker", Str(S.BeakerAt));
		Locations.Set("vinegar", Str(S.VinegarAt));
		Locations.Set("bicarbonate", Str(S.BicarbonateAt));
		Out.Set("locations", std::move(Locations));

		FValue Places = FValue::MakeArray();
		for (int Reagent : GetShelfOrder())
		{
			const EPlace Place = H.Places[static_cast<size_t>(Reagent)];
			if (Place == EPlace::Shelf) { continue; }
			FValue Pair = FValue::MakeArray();
			Pair.Push(Str(ReagentId(Reagent)));
			Pair.Push(Str(PlaceName(Place)));
			Places.Push(std::move(Pair));
		}
		Out.Set("places", std::move(Places));
		FValue Held = FValue::MakeObject();
		Held.Set("left", ReagentOrNull(H.HeldIn(EHand::Left)));
		Held.Set("right", ReagentOrNull(H.HeldIn(EHand::Right)));
		Out.Set("held", std::move(Held));

		FValue Cylinder = FValue::MakeObject();
		Cylinder.Set("reagent", ReagentOrNull(H.Cylinder.Reagent));
		Cylinder.Set("ml", Num(H.Cylinder.Ml));
		Cylinder.Set("dirty", ReagentOrNull(H.Cylinder.Dirty));
		Out.Set("cylinder", std::move(Cylinder));
		FValue Balance = FValue::MakeObject();
		Balance.Set("reagent", ReagentOrNull(H.Balance.Reagent));
		Balance.Set("grams", Num(H.Balance.Grams));
		Out.Set("balance", std::move(Balance));

		if (H.Pouring.has_value())
		{
			FValue Pouring = FValue::MakeObject();
			Pouring.Set("reagent", Str(ReagentId(H.Pouring->Reagent)));
			Pouring.Set("amount", Num(H.Pouring->Amount));
			Pouring.Set("startedAt", Num(H.Pouring->StartedAt));
			Pouring.Set("stream", Bool(H.Pouring->bStream));
			Pouring.Set("target", H.Pouring->Target.has_value() ? Str(TargetName(*H.Pouring->Target)) : FValue::MakeNull());
			Out.Set("pouring", std::move(Pouring));
		}
		else { Out.Set("pouring", FValue::MakeNull()); }
		if (H.Transfer.has_value())
		{
			FValue Transfer = FValue::MakeObject();
			Transfer.Set("kind", Str(TransferName(H.Transfer->Kind)));
			Transfer.Set("reagent", ReagentOrNull(H.Transfer->Reagent));
			Transfer.Set("startedAt", Num(H.Transfer->StartedAt));
			Out.Set("transfer", std::move(Transfer));
		}
		else { Out.Set("transfer", FValue::MakeNull()); }

		Out.Set("sash", Str(SashName(H.Sash)));
		Out.Set("light", Bool(H.bLight));
		Out.Set("fan", Bool(H.bFan));
		Out.Set("stirring", Bool(H.bStirring));
		Out.Set("error", Str(H.Error));
		Out.Set("disposals", Num(H.Disposals));

		FValue Mixture = CanonMixture(H.Mixture);
		Mixture.Set("additions", Additions(H.Mixture.Additions));
		Out.Set("mixture", std::move(Mixture));
		Out.Set("analysis", CanonAnalysis(H.Mixture));

		FValue Log = FValue::MakeArray();
		for (const FHoodLogEntry& Entry : H.Log)
		{
			FValue Item = FValue::MakeObject();
			Item.Set("reagent", Str(ReagentId(Entry.Reagent)));
			Item.Set("amount", Num(Entry.Amount));
			FValue Events = FValue::MakeArray();
			for (const FEvent& E : Entry.Events) { Events.Push(CanonEvent(E)); RecordTexts(Texts, E); }
			Item.Set("events", std::move(Events));
			Item.Set("deltaT", Num(Entry.DeltaT));
			Item.Set("note", Str(Entry.Note));
			Log.Push(std::move(Item));
		}
		Out.Set("log", std::move(Log));

		if (H.Burst.has_value())
		{
			FValue Burst = FValue::MakeObject();
			Burst.Set("gasMol", Num(H.Burst->GasMol));
			Burst.Set("vigor", Num(H.Burst->Vigor));
			Burst.Set("solidColor", H.Burst->SolidColor.has_value() ? Str(*H.Burst->SolidColor) : FValue::MakeNull());
			Burst.Set("deltaT", Num(H.Burst->DeltaT));
			Burst.Set("colorChange", Bool(H.Burst->bColorChange));
			Out.Set("burst", std::move(Burst));
		}
		else { Out.Set("burst", FValue::MakeNull()); }

		if (H.Recipe.has_value())
		{
			const FRecipeRun& Run = *H.Recipe;
			FValue Recipe = FValue::MakeObject();
			Recipe.Set("id", Str(GetHoodRecipes()[static_cast<size_t>(Run.Recipe)].Id));
			Recipe.Set("cleanNeeded", Bool(Run.bCleanNeeded));
			FValue Added = FValue::MakeArray();
			for (int Reagent : GetShelfOrder())
			{
				const std::optional<double>& Amount = Run.Added[static_cast<size_t>(Reagent)];
				if (Amount.has_value()) { Added.Push(IdAmountPair(ReagentId(Reagent), *Amount)); }
			}
			Recipe.Set("added", std::move(Added));
			Recipe.Set("observed", Bool(Run.bObserved));
			Recipe.Set("saved", Bool(Run.bSaved));
			Recipe.Set("disposed", Bool(Run.bDisposed));
			Out.Set("recipe", std::move(Recipe));
		}
		else { Out.Set("recipe", FValue::MakeNull()); }
		Out.Set("saved", Bool(H.SavedAt.has_value()));

		FValue Records = FValue::MakeObject();
		Records.Set("count", Num(static_cast<double>(H.Records.size())));
		if (!H.Records.empty())
		{
			const FHoodRecord& Last = H.Records.back();
			FValue L = FValue::MakeObject();
			L.Set("additions", Additions(Last.Additions));
			L.Set("pH", OptNum(Last.PH));
			L.Set("temperatureC", Num(Last.TemperatureC));
			L.Set("volumeMl", Num(Last.VolumeMl));
			FValue Solids = FValue::MakeArray();
			for (const std::string& Label : Last.Solids) { Solids.Push(Str(Label)); }
			L.Set("solids", std::move(Solids));
			FValue Gases = FValue::MakeArray();
			for (const FHoodRecordGas& Gas : Last.Gases)
			{
				FValue Item = FValue::MakeObject();
				Item.Set("label", Str(Gas.Label));
				Item.Set("mol", Num(Gas.Mol));
				Gases.Push(std::move(Item));
			}
			L.Set("gases", std::move(Gases));
			FValue RecordLog = FValue::MakeArray();
			for (const FHoodRecordLog& Line : Last.Log)
			{
				FValue Item = FValue::MakeObject();
				Item.Set("reagent", Str(ReagentId(Line.Reagent)));
				Item.Set("amount", Num(Line.Amount));
				FValue Titles = FValue::MakeArray();
				for (const std::string& Title : Line.Titles) { Titles.Push(Str(Title)); }
				FValue Equations = FValue::MakeArray();
				for (const std::string& Equation : Line.Equations) { Equations.Push(Str(Equation)); }
				Item.Set("titles", std::move(Titles));
				Item.Set("equations", std::move(Equations));
				RecordLog.Push(std::move(Item));
			}
			L.Set("log", std::move(RecordLog));
			Records.Set("last", std::move(L));
		}
		else { Records.Set("last", FValue::MakeNull()); }
		Out.Set("records", std::move(Records));
		Out.Set("guidedIndex", Num(HoodGuidedIndex(H)));

		if (H.Recipe.has_value())
		{
			FValue Steps = FValue::MakeArray();
			for (const FRecipeStep& Step : RecipeSteps(GetHoodRecipes()[static_cast<size_t>(H.Recipe->Recipe)], *H.Recipe, H, S.Ppe))
			{
				FValue Row = FValue::MakeArray();
				Row.Push(Str(Step.Key));
				Row.Push(Bool(Step.bDone));
				FValue Targets = FValue::MakeArray();
				for (const FRecipeTarget& Target : Step.Targets)
				{
					FValue Pair = FValue::MakeArray();
					Pair.Push(Str(Target.Id));
					Pair.Push(Str(Target.Label));
					Targets.Push(std::move(Pair));
				}
				Row.Push(std::move(Targets));
				Steps.Push(std::move(Row));
			}
			Out.Set("steps", std::move(Steps));
		}
		else { Out.Set("steps", FValue::MakeNull()); }
		return Out;
	}

	// ---------------------------------------------------------------- Comparación (compare.ts de steps)

	const FKeyList& ExactKeys()
	{
		static const FKeyList Keys = { "ml", "grams", "amount", "added", "startedAt", "t", "disposals", "count", "guidedIndex", "avanzaMs", "segundos", "veces",
			"cantidad", "caen", "quedan", "HOOD_TRAY_SLOTS", "POUR_MS", "CYLINDER_ML", "CYLINDER_RATE", "VESSEL_ML", "rate", "step", "spatulaRate" };
		return Keys;
	}

	FValue Without(const FValue& Object, const std::vector<std::string>& Drop)
	{
		FValue Out = FValue::MakeObject();
		for (size_t Index = 0; Index < Object.Keys.size(); ++Index)
		{
			if (std::find(Drop.begin(), Drop.end(), Object.Keys[Index]) != Drop.end()) { continue; }
			Out.Set(Object.Keys[Index], Object.Items[Index]);
		}
		return Out;
	}

	/** walkState: `analysis` sale entero del motor químico, así que sus gramos de sólido llevan tolerancia. */
	void WalkState(const FValue& Expected, const FValue& Actual, const std::string& Where, const std::vector<std::string>& Omit, std::vector<std::string>& Out)
	{
		std::vector<std::string> Drop = Omit;
		Drop.push_back("analysis");
		const FValue E = Without(Expected, Drop), A = Without(Actual, Drop);
		FScope Scope; Scope.Exact = &ExactKeys();
		std::string Path = Where;
		Walk(&E, &A, Scope, Path, Out);
		if (std::find(Omit.begin(), Omit.end(), "analysis") != Omit.end()) { return; }
		Path = Where + ".analysis";
		Walk(Expected.Find("analysis"), Actual.Find("analysis"), FScope(), Path, Out);
	}

	/** applyChanges: el registro llega como { caen, quedan, nuevas }. */
	bool ApplyChanges(FValue& State, const FValue& Changes, std::string& Error)
	{
		if (!Changes.IsObject()) { Error = "\302\253cambia\302\273 no es un objeto"; return false; }
		for (size_t Index = 0; Index < Changes.Keys.size(); ++Index)
		{
			const std::string& Key = Changes.Keys[Index];
			const FValue& Value = Changes.Items[Index];
			auto Slot = std::find(State.Keys.begin(), State.Keys.end(), Key);
			if (Slot == State.Keys.end()) { Error = "clave de estado desconocida \302\253" + Key + "\302\273"; return false; }
			FValue& Target = State.Items[static_cast<size_t>(Slot - State.Keys.begin())];
			if (Key != "log") { Target = Value; continue; }
			const FValue* Fall = Value.Find("caen"); const FValue* Keep = Value.Find("quedan"); const FValue* New = Value.Find("nuevas");
			if (Fall == nullptr || Keep == nullptr || New == nullptr || !Fall->IsNumber() || !Keep->IsNumber() || !New->IsArray() || !Target.IsArray())
			{
				Error = "cambio del registro mal formado"; return false;
			}
			const size_t From = static_cast<size_t>(Fall->Number), Count = static_cast<size_t>(Keep->Number);
			if (From + Count > Target.Items.size()) { Error = "cambio del registro fuera de rango"; return false; }
			FValue Next = FValue::MakeArray();
			for (size_t Item = From; Item < From + Count; ++Item) { Next.Push(Target.Items[Item]); }
			for (const FValue& Item : New->Items) { Next.Push(Item); }
			Target = std::move(Next);
		}
		return true;
	}

	// ---------------------------------------------------------------- Operaciones (execute de harness.ts)

	const FValue* Arg(const FValue& Op, const char* Key)
	{
		const FValue* Args = Op.Find("args");
		return Args != nullptr && Args->IsObject() ? Args->Find(Key) : nullptr;
	}
	std::string ArgText(const FValue& Op, const char* Key)
	{
		const FValue* Value = Arg(Op, Key);
		return Value != nullptr && Value->IsString() ? Value->String : std::string();
	}
	double ArgNumber(const FValue& Op, const char* Key, double Default)
	{
		const FValue* Value = Arg(Op, Key);
		return Value != nullptr && Value->IsNumber() ? Value->Number : Default;
	}
	bool ArgHand(const FValue& Op, const char* Key, EHand& Out)
	{
		const std::string Text = ArgText(Op, Key);
		if (Text == "left") { Out = EHand::Left; return true; }
		if (Text == "right") { Out = EHand::Right; return true; }
		return false;
	}

	/**
	 * Ejecuta UNA operación y avanza el reloj. Devuelve false (con Error) si la operación no se reconoce.
	 * Returned queda nulo si la acción no devuelve nada (`undefined` en JavaScript).
	 */
	bool Execute(FLabSession& S, const FValue& Op, double AdvanceMs, FValue& Returned, std::string& Error)
	{
		const FValue* Name = Op.Find("op");
		const std::string N = Name != nullptr && Name->IsString() ? Name->String : std::string();
		FHood& H = S.Hood;
		Returned = FValue::MakeNull();
		auto Reagent = [&](int& Out) { Out = FindReagent(ArgText(Op, "reactivo")); if (Out < 0) { Error = "reactivo desconocido"; } return Out >= 0; };
		bool bTicked = false;
		EHand Hand = EHand::Right;
		int R = -1;

		if (N == "iniciar")
		{
			const std::string Mode = ArgText(Op, "modo");
			if (Mode == "free") { S.Start(ELabMode::Free); }
			else if (Mode == "guided") { S.Start(ELabMode::Guided); }
			else if (Mode == "tutorial") { S.Start(ELabMode::Tutorial); }
			else { Error = "modo desconocido"; return false; }
		}
		else if (N == "menu") { S.Menu(); }
		else if (N == "mano") { if (!ArgHand(Op, "mano", Hand)) { Error = "mano desconocida"; return false; } S.SelectHand(Hand); }
		else if (N == "usar" || N == "dejar")
		{
			S.SetTarget(ArgText(Op, "objetivo"));
			if (N == "usar") { S.Interact(); } else { S.Drop(); }
		}
		else if (N == "cerrarPanel") { S.Open(""); }
		else if (N == "receta") { H.SelectRecipe(ArgText(Op, "id")); }
		else if (N == "cogerFrasco")
		{
			if (!Reagent(R) || !ArgHand(Op, "mano", Hand)) { if (Error.empty()) { Error = "mano desconocida"; } return false; }
			Returned = Str(H.Pick(R, Hand));
		}
		else if (N == "ponerFrasco")
		{
			const std::string Where = ArgText(Op, "donde");
			if (!ArgHand(Op, "mano", Hand) || (Where != "shelf" && Where != "hood")) { Error = "argumentos no v\303\241lidos"; return false; }
			Returned = Str(H.Put(Hand, Where == "shelf" ? EPlace::Shelf : EPlace::Hood));
		}
		else if (N == "ventana")
		{
			const std::string Where = ArgText(Op, "posicion");
			if (Where == "closed") { H.SetSash(ESash::Closed); }
			else if (Where == "work") { H.SetSash(ESash::Work); }
			else if (Where == "open") { H.SetSash(ESash::Open); }
			else { Error = "posici\303\263n desconocida"; return false; }
		}
		else if (N == "conmutar")
		{
			const std::string Key = ArgText(Op, "clave");
			if (Key == "light") { H.Toggle(EToggle::Light); }
			else if (Key == "fan") { H.Toggle(EToggle::Fan); }
			else if (Key == "stirring") { H.Toggle(EToggle::Stirring); }
			else { Error = "clave desconocida"; return false; }
		}
		else if (N == "verter") { if (!Reagent(R)) { return false; } Returned = Bool(H.Pour(R, ArgNumber(Op, "cantidad", 0.0))); }
		else if (N == "chorro")
		{
			if (!Reagent(R)) { return false; }
			const FValue* Target = Arg(Op, "destino");
			EStreamTarget Where = EStreamTarget::Flask;
			if (Target != nullptr)
			{
				const std::string Text = Target->IsString() ? Target->String : std::string();
				if (Text == "flask") { Where = EStreamTarget::Flask; }
				else if (Text == "cylinder") { Where = EStreamTarget::Cylinder; }
				else if (Text == "balance") { Where = EStreamTarget::Balance; }
				else { Error = "destino desconocido"; return false; }
			}
			Returned = Bool(H.StartStream(R, Where));
		}
		else if (N == "tic")
		{
			const double Seconds = ArgNumber(Op, "segundos", 0.0);
			const double Times = ArgNumber(Op, "veces", 1.0);
			for (int Index = 0; Index < static_cast<int>(Times); ++Index) { H.StreamTick(Seconds); H.Advance(AdvanceMs); }
			bTicked = true;
		}
		else if (N == "soltar") { H.StopStream(); }
		else if (N == "verterProbeta") { Returned = Bool(H.PourCylinder()); }
		else if (N == "verterBalanza") { Returned = Bool(H.PourBalance()); }
		else if (N == "enjuagar") { Returned = Bool(H.RinseCylinder()); }
		else if (N == "desechar") { Returned = Bool(H.Dispose()); }
		else if (N == "vaciar") { H.Empty(); }
		else if (N == "guardar") { H.Save(); }
		else if (N == "devolverBandeja") { H.ReturnAll(); }
		else if (N == "reiniciar") { H.ResetSession(); }
		else if (N == "cancelar") { H.CancelPour(); }
		else if (N == "esperar") {}
		else { Error = "operaci\303\263n desconocida \302\253" + N + "\302\273"; return false; }

		if (!bTicked) { H.Advance(AdvanceMs); }
		return true;
	}

	/** begin(): sesión libre recién iniciada, tutorial ya visto, sin protección y cuaderno vacío. */
	FValue Begin(FLabSession& S, FEventTexts& Texts)
	{
		S.Hood.ResetClock();
		S.bTutorialDone = true;
		S.Start(ELabMode::Free);
		S.Hood.Records.clear();
		return Capture(S, Texts);
	}

	FValue InputOf(const FValue& Op, const FValue* T, const FValue& Returned)
	{
		FValue Out = FValue::MakeObject();
		const FValue* Name = Op.Find("op"); const FValue* Args = Op.Find("args"); const FValue* Ms = Op.Find("avanzaMs");
		Out.Set("op", Name != nullptr ? *Name : FValue::MakeNull());
		Out.Set("args", Args != nullptr ? *Args : FValue::MakeNull());
		Out.Set("avanzaMs", Ms != nullptr ? *Ms : Num(0.0));
		Out.Set("t", T != nullptr ? *T : FValue::MakeNull());
		Out.Set("devuelve", Returned);
		return Out;
	}

	// ---------------------------------------------------------------- Tablas

	void Fail(FStepsReport& Report, int MaxFailures, std::string Line)
	{
		if (static_cast<int>(Report.Failures.size()) < MaxFailures) { Report.Failures.push_back(std::move(Line)); }
	}

	void CheckTable(const char* Name, const FValue* Expected, const FValue& Actual, FStepsReport& Report, int MaxFailures)
	{
		std::vector<std::string> Out;
		FScope Scope; Scope.Exact = &ExactKeys();
		std::string Path = std::string("tables.") + Name;
		Walk(Expected, &Actual, Scope, Path, Out);
		Report.TableFailures += static_cast<int>(Out.size());
		for (std::string& Line : Out) { Fail(Report, MaxFailures, std::move(Line)); }
	}

	void CheckTables(const FValue& Tables, const FEventTexts& Seen, FStepsReport& Report, int MaxFailures)
	{
		// constants
		{
			FValue C = FValue::MakeObject();
			C.Set("HOOD_TRAY_SLOTS", Num(HoodTraySlots));
			C.Set("POUR_MS", Num(PourMs));
			C.Set("CYLINDER_ML", Num(CylinderMl));
			C.Set("CYLINDER_RATE", Num(CylinderRate));
			C.Set("VESSEL_ML", Num(VesselMl));
			FValue Stream = FValue::MakeObject();
			const std::pair<const char*, EReagentKind> Kinds[4] = { { "solution", EReagentKind::Solution }, { "water", EReagentKind::Water }, { "solid", EReagentKind::Solid }, { "indicator", EReagentKind::Indicator } };
			for (const auto& Kind : Kinds)
			{
				const FStreamRate Rate = StreamRate(Kind.second);
				FValue Item = FValue::MakeObject();
				Item.Set("rate", Num(Rate.Rate));
				Item.Set("step", Num(Rate.Step));
				Stream.Set(Kind.first, std::move(Item));
			}
			C.Set("STREAM", std::move(Stream));
			FValue Spatula = FValue::MakeArray();
			const FValue* Expected = Tables.Find("constants");
			const FValue* Samples = Expected != nullptr ? Expected->Find("spatulaRate") : nullptr;
			if (Samples != nullptr && Samples->IsArray())
			{
				for (const FValue& Sample : Samples->Items)
				{
					const double Seconds = Sample.IsArray() && !Sample.Items.empty() && Sample.Items[0].IsNumber() ? Sample.Items[0].Number : 0.0;
					Spatula.Push(IdAmountPair("", 0.0));
					Spatula.Items.back().Items[0] = Num(Seconds);
					Spatula.Items.back().Items[1] = Num(SpatulaRate(Seconds));
				}
			}
			C.Set("spatulaRate", std::move(Spatula));
			CheckTable("constants", Expected, C, Report, MaxFailures);
		}
		// reagentIds: el orden del estante.
		{
			FValue Ids = FValue::MakeArray();
			for (int Reagent : GetShelfOrder()) { Ids.Push(Reagent >= 0 ? Str(ReagentId(Reagent)) : FValue::MakeNull()); }
			CheckTable("reagentIds", Tables.Find("reagentIds"), Ids, Report, MaxFailures);
		}
		// stepTexts: título y detalle de cada paso, con «clean» pendiente para que aparezcan todos.
		{
			const FValue* Expected = Tables.Find("stepTexts");
			FValue Actual = FValue::MakeArray();
			if (Expected != nullptr && Expected->IsArray())
			{
				for (const FValue& Entry : Expected->Items)
				{
					const FValue* Id = Entry.Find("recipe");
					const std::string RecipeId = Id != nullptr && Id->IsString() ? Id->String : std::string();
					FValue Row = FValue::MakeObject();
					Row.Set("recipe", Str(RecipeId));
					FValue Steps = FValue::MakeArray();
					const int Def = FindHoodRecipe(RecipeId);
					std::vector<FRecipeStep> Mine;
					if (Def >= 0)
					{
						FHood Empty;
						FRecipeRun Run; Run.Recipe = Def; Run.bCleanNeeded = true;
						Mine = RecipeSteps(GetHoodRecipes()[static_cast<size_t>(Def)], Run, Empty, FPpe());
					}
					const FValue* ExpectedSteps = Entry.Find("steps");
					if (ExpectedSteps != nullptr && ExpectedSteps->IsArray())
					{
						for (const FValue& Step : ExpectedSteps->Items)
						{
							const FValue* Key = Step.Find("key");
							const std::string K = Key != nullptr && Key->IsString() ? Key->String : std::string();
							auto Found = std::find_if(Mine.begin(), Mine.end(), [&K](const FRecipeStep& X) { return X.Key == K; });
							FValue Item = FValue::MakeObject();
							Item.Set("key", Str(K));
							Item.Set("title", Str(Found != Mine.end() ? Found->Title : std::string("(sin paso)")));
							Item.Set("detail", Str(Found != Mine.end() ? Found->Detail : std::string("(sin paso)")));
							Steps.Push(std::move(Item));
						}
					}
					Row.Set("steps", std::move(Steps));
					Actual.Push(std::move(Row));
				}
			}
			CheckTable("stepTexts", Expected, Actual, Report, MaxFailures);
		}
		// eventTexts: los mismos eventos observados, con los mismos textos.
		{
			const FValue* Expected = Tables.Find("eventTexts");
			std::map<std::string, const FValue*> ByKey;
			if (Expected != nullptr && Expected->IsArray())
			{
				for (const FValue& Entry : Expected->Items)
				{
					const FValue* Rule = Entry.Find("rule"); const FValue* Kind = Entry.Find("kind");
					if (Rule != nullptr && Kind != nullptr && Rule->IsString() && Kind->IsString()) { ByKey[Rule->String + "|" + Kind->String] = &Entry; }
				}
			}
			for (const auto& Entry : Seen)
			{
				auto Found = ByKey.find(Entry.first);
				if (Found == ByKey.end()) { ++Report.TableFailures; Fail(Report, MaxFailures, "tables.eventTexts: el porte produce " + Entry.first + ", que no est\303\241 en los vectores"); continue; }
				CheckTable(("eventTexts[" + Entry.first + "]").c_str(), Found->second, Entry.second, Report, MaxFailures);
			}
			for (const auto& Entry : ByKey)
			{
				if (Seen.count(Entry.first) == 0) { ++Report.TableFailures; Fail(Report, MaxFailures, "tables.eventTexts: " + Entry.first + " no aparece en ning\303\272n registro del porte"); }
			}
		}
	}

	FGoldenFamily& FamilyOf(FStepsReport& Report, const std::string& Name)
	{
		for (FGoldenFamily& Family : Report.Families) { if (Family.Name == Name) { return Family; } }
		Report.Families.push_back(FGoldenFamily{ Name, 0, 0 });
		return Report.Families.back();
	}
}

	FStepsReport RunStepsGolden(std::string_view JsonText, int MaxFailures, const std::vector<std::string>& Omit)
	{
		FStepsReport Report;
		MiniJson::FParseResult Parsed = MiniJson::Parse(JsonText);
		if (!Parsed.bOk) { Report.Error = Parsed.Error; return Report; }
		const FValue& Root = Parsed.Root;
		const FValue* Tables = Root.Find("tables");
		const FValue* Initial = Root.Find("initial");
		const FValue* Cases = Root.Find("cases");
		if (Tables == nullptr || Initial == nullptr || Cases == nullptr || !Cases->IsArray() || !Initial->IsObject())
		{
			Report.Error = "faltan \302\253tables\302\273, \302\253initial\302\273 o \302\253cases\302\273";
			return Report;
		}
		Report.bParsed = true;

		FEventTexts Texts;
		FLabSession Session;
		{
			const FValue Start = Begin(Session, Texts);
			std::vector<std::string> Out;
			WalkState(*Initial, Start, "initial", Omit, Out);
			Report.TableFailures += static_cast<int>(Out.size());
			for (std::string& Line : Out) { Fail(Report, MaxFailures, std::move(Line)); }
		}

		for (const FValue& Case : Cases->Items)
		{
			const FValue* IdValue = Case.Find("id"); const FValue* FamilyValue = Case.Find("family"); const FValue* Ops = Case.Find("ops");
			const std::string Id = IdValue != nullptr && IdValue->IsString() ? IdValue->String : std::string("?");
			FGoldenFamily& Family = FamilyOf(Report, FamilyValue != nullptr && FamilyValue->IsString() ? FamilyValue->String : std::string("?"));
			++Report.Cases; ++Family.Cases;
			if (Ops == nullptr || !Ops->IsArray()) { Fail(Report, MaxFailures, Id + ": sin operaciones"); continue; }

			Begin(Session, Texts);
			FValue Expected = *Initial;
			std::vector<std::string> Out;
			for (size_t Index = 0; Index < Ops->Items.size() && Out.empty(); ++Index)
			{
				const FValue& Op = Ops->Items[Index];
				const FValue* Name = Op.Find("op");
				const std::string Where = Id + " op " + std::to_string(Index + 1) + " (" + (Name != nullptr && Name->IsString() ? Name->String : std::string("?")) + ")";
				++Report.Ops;

				std::string Error;
				const FValue* Changes = Op.Find("cambia");
				if (Changes == nullptr || !ApplyChanges(Expected, *Changes, Error)) { Out.push_back(Where + ": vectores mal formados: " + (Error.empty() ? std::string("falta \302\253cambia\302\273") : Error)); break; }

				const FValue* Ms = Op.Find("avanzaMs");
				FValue Returned;
				if (!Execute(Session, Op, Ms != nullptr && Ms->IsNumber() ? Ms->Number : 0.0, Returned, Error)) { Out.push_back(Where + ": " + Error); break; }
				const FValue Actual = Capture(Session, Texts);

				const FValue* ExpectedReturn = Op.Find("devuelve");
				const FValue ExpectedInput = InputOf(Op, Op.Find("t"), ExpectedReturn != nullptr ? *ExpectedReturn : FValue::MakeNull());
				const FValue Now = Num(Session.Hood.NowMs());
				const FValue ActualInput = InputOf(Op, &Now, Returned);
				FScope Scope; Scope.Exact = &ExactKeys();
				std::string Path = Where;
				Walk(&ExpectedInput, &ActualInput, Scope, Path, Out);
				WalkState(Expected, Actual, Where, Omit, Out);
			}
			if (Out.empty()) { ++Report.Passed; ++Family.Passed; }
			else { for (std::string& Line : Out) { Fail(Report, MaxFailures, std::move(Line)); } }
		}

		CheckTables(*Tables, Texts, Report, MaxFailures);
		return Report;
	}
}
