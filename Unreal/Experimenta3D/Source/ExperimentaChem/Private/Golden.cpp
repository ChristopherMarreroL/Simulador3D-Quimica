#include "ExperimentaChem/Golden.h"

#include <algorithm>
#include <cmath>
#include <cstdlib>
#include <initializer_list>
#include <iterator>
#include <limits>
#include <map>
#include <optional>
#include <set>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

#include "GoldenCommon.h"
#include "MiniJson.h"

// Equivalente en C++ de golden/lib/harness.ts (ejecutar cada caso y darle forma JSON) y de
// golden/lib/compare.ts (regla de tolerancia y marcas de fragilidad). Si cambian, cambia esto.
namespace ExperimentaChem
{
namespace GoldenImpl
{
	// Lo que va hasta CanonEvent lo comparte HoodGolden.cpp (ver GoldenCommon.h); el resto es propio de este archivo.

	// ---------------------------------------------------------------- compare.ts

	const double Rel = 1e-6;
	/** Como compare.ts: a partir de 20 diferencias deja de mirar (aquí, por caso o por fila de tabla). */
	const size_t MaxDiffsPerWalk = 20;
	const size_t MaxValueChars = 240;

	// FKeyList y FScope están en GoldenCommon.h.

	bool Contains(const FKeyList* List, std::string_view Key)
	{
		return List != nullptr && std::find(List->begin(), List->end(), Key) != List->end();
	}

	/** Math.max de JavaScript: NaN si alguno lo es. */
	double JsMax(double A, double B)
	{
		if (std::isnan(A) || std::isnan(B)) { return std::numeric_limits<double>::quiet_NaN(); }
		return A > B ? A : B;
	}

	bool SameNumber(double Expected, double Actual, const FScope& Scope)
	{
		if (Expected == Actual) { return true; }
		if (Contains(Scope.Exact, Scope.Key)) { return false; }
		if (Scope.bPH || Scope.Key == "pH") { return std::fabs(Expected - Actual) <= 1e-6; }
		const bool bMol = Scope.bMolar || Scope.Key == "extent" || Scope.Key == "mol" || Scope.Key == "molarity";
		const double Floor = bMol ? 1e-12 : 1e-9;
		return std::fabs(Expected - Actual) <= Rel * JsMax(std::fabs(Expected), std::fabs(Actual)) + Floor;
	}

	/** /^#[0-9a-f]{6}$/ */
	bool IsHexColor(std::string_view Text)
	{
		if (Text.size() != 7 || Text[0] != '#') { return false; }
		for (size_t Index = 1; Index < 7; ++Index)
		{
			const char C = Text[Index];
			if (!((C >= '0' && C <= '9') || (C >= 'a' && C <= 'f'))) { return false; }
		}
		return true;
	}

	int HexDigit(char C) { return C <= '9' ? C - '0' : C - 'a' + 10; }

	bool SameColor(std::string_view A, std::string_view B)
	{
		for (size_t Index = 1; Index < 7; Index += 2)
		{
			const int ChannelA = HexDigit(A[Index]) * 16 + HexDigit(A[Index + 1]);
			const int ChannelB = HexDigit(B[Index]) * 16 + HexDigit(B[Index + 1]);
			if (std::abs(ChannelA - ChannelB) > 1) { return false; }
		}
		return true;
	}

	/** Recorta un valor largo sin partir un carácter UTF-8. */
	std::string Clip(std::string Text)
	{
		if (Text.size() <= MaxValueChars) { return Text; }
		size_t Cut = MaxValueChars;
		while (Cut > 0 && (static_cast<unsigned char>(Text[Cut]) & 0xC0u) == 0x80u) { --Cut; }
		Text.resize(Cut);
		Text += "\342\200\246";
		return Text;
	}

	/** JSON.stringify(valor); un puntero nulo hace de `undefined`. */
	std::string Show(const FValue* Value)
	{
		return Value == nullptr ? std::string("undefined") : Clip(MiniJson::Describe(*Value));
	}

	std::string JoinKeys(const std::vector<std::string>& Keys)
	{
		std::string Out;
		for (size_t Index = 0; Index < Keys.size(); ++Index)
		{
			if (Index > 0) { Out += ", "; }
			Out += Keys[Index];
		}
		return Out;
	}

	/** String(x?.id) */
	std::string IdOf(const FValue& Item)
	{
		const FValue* Id = Item.Find("id");
		if (Id == nullptr) { return "undefined"; }
		if (Id->IsString()) { return Id->String; }
		return MiniJson::Describe(*Id);
	}

	/**
	 * byId de compare.ts. Allí ordena con localeCompare; aquí por bytes. Da igual: solo hace falta que las
	 * dos listas se ordenen con el mismo criterio para emparejar cada elemento con el de su mismo id.
	 */
	std::vector<const FValue*> SortedById(const FValue& List)
	{
		std::vector<std::pair<std::string, const FValue*>> Keyed;
		Keyed.reserve(List.Items.size());
		for (const FValue& Item : List.Items) { Keyed.emplace_back(IdOf(Item), &Item); }
		std::stable_sort(Keyed.begin(), Keyed.end(),
			[](const std::pair<std::string, const FValue*>& L, const std::pair<std::string, const FValue*>& R) { return L.first < R.first; });
		std::vector<const FValue*> Out;
		Out.reserve(Keyed.size());
		for (const std::pair<std::string, const FValue*>& Entry : Keyed) { Out.push_back(Entry.second); }
		return Out;
	}

	bool SameIds(const FValue& Expected, const FValue& Actual)
	{
		for (size_t Index = 0; Index < Expected.Items.size(); ++Index)
		{
			if (IdOf(Expected.Items[Index]) != IdOf(Actual.Items[Index])) { return false; }
		}
		return true;
	}

	/**
	 * Índice del primer elemento mal colocado de una lista ordenada de mayor a menor por RankKey, o el tamaño
	 * si está bien. A igualdad exacta manda el orden de las especies, que es lo que da el orden estable.
	 */
	size_t FirstOutOfOrder(const FValue& List, const char* RankKey)
	{
		for (size_t Index = 1; Index < List.Items.size(); ++Index)
		{
			const FValue* Previous = List.Items[Index - 1].Find(RankKey);
			const FValue* Current = List.Items[Index].Find(RankKey);
			if (Previous == nullptr || Current == nullptr || !Previous->IsNumber() || !Current->IsNumber()) { return Index; }
			if (Previous->Number > Current->Number) { continue; }
			const bool bTieInSpeciesOrder = Previous->Number == Current->Number
				&& FindSpecies(IdOf(List.Items[Index - 1])) < FindSpecies(IdOf(List.Items[Index]));
			if (!bTieInSpeciesOrder) { return Index; }
		}
		return List.Items.size();
	}

	/**
	 * walk() de compare.ts. Un puntero nulo es `undefined`. Path se alarga y se recorta al volver para no
	 * crear una cadena por nodo. Añadido respecto a compare.ts: un número obtenido no finito siempre es una
	 * diferencia (allí Infinity pasaría la tolerancia relativa; build.ts lo impide con assertFinite).
	 */
	void Walk(const FValue* Expected, const FValue* Actual, const FScope& Scope, std::string& Path, std::vector<std::string>& Out)
	{
		if (Out.size() >= MaxDiffsPerWalk) { return; }
		const bool bBoth = Expected != nullptr && Actual != nullptr;
		if (bBoth && Expected->IsNumber() && Actual->IsNumber())
		{
			if (!std::isfinite(Actual->Number) || !SameNumber(Expected->Number, Actual->Number, Scope))
			{
				Out.push_back(Path + ": " + MiniJson::NumberToString(Expected->Number) + " frente a " + MiniJson::NumberToString(Actual->Number));
			}
			return;
		}
		if (bBoth && Expected->IsString() && Actual->IsString())
		{
			if (Expected->String != Actual->String && !(IsHexColor(Expected->String) && IsHexColor(Actual->String) && SameColor(Expected->String, Actual->String)))
			{
				Out.push_back(Path + ": " + Show(Expected) + " frente a " + Show(Actual));
			}
			return;
		}
		if (bBoth && Expected->IsArray() && Actual->IsArray())
		{
			if (Expected->Items.size() != Actual->Items.size())
			{
				Out.push_back(Path + ": " + std::to_string(Expected->Items.size()) + " elementos frente a " + std::to_string(Actual->Items.size()));
				return;
			}
			// Sólidos y disueltos van de mayor a menor. Dos valores que empatan dentro de la tolerancia pueden salir
			// en otro orden que en los vectores (cambia el último bit de log/exp/pow): vale si la lista obtenida
			// está bien ordenada y cada elemento coincide con el de su mismo id.
			const char* RankKey = Scope.Key == "solids" ? "grams" : Scope.Key == "dissolved" ? "molarity" : nullptr;
			const bool bUnordered = RankKey != nullptr && !SameIds(*Expected, *Actual);
			std::vector<const FValue*> SortedExpected, SortedActual;
			if (bUnordered)
			{
				const size_t Bad = FirstOutOfOrder(*Actual, RankKey);
				if (Bad < Actual->Items.size())
				{
					Out.push_back(Path + "[" + std::to_string(Bad) + "]: fuera de orden");
					return;
				}
				SortedExpected = SortedById(*Expected);
				SortedActual = SortedById(*Actual);
			}
			const size_t PathLength = Path.size();
			for (size_t Index = 0; Index < Expected->Items.size(); ++Index)
			{
				Path += "[" + std::to_string(Index) + "]";
				Walk(bUnordered ? SortedExpected[Index] : &Expected->Items[Index], bUnordered ? SortedActual[Index] : &Actual->Items[Index], Scope, Path, Out);
				Path.resize(PathLength);
			}
			return;
		}
		if (bBoth && Expected->IsObject() && Actual->IsObject())
		{
			if (Expected->Keys != Actual->Keys)
			{
				Out.push_back(Path + ": claves [" + JoinKeys(Expected->Keys) + "] frente a [" + JoinKeys(Actual->Keys) + "]");
				return;
			}
			const size_t PathLength = Path.size();
			for (size_t Index = 0; Index < Expected->Keys.size(); ++Index)
			{
				const std::string& Key = Expected->Keys[Index];
				if (Contains(Scope.Skip, Key)) { continue; }
				FScope Child = Scope;
				Child.Key = Key;
				Child.bMolar = Scope.bMolar || Key == "n" || Key == "released";
				Path += ".";
				Path += Key;
				Walk(&Expected->Items[Index], &Actual->Items[Index], Child, Path, Out);
				Path.resize(PathLength);
			}
			return;
		}
		// e !== a para lo que queda: undefined, null, booleanos y tipos distintos.
		bool bSame = false;
		if (Expected == nullptr || Actual == nullptr) { bSame = Expected == Actual; }
		else if (Expected->Type != Actual->Type) { bSame = false; }
		else if (Expected->IsNull()) { bSame = true; }
		else if (Expected->IsBool()) { bSame = Expected->bValue == Actual->bValue; }
		if (!bSame) { Out.push_back(Path + ": " + Show(Expected) + " frente a " + Show(Actual)); }
	}

	// ---------------------------------------------------------------- harness.ts: resultados en forma JSON

	const char* const GasIds[3] = { "CO2", "H2", "O2" };

	FValue Num(double Value) { return FValue::MakeNumber(Value); }
	FValue Str(std::string_view Text) { return FValue::MakeString(Text); }
	FValue OptNum(const std::optional<double>& Value) { return Value.has_value() ? FValue::MakeNumber(*Value) : FValue::MakeNull(); }
	/** Las tablas usan nullptr para «sin texto». */
	std::string_view ViewOf(const char* Chars) { return Chars != nullptr ? std::string_view(Chars) : std::string_view(); }

	std::string SpeciesId(int Index)
	{
		const std::vector<FSpecies>& Table = GetSpecies();
		if (Index < 0 || static_cast<size_t>(Index) >= Table.size()) { return "especie#" + std::to_string(Index); }
		return Table[static_cast<size_t>(Index)].Id;
	}

	std::string RuleId(int Index)
	{
		const std::vector<FRule>& Table = GetRules();
		if (Index < 0 || static_cast<size_t>(Index) >= Table.size()) { return "regla#" + std::to_string(Index); }
		return Table[static_cast<size_t>(Index)].Id;
	}

	std::string GasId(EGas Gas)
	{
		const int Index = static_cast<int>(Gas);
		if (Index < 0 || Index > 2) { return "gas#" + std::to_string(Index); }
		return GasIds[Index];
	}

	const char* ErrorCodeName(EError Code)
	{
		switch (Code)
		{
		case EError::UnknownReagent: return "UNKNOWN_REAGENT";
		case EError::Range: return "RANGE";
		case EError::Overflow: return "OVERFLOW";
		case EError::UnknownElement: return "UNKNOWN_ELEMENT";
		case EError::BadFormula: return "BAD_FORMULA";
		case EError::None: break;
		}
		return "UNEXPECTED";
	}

	FValue CanonError(EError Code, const std::string& Message)
	{
		FValue Out = FValue::MakeObject();
		Out.Set("code", Str(ErrorCodeName(Code)));
		Out.Set("message", Str(Message));
		return Out;
	}

	FValue IdAmountPair(std::string_view Id, double Amount)
	{
		FValue Pair = FValue::MakeArray();
		Pair.Push(Str(Id));
		Pair.Push(Num(Amount));
		return Pair;
	}

	/** canonMixture: n en el orden de GetSpecies() y released en el orden CO2, H2, O2; 0 es «clave ausente». */
	FValue CanonMixture(const FMixture& Mixture)
	{
		FValue Out = FValue::MakeObject();
		FValue N = FValue::MakeArray();
		for (size_t Index = 0; Index < Mixture.N.size(); ++Index)
		{
			if (Mixture.N[Index] != 0.0) { N.Push(IdAmountPair(SpeciesId(static_cast<int>(Index)), Mixture.N[Index])); }
		}
		Out.Set("n", std::move(N));
		Out.Set("waterMl", Num(Mixture.WaterMl));
		Out.Set("temperatureC", Num(Mixture.TemperatureC));
		FValue Indicators = FValue::MakeArray();
		for (const std::string& Indicator : Mixture.Indicators) { Indicators.Push(Str(Indicator)); }
		Out.Set("indicators", std::move(Indicators));
		FValue Released = FValue::MakeArray();
		for (size_t Index = 0; Index < Mixture.Released.size(); ++Index)
		{
			if (Mixture.Released[Index] != 0.0) { Released.Push(IdAmountPair(GasIds[Index], Mixture.Released[Index])); }
		}
		Out.Set("released", std::move(Released));
		Out.Set("heatUnknown", FValue::MakeBool(Mixture.bHeatUnknown));
		return Out;
	}

	FValue CanonAnalysis(const FMixture& Mixture)
	{
		const FAnalysis Analysis = AnalyzeMixture(Mixture);
		FValue Out = FValue::MakeObject();
		Out.Set("pH", OptNum(Analysis.PH));
		Out.Set("color", Str(Analysis.Color.Color));
		Out.Set("opacity", Num(Analysis.Color.Opacity));
		Out.Set("volumeMl", Num(Analysis.VolumeMl));
		Out.Set("temperatureC", Num(Analysis.TemperatureC));
		Out.Set("ammoniaSmell", FValue::MakeBool(Analysis.bAmmoniaSmell));
		FValue Solids = FValue::MakeArray();
		for (const FSolidInfo& Solid : Analysis.Solids)
		{
			FValue Item = FValue::MakeObject();
			Item.Set("id", Str(SpeciesId(Solid.Species)));
			Item.Set("mol", Num(Solid.Mol));
			Item.Set("grams", Num(Solid.Grams));
			Solids.Push(std::move(Item));
		}
		Out.Set("solids", std::move(Solids));
		FValue Dissolved = FValue::MakeArray();
		for (const FDissolvedInfo& Ion : Analysis.Dissolved)
		{
			FValue Item = FValue::MakeObject();
			Item.Set("id", Str(SpeciesId(Ion.Species)));
			Item.Set("molarity", Num(Ion.Molarity));
			Dissolved.Push(std::move(Item));
		}
		Out.Set("dissolved", std::move(Dissolved));
		FValue Gases = FValue::MakeArray();
		for (const FGasInfo& Gas : Analysis.Gases)
		{
			FValue Item = FValue::MakeObject();
			Item.Set("id", Str(GasId(Gas.Gas)));
			Item.Set("mol", Num(Gas.Mol));
			Item.Set("litres", Num(Gas.Litres));
			Gases.Push(std::move(Item));
		}
		Out.Set("gases", std::move(Gases));
		return Out;
	}

	FValue CanonSpeciesAmount(const FSpeciesAmount& Amount)
	{
		FValue Out = FValue::MakeObject();
		Out.Set("id", Str(SpeciesId(Amount.Species)));
		Out.Set("mol", Num(Amount.Mol));
		return Out;
	}

	FValue CanonEvent(const FEvent& Event)
	{
		FValue Out = FValue::MakeObject();
		Out.Set("rule", Str(RuleId(Event.Rule)));
		Out.Set("kind", Str(Event.Kind));
		Out.Set("extent", Num(Event.Extent));
		Out.Set("deltaH", OptNum(Event.DeltaH));
		Out.Set("heat", OptNum(Event.Heat));
		if (Event.Gas.has_value()) { Out.Set("gas", CanonSpeciesAmount(*Event.Gas)); }
		if (Event.Solid.has_value()) { Out.Set("solid", CanonSpeciesAmount(*Event.Solid)); }
		return Out;
	}

namespace
{
	// ---------------------------------------------------------------- harness.ts: entradas

	/** num(): un número, o uno de los textos "NaN", "Infinity" y "-Infinity". */
	bool ReadNum(const FValue* Value, double& Out)
	{
		if (Value == nullptr) { return false; }
		if (Value->IsNumber()) { Out = Value->Number; return true; }
		if (!Value->IsString()) { return false; }
		if (Value->String == "NaN") { Out = std::numeric_limits<double>::quiet_NaN(); return true; }
		if (Value->String == "Infinity") { Out = std::numeric_limits<double>::infinity(); return true; }
		if (Value->String == "-Infinity") { Out = -std::numeric_limits<double>::infinity(); return true; }
		return false;
	}

	bool ReadString(const FValue* Value, std::string& Out)
	{
		if (Value == nullptr || !Value->IsString()) { return false; }
		Out = Value->String;
		return true;
	}

	/** Mezcla en forma canónica (la de canonMixture) → FMixture, sin pasar por AddReagent. */
	bool ReadMixture(const FValue* Value, FMixture& Out)
	{
		if (Value == nullptr || !Value->IsObject()) { return false; }
		const FValue* N = Value->Find("n");
		const FValue* WaterMl = Value->Find("waterMl");
		const FValue* TemperatureC = Value->Find("temperatureC");
		const FValue* Indicators = Value->Find("indicators");
		const FValue* Released = Value->Find("released");
		const FValue* HeatUnknown = Value->Find("heatUnknown");
		if (N == nullptr || !N->IsArray() || WaterMl == nullptr || !WaterMl->IsNumber() || TemperatureC == nullptr || !TemperatureC->IsNumber()
			|| Indicators == nullptr || !Indicators->IsArray() || Released == nullptr || !Released->IsArray() || HeatUnknown == nullptr || !HeatUnknown->IsBool())
		{
			return false;
		}
		Out = FMixture();
		for (const FValue& Pair : N->Items)
		{
			if (!Pair.IsArray() || Pair.Items.size() != 2 || !Pair.Items[0].IsString() || !Pair.Items[1].IsNumber()) { return false; }
			const int Species = FindSpecies(Pair.Items[0].String);
			if (Species < 0 || Species >= NumSpecies) { return false; }
			Out.N[static_cast<size_t>(Species)] = Pair.Items[1].Number;
		}
		Out.WaterMl = WaterMl->Number;
		Out.TemperatureC = TemperatureC->Number;
		for (const FValue& Indicator : Indicators->Items)
		{
			if (!Indicator.IsString()) { return false; }
			Out.Indicators.push_back(Indicator.String);
		}
		for (const FValue& Pair : Released->Items)
		{
			if (!Pair.IsArray() || Pair.Items.size() != 2 || !Pair.Items[0].IsString() || !Pair.Items[1].IsNumber()) { return false; }
			size_t Gas = 0;
			while (Gas < 3 && Pair.Items[0].String != GasIds[Gas]) { ++Gas; }
			if (Gas == 3) { return false; }
			Out.Released[Gas] = Pair.Items[1].Number;
		}
		Out.bHeatUnknown = HeatUnknown->bValue;
		return true;
	}

	// ---------------------------------------------------------------- Ejecución

	/**
	 * Números que el generador de tablas copia tal cual del JSON (no los calcula el motor): tienen que ser el
	 * mismo double. Con la tolerancia general, el suelo de 1e-9 daría por bueno cualquier Ksp pequeño.
	 * El resto de la fila (ecuación, entalpías, masa molar calculada) sigue la regla general.
	 */
	const FKeyList& TableDataKeys()
	{
		static const FKeyList Keys = {
			"index", "charge", "dHf", "concentration", "components", "min", "max",
			"reactants", "products", "ions", "ksp", "water", "vigor", "VESSEL_ML", "ROOM_C", "DROP_ML" };
		return Keys;
	}

	struct FRun
	{
		FGoldenReport* Report = nullptr;
		size_t MaxFailures = 0;
		/** «regla|kind» → entrada de tables.eventTexts. */
		std::map<std::string, const FValue*> EventTexts;
		/** Textos de evento ya contados como fallo, para no repetirlos en cada paso. */
		std::set<std::string> ReportedTexts;

		void AddLine(const std::string& Line) const
		{
			if (Report->Failures.size() < MaxFailures) { Report->Failures.push_back(Line); }
		}
		void AddTableFailure(const std::string& Line) const
		{
			++Report->TableFailures;
			AddLine(Line);
		}
	};

	/** Title, Note, Equation y Vigor del evento contra tables.eventTexts; los casos solo guardan rule y kind. */
	void CheckEventTexts(const FEvent& Event, FRun& Run)
	{
		const std::string Key = RuleId(Event.Rule) + "|" + Event.Kind;
		const std::map<std::string, const FValue*>::const_iterator Found = Run.EventTexts.find(Key);
		// Sin entrada no hay nada que comparar aquí: rule y kind ya se comparan, exactos, con el caso.
		if (Found == Run.EventTexts.end()) { return; }
		const FValue Actual[4] = { Str(Event.Title), Str(Event.Note), Str(Event.Equation), Num(Event.Vigor) };
		const char* const Fields[4] = { "title", "note", "equation", "vigor" };
		for (size_t Index = 0; Index < 4; ++Index)
		{
			std::string Path = "tables.eventTexts[" + Key + "]." + Fields[Index];
			FScope Scope;
			Scope.Key = Fields[Index];
			Scope.Exact = &TableDataKeys();
			std::vector<std::string> Diffs;
			Walk(Found->second->Find(Fields[Index]), &Actual[Index], Scope, Path, Diffs);
			if (!Diffs.empty() && Run.ReportedTexts.insert(Path).second) { Run.AddTableFailure(Diffs.front()); }
		}
	}

	/** Lo que una marca «umbral-*» permite no comparar en su paso. */
	constexpr std::string_view ThresholdSkips[] = { "events", "note", "solids", "dissolved", "gases", "ammoniaSmell", "color", "opacity" };

	/** runSteps de harness.ts más compareSteps de compare.ts, paso a paso. */
	void RunSequence(const std::string& Id, const FValue& Case, FRun& Run, std::vector<std::string>& Diffs)
	{
		const FValue* Steps = Case.Find("steps");
		if (Steps == nullptr || !Steps->IsArray() || Steps->Items.empty())
		{
			Diffs.push_back(Id + ": la secuencia no tiene pasos");
			return;
		}
		FMixture Mixture = EmptyMixture();
		for (size_t Index = 0; Index < Steps->Items.size(); ++Index)
		{
			const FValue& Step = Steps->Items[Index];
			std::string Path = Id + " paso " + std::to_string(Index + 1);
			const FValue* In = Step.Find("in");
			std::string Reagent;
			double Amount = 0.0;
			if (In == nullptr || !ReadString(In->Find("reagent"), Reagent) || !ReadNum(In->Find("amount"), Amount))
			{
				Diffs.push_back(Path + ".in: entrada no v\303\241lida " + Show(In));
				return;
			}

			FKeyList Flags;
			const FValue* FlagList = Step.Find("flags");
			if (FlagList != nullptr && FlagList->IsArray())
			{
				for (const FValue& Flag : FlagList->Items)
				{
					if (Flag.IsString()) { Flags.push_back(Flag.String); }
				}
			}
			// A un bit del borde del matraz el paso puede aceptarse o rechazarse: desde ahí el caso deja de ser comparable.
			if (Contains(&Flags, "desborde-suma")) { return; }

			FValue Actual = FValue::MakeObject();
			Actual.Set("in", *In);
			TResult<FMixOutcome> Result = AddReagent(Mixture, Reagent, Amount);
			if (Result.bOk)
			{
				// Tras un error la mezcla no cambia; si no, la siguiente adición parte de esta.
				Mixture = Result.Value.Mixture;
				FValue Events = FValue::MakeArray();
				for (const FEvent& Event : Result.Value.Events)
				{
					CheckEventTexts(Event, Run);
					Events.Push(CanonEvent(Event));
				}
				FValue Out = FValue::MakeObject();
				Out.Set("events", std::move(Events));
				Out.Set("note", Str(Result.Value.Note));
				Out.Set("deltaT", Num(Result.Value.DeltaT));
				Out.Set("heatKJ", Num(Result.Value.HeatKJ));
				Out.Set("mixture", CanonMixture(Mixture));
				Out.Set("analysis", CanonAnalysis(Mixture));
				Actual.Set("out", std::move(Out));
			}
			else
			{
				Actual.Set("error", CanonError(Result.Code, Result.Message));
			}
			// Las marcas las calcula harness.ts; aquí solo se copian para que las claves del paso coincidan.
			if (FlagList != nullptr) { Actual.Set("flags", *FlagList); }

			FKeyList Skip = { "flags" };
			bool bThreshold = false;
			for (const std::string_view Flag : Flags)
			{
				if (Flag == "nota-redondeo-ph") { Skip.push_back("note"); }
				else if (Flag == "error-redondeo-ml") { Skip.push_back("message"); }
				if (Flag.substr(0, 7) == "umbral-") { bThreshold = true; }
			}
			if (bThreshold) { Skip.insert(Skip.end(), std::begin(ThresholdSkips), std::end(ThresholdSkips)); }
			FScope Scope;
			Scope.Skip = &Skip;
			Walk(&Step, &Actual, Scope, Path, Diffs);
		}
	}

	FValue CanonReaction(const FReactionResult& R)
	{
		FValue Out = FValue::MakeObject();
		Out.Set("acidMoles", Num(R.AcidMoles));
		Out.Set("bicarbonateMoles", Num(R.BicarbonateMoles));
		Out.Set("co2Moles", Num(R.Co2Moles));
		Out.Set("limiting", Str(R.Limiting));
		Out.Set("acidRemaining", Num(R.AcidRemaining));
		Out.Set("bicarbonateRemaining", Num(R.BicarbonateRemaining));
		Out.Set("co2Litres", Num(R.Co2Litres));
		return Out;
	}

	FValue CanonConductivity(const FConductivityResult& R)
	{
		FValue Out = FValue::MakeObject();
		Out.Set("microSiemens", Num(R.MicroSiemens));
		Out.Set("brightness", Num(R.Brightness));
		Out.Set("ionMolarity", Num(R.IonMolarity));
		return Out;
	}

	FValue CanonCrystallization(const FCrystallizationResult& R)
	{
		FValue Out = FValue::MakeObject();
		Out.Set("initialDissolved", Num(R.InitialDissolved));
		Out.Set("initialSolid", Num(R.InitialSolid));
		Out.Set("remainingWater", Num(R.RemainingWater));
		Out.Set("evaporatedWater", Num(R.EvaporatedWater));
		Out.Set("dissolved", Num(R.Dissolved));
		Out.Set("solid", Num(R.Solid));
		Out.Set("newCrystals", Num(R.NewCrystals));
		return Out;
	}

	/** Salida de una llamada: como mucho uno de los dos tiene valor (ninguno si la entrada no se pudo leer). */
	struct FCallResult
	{
		std::optional<FValue> Out;
		std::optional<FValue> Error;
		bool bBadInput = false;
	};

	template <typename T, typename TCanon>
	void StoreResult(FCallResult& Call, const TResult<T>& Result, TCanon Canon)
	{
		if (Result.bOk) { Call.Out = Canon(Result.Value); }
		else { Call.Error = CanonError(Result.Code, Result.Message); }
	}

	/** El `switch (spec.fn)` de runCase, para todo lo que no es una secuencia. */
	FCallResult CallFunction(std::string_view Fn, const FValue& In)
	{
		FCallResult Call;
		if (Fn == "solvePH")
		{
			FMixture Mixture;
			if (!ReadMixture(In.Find("mixture"), Mixture)) { Call.bBadInput = true; return Call; }
			Call.Out = OptNum(SolvePH(Mixture));
		}
		else if (Fn == "solutionColor")
		{
			FMixture Mixture;
			const FValue* PH = In.Find("pH");
			if (!ReadMixture(In.Find("mixture"), Mixture) || PH == nullptr || !(PH->IsNull() || PH->IsNumber())) { Call.bBadInput = true; return Call; }
			const FSolutionColor Color = SolutionColor(Mixture, PH->IsNull() ? std::optional<double>() : std::optional<double>(PH->Number));
			FValue Out = FValue::MakeObject();
			Out.Set("color", Str(Color.Color));
			Out.Set("opacity", Num(Color.Opacity));
			Call.Out = std::move(Out);
		}
		else if (Fn == "indicatorColor")
		{
			std::string Indicator;
			double PH = 0.0;
			if (!ReadString(In.Find("indicator"), Indicator) || !ReadNum(In.Find("pH"), PH)) { Call.bBadInput = true; return Call; }
			const std::optional<FIndicatorColor> Color = IndicatorColor(Indicator, PH);
			if (Color.has_value())
			{
				FValue Out = FValue::MakeObject();
				Out.Set("color", Str(Color->Color));
				Out.Set("strength", Num(Color->Strength));
				Call.Out = std::move(Out);
			}
			else
			{
				Call.Out = FValue::MakeNull();
			}
		}
		else if (Fn == "molarMass")
		{
			std::string Formula;
			if (!ReadString(In.Find("formula"), Formula)) { Call.bBadInput = true; return Call; }
			StoreResult(Call, MolarMass(Formula), Num);
		}
		else if (Fn == "gasLitres")
		{
			double Mol = 0.0;
			if (!ReadNum(In.Find("mol"), Mol)) { Call.bBadInput = true; return Call; }
			Call.Out = Num(GasLitres(Mol));
		}
		else if (Fn == "calculateReaction")
		{
			double VinegarMl = 0.0, Concentration = 0.0, BicarbonateG = 0.0;
			if (!ReadNum(In.Find("vinegarMl"), VinegarMl) || !ReadNum(In.Find("concentration"), Concentration) || !ReadNum(In.Find("bicarbonateG"), BicarbonateG)) { Call.bBadInput = true; return Call; }
			StoreResult(Call, CalculateReaction(VinegarMl, Concentration, BicarbonateG), CanonReaction);
		}
		else if (Fn == "conductivity")
		{
			std::string Solution;
			double Concentration = 0.0;
			if (!ReadString(In.Find("solution"), Solution) || !ReadNum(In.Find("concentration"), Concentration)) { Call.bBadInput = true; return Call; }
			StoreResult(Call, Conductivity(Solution, Concentration), CanonConductivity);
		}
		else if (Fn == "crystallization")
		{
			double WaterG = 0.0, SaltG = 0.0, EvaporationPercent = 0.0;
			if (!ReadNum(In.Find("waterG"), WaterG) || !ReadNum(In.Find("saltG"), SaltG) || !ReadNum(In.Find("evaporationPercent"), EvaporationPercent)) { Call.bBadInput = true; return Call; }
			StoreResult(Call, Crystallization(WaterG, SaltG, EvaporationPercent), CanonCrystallization);
		}
		else
		{
			Call.bBadInput = true;
		}
		return Call;
	}

	void RunCall(const std::string& Id, std::string_view Fn, const FValue& Case, std::vector<std::string>& Diffs)
	{
		const FValue* In = Case.Find("in");
		if (In == nullptr || !In->IsObject())
		{
			Diffs.push_back(Id + ".in: falta la entrada");
			return;
		}
		const FCallResult Call = CallFunction(Fn, *In);
		if (Call.bBadInput)
		{
			Diffs.push_back(Id + ".in: funci\303\263n desconocida o entrada no v\303\241lida para \302\253" + std::string(Fn) + "\302\273: " + Show(In));
			return;
		}
		// compare.ts recorre { in, error } y después la salida. «in» es el mismo objeto en los dos lados: no hay nada que comparar.
		{
			std::string Path = Id + ".error";
			FScope Scope;
			Scope.Key = "error";
			Walk(Case.Find("error"), Call.Error.has_value() ? &*Call.Error : nullptr, Scope, Path, Diffs);
		}
		{
			std::string Path = Id + ".out";
			FScope Scope;
			// La salida de solvePH es un pH: se compara solo en absoluto.
			Scope.bPH = Fn == "solvePH";
			Walk(Case.Find("out"), Call.Out.has_value() ? &*Call.Out : nullptr, Scope, Path, Diffs);
		}
	}

	// ---------------------------------------------------------------- Tablas

	FValue CanonTerms(const std::vector<FTerm>& Terms)
	{
		FValue Out = FValue::MakeArray();
		for (const FTerm& Term : Terms) { Out.Push(IdAmountPair(SpeciesId(Term.Species), Term.Amount)); }
		return Out;
	}

	/** Recorre una fila de tabla y cuenta cada diferencia como fallo de tabla. */
	void CheckRow(const FValue* Expected, const FValue& Actual, std::string Path, FRun& Run)
	{
		std::vector<std::string> Diffs;
		FScope Scope;
		Scope.Exact = &TableDataKeys();
		Walk(Expected, &Actual, Scope, Path, Diffs);
		for (const std::string& Diff : Diffs) { Run.AddTableFailure(Diff); }
	}

	/** Solo las claves pedidas, en ese orden y si existen: las tablas JSON llevan más datos que las de C++. */
	FValue Pick(const FValue& Source, std::initializer_list<const char*> Keys)
	{
		FValue Out = FValue::MakeObject();
		for (const char* Key : Keys)
		{
			const FValue* Value = Source.Find(Key);
			if (Value != nullptr) { Out.Set(Key, *Value); }
		}
		return Out;
	}

	/** Una regla con la forma de tables.rules (golden/lib/tables.ts), calculando ecuación y entalpías con el motor. */
	FValue CanonRule(const FRule& Rule, size_t Index)
	{
		FValue Out = FValue::MakeObject();
		Out.Set("index", Num(static_cast<double>(Index)));
		Out.Set("id", Str(ViewOf(Rule.Id)));
		if (Rule.Type == ERuleType::Complete)
		{
			Out.Set("type", Str("complete"));
			Out.Set("kind", Str(ViewOf(Rule.Kind)));
			Out.Set("reactants", CanonTerms(Rule.Reactants));
			Out.Set("products", CanonTerms(Rule.Products));
			FValue Catalysts = FValue::MakeArray();
			for (const int Catalyst : Rule.Catalysts) { Catalysts.Push(Str(SpeciesId(Catalyst))); }
			Out.Set("catalysts", std::move(Catalysts));
			Out.Set("vigor", Num(Rule.Vigor));
			Out.Set("title", Str(ViewOf(Rule.Title)));
			Out.Set("note", Str(ViewOf(Rule.Note)));
			Out.Set("equation", Str(EquationText(Rule.Reactants, Rule.Products)));
			Out.Set("deltaH", OptNum(ReactionEnthalpy(Rule.Reactants, Rule.Products)));
			return Out;
		}
		const int Water = FindSpecies("H2O");
		double WaterAmount = 0.0;
		for (const FTerm& Term : Rule.Products)
		{
			if (Term.Species == Water) { WaterAmount = Term.Amount; }
		}
		Out.Set("type", Str("solubility"));
		Out.Set("solid", Str(SpeciesId(Rule.Solid)));
		Out.Set("ions", CanonTerms(Rule.Reactants));
		Out.Set("ksp", Num(Rule.Ksp));
		Out.Set("water", Num(WaterAmount));
		Out.Set("vigor", Num(Rule.Vigor));
		Out.Set("note", Str(ViewOf(Rule.Note)));
		Out.Set("reactants", CanonTerms(Rule.Reactants));
		Out.Set("products", CanonTerms(Rule.Products));
		// La entalpía se suma en el sentido real del evento: el inverso no siempre es el opuesto exacto.
		Out.Set("deltaHPrecipitation", OptNum(ReactionEnthalpy(Rule.Reactants, Rule.Products)));
		Out.Set("deltaHDissolution", OptNum(ReactionEnthalpy(Rule.Products, Rule.Reactants)));
		return Out;
	}

	const char* PhaseName(EPhase Phase)
	{
		switch (Phase)
		{
		case EPhase::Aq: return "aq";
		case EPhase::S: return "s";
		case EPhase::L: return "l";
		case EPhase::G: return "g";
		}
		return "?";
	}

	/** Una especie con la forma de tables.species; molarMass sale de MolarMass(formula), como en tables.ts. */
	FValue CanonSpecies(const FSpecies& Species)
	{
		FValue Out = FValue::MakeObject();
		Out.Set("id", Str(ViewOf(Species.Id)));
		Out.Set("label", Str(ViewOf(Species.Label)));
		Out.Set("formula", Str(ViewOf(Species.Formula)));
		Out.Set("charge", Num(static_cast<double>(Species.Charge)));
		Out.Set("phase", Str(PhaseName(Species.Phase)));
		Out.Set("dHf", Species.bHasDHf ? Num(Species.DHf) : FValue::MakeNull());
		Out.Set("name", Str(ViewOf(Species.Name)));
		if (Species.Color != nullptr) { Out.Set("color", Str(Species.Color)); }
		if (Species.ColorName != nullptr) { Out.Set("colorName", Str(Species.ColorName)); }
		const TResult<double> Mass = MolarMass(ViewOf(Species.Formula));
		Out.Set("molarMass", Mass.bOk ? Num(Mass.Value) : CanonError(Mass.Code, Mass.Message));
		return Out;
	}

	/** Lo que C++ guarda de un reactivo, con la forma (parcial) de tables.reagents. */
	FValue CanonReagent(const FReagent& Reagent)
	{
		FValue Out = FValue::MakeObject();
		Out.Set("id", Str(ViewOf(Reagent.Id)));
		Out.Set("name", Str(ViewOf(Reagent.Name)));
		switch (Reagent.Kind)
		{
		case EReagentKind::Water:
			Out.Set("kind", Str("water"));
			break;
		case EReagentKind::Solution:
			Out.Set("kind", Str("solution"));
			Out.Set("concentration", Num(Reagent.Concentration));
			Out.Set("components", CanonTerms(Reagent.Components));
			break;
		case EReagentKind::Solid:
			Out.Set("kind", Str("solid"));
			Out.Set("species", Str(SpeciesId(Reagent.Species)));
			break;
		case EReagentKind::Indicator:
			Out.Set("kind", Str("indicator"));
			Out.Set("indicator", Str(ViewOf(Reagent.Indicator)));
			break;
		}
		FValue Range = FValue::MakeObject();
		Range.Set("min", Num(Reagent.Min));
		Range.Set("max", Num(Reagent.Max));
		Range.Set("unit", Str(ViewOf(Reagent.Unit)));
		Out.Set("range", std::move(Range));
		return Out;
	}

	/** Devuelve la lista `Name` de tables, o nullptr (y un fallo de tabla) si falta o su tamaño no es el de C++. */
	const FValue* TableRows(const FValue& Tables, const char* Name, size_t NativeCount, FRun& Run)
	{
		const FValue* Rows = Tables.Find(Name);
		if (Rows == nullptr || !Rows->IsArray())
		{
			Run.AddTableFailure(std::string("tables.") + Name + ": falta la tabla");
			return nullptr;
		}
		if (Rows->Items.size() != NativeCount)
		{
			Run.AddTableFailure(std::string("tables.") + Name + ": " + std::to_string(Rows->Items.size()) + " elementos frente a " + std::to_string(NativeCount));
			return nullptr;
		}
		return Rows;
	}

	/**
	 * La parte de `walk(expected.tables, actual.tables)` que C++ puede reconstruir: las tablas generadas
	 * siguen al JSON, y EquationText, ReactionEnthalpy y MolarMass dan lo mismo que en TypeScript.
	 */
	void CheckTables(const FValue& Tables, FRun& Run)
	{
		const FValue* Constants = Tables.Find("constants");
		if (Constants != nullptr && Constants->IsObject())
		{
			FValue Actual = FValue::MakeObject();
			Actual.Set("VESSEL_ML", Num(VesselMl));
			Actual.Set("ROOM_C", Num(RoomC));
			Actual.Set("DROP_ML", Num(DropMl));
			Actual.Set("GAS_L_PER_MOL", Num(GasLitres(1.0)));
			const FValue Expected = Pick(*Constants, { "VESSEL_ML", "ROOM_C", "DROP_ML", "GAS_L_PER_MOL" });
			CheckRow(&Expected, Actual, "tables.constants", Run);
		}
		else
		{
			Run.AddTableFailure("tables.constants: falta la tabla");
		}

		const std::vector<FSpecies>& Species = GetSpecies();
		if (Species.size() != static_cast<size_t>(NumSpecies))
		{
			Run.AddTableFailure("GetSpecies(): " + std::to_string(Species.size()) + " especies frente a NumSpecies = " + std::to_string(NumSpecies));
		}
		if (const FValue* Rows = TableRows(Tables, "species", Species.size(), Run))
		{
			for (size_t Index = 0; Index < Species.size(); ++Index)
			{
				const std::string Path = "tables.species[" + std::to_string(Index) + "]";
				CheckRow(&Rows->Items[Index], CanonSpecies(Species[Index]), Path, Run);
				// El valor guardado en la tabla generada debe ser el mismo double, no solo uno cercano.
				const FValue* Mass = Rows->Items[Index].Find("molarMass");
				if (Mass != nullptr && Mass->IsNumber() && Mass->Number != Species[Index].MolarMass)
				{
					Run.AddTableFailure(Path + ".molarMass (tabla generada): " + MiniJson::NumberToString(Mass->Number) + " frente a " + MiniJson::NumberToString(Species[Index].MolarMass));
				}
			}
		}

		const std::vector<FReagent>& Reagents = GetReagents();
		if (const FValue* Rows = TableRows(Tables, "reagents", Reagents.size(), Run))
		{
			for (size_t Index = 0; Index < Reagents.size(); ++Index)
			{
				FValue Expected = Pick(Rows->Items[Index], { "id", "name", "kind", "concentration", "components", "species", "indicator" });
				const FValue* Range = Rows->Items[Index].Find("range");
				if (Range != nullptr) { Expected.Set("range", Pick(*Range, { "min", "max", "unit" })); }
				CheckRow(&Expected, CanonReagent(Reagents[Index]), "tables.reagents[" + std::to_string(Index) + "]", Run);
			}
		}

		const std::vector<FRule>& Rules = GetRules();
		if (const FValue* Rows = TableRows(Tables, "rules", Rules.size(), Run))
		{
			for (size_t Index = 0; Index < Rules.size(); ++Index)
			{
				CheckRow(&Rows->Items[Index], CanonRule(Rules[Index], Index), "tables.rules[" + std::to_string(Index) + "]", Run);
			}
		}

		const FValue* EventTexts = Tables.Find("eventTexts");
		if (EventTexts == nullptr || !EventTexts->IsArray())
		{
			Run.AddTableFailure("tables.eventTexts: falta la tabla");
			return;
		}
		for (const FValue& Entry : EventTexts->Items)
		{
			std::string Rule, Kind;
			if (ReadString(Entry.Find("rule"), Rule) && ReadString(Entry.Find("kind"), Kind)) { Run.EventTexts[Rule + "|" + Kind] = &Entry; }
		}
	}

	FGoldenFamily& FamilyOf(FGoldenReport& Report, const std::string& Name)
	{
		for (FGoldenFamily& Family : Report.Families)
		{
			if (Family.Name == Name) { return Family; }
		}
		Report.Families.emplace_back();
		Report.Families.back().Name = Name;
		return Report.Families.back();
	}

	void RunCase(const FValue& Case, size_t Index, FRun& Run)
	{
		std::string Id, Fn, Family;
		std::vector<std::string> Diffs;
		if (!ReadString(Case.Find("id"), Id)) { Id = "cases[" + std::to_string(Index) + "]"; }
		// La familia es lo que va antes de la primera barra del id, como en build.ts.
		if (!ReadString(Case.Find("family"), Family)) { Family = Id.substr(0, Id.find('/')); }
		if (!ReadString(Case.Find("fn"), Fn)) { Diffs.push_back(Id + ": el caso no dice qu\303\251 funci\303\263n ejecutar"); }
		else if (Fn == "sequence") { RunSequence(Id, Case, Run, Diffs); }
		else { RunCall(Id, Fn, Case, Diffs); }

		FGoldenReport& Report = *Run.Report;
		// La referencia se toma después de ejecutar el caso: nada más añade familias entre medias.
		FGoldenFamily& Stats = FamilyOf(Report, Family);
		++Report.Cases;
		++Stats.Cases;
		if (Diffs.empty())
		{
			++Report.Passed;
			++Stats.Passed;
		}
		for (const std::string& Diff : Diffs) { Run.AddLine(Diff); }
	}
}
}

	FGoldenReport RunGolden(std::string_view JsonText, int MaxFailures)
	{
		FGoldenReport Report;
		const MiniJson::FParseResult Parsed = MiniJson::Parse(JsonText);
		if (!Parsed.bOk)
		{
			Report.Error = Parsed.Error;
			return Report;
		}
		const MiniJson::FValue* Version = Parsed.Root.Find("schemaVersion");
		const MiniJson::FValue* Tables = Parsed.Root.Find("tables");
		const MiniJson::FValue* Cases = Parsed.Root.Find("cases");
		if (Tables == nullptr || !Tables->IsObject() || Cases == nullptr || !Cases->IsArray())
		{
			Report.Error = "El JSON no tiene la forma de golden/chemistry.json: faltan \302\253tables\302\273 o \302\253cases\302\273.";
			return Report;
		}
		if (Version == nullptr || !Version->IsNumber() || Version->Number != 1.0)
		{
			Report.Error = "Versi\303\263n de esquema no admitida: este ejecutor lee schemaVersion 1.";
			return Report;
		}
		Report.bParsed = true;

		GoldenImpl::FRun Run;
		Run.Report = &Report;
		Run.MaxFailures = MaxFailures > 0 ? static_cast<size_t>(MaxFailures) : 0;
		GoldenImpl::CheckTables(*Tables, Run);
		for (size_t Index = 0; Index < Cases->Items.size(); ++Index)
		{
			GoldenImpl::RunCase(Cases->Items[Index], Index, Run);
		}
		return Report;
	}
}
