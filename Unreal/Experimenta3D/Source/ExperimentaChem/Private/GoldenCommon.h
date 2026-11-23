// Piezas de Golden.cpp que comparte HoodGolden.cpp: el comparador walk() de golden/lib/compare.ts y las
// formas canónicas de golden/lib/harness.ts (canonMixture, canonAnalysis, canonEvent). Se definen en Golden.cpp.
#pragma once

#include <optional>
#include <string>
#include <string_view>
#include <vector>

#include "ExperimentaChem/Chem.h"
#include "MiniJson.h"

namespace ExperimentaChem
{
namespace GoldenImpl
{
	using FValue = MiniJson::FValue;
	using EType = MiniJson::EType;
	using FKeyList = std::vector<std::string_view>;

	struct FScope
	{
		std::string_view Key;
		bool bMolar = false;
		bool bPH = false;
		const FKeyList* Skip = nullptr;
		/** Claves cuyos números deben ser el mismo double, sin tolerancia. */
		const FKeyList* Exact = nullptr;
	};

	/** walk() de compare.ts. Un puntero nulo es `undefined`. Añade a Out como mucho 20 diferencias. */
	void Walk(const FValue* Expected, const FValue* Actual, const FScope& Scope, std::string& Path, std::vector<std::string>& Out);

	FValue Num(double Value);
	FValue Str(std::string_view Text);
	FValue OptNum(const std::optional<double>& Value);
	std::string_view ViewOf(const char* Chars);
	std::string SpeciesId(int Index);
	std::string RuleId(int Index);
	FValue IdAmountPair(std::string_view Id, double Amount);

	FValue CanonMixture(const FMixture& Mixture);
	FValue CanonAnalysis(const FMixture& Mixture);
	FValue CanonEvent(const FEvent& Event);
}
}
