#include "ExperimentaChem/Chem.h"

#include <cstdlib>

// IEEE estricto aunque el módulo se compile sin FPSemanticsMode.Precise (ver Sandbox.cpp): con /fp:fast el compilador
// reagrupa las operaciones y los resultados dejan de coincidir en bits con el TypeScript.
#if defined(_MSC_VER)
#pragma float_control(precise, on, push)
#endif

// Porte de src/chemistry/formula.ts.
namespace ExperimentaChem
{
	namespace FormulaDetail
	{
		struct FAtomicWeight { const char* Symbol; double Weight; };

		/** Pesos atómicos estándar (IUPAC, abreviados) de los elementos que usa la campana. */
		constexpr FAtomicWeight AtomicWeights[] = {
			{ "H", 1.008 }, { "C", 12.011 }, { "N", 14.007 }, { "O", 15.999 }, { "Na", 22.99 }, { "Mg", 24.305 },
			{ "S", 32.06 }, { "Cl", 35.45 }, { "K", 39.098 }, { "Ca", 40.078 }, { "Mn", 54.938 }, { "Fe", 55.845 },
			{ "Cu", 63.546 }, { "Zn", 65.38 }, { "Ag", 107.868 }, { "I", 126.904 }, { "Ba", 137.327 }, { "Pb", 207.2 },
		};

		static bool IsUpper(char Char) { return Char >= 'A' && Char <= 'Z'; }
		static bool IsLower(char Char) { return Char >= 'a' && Char <= 'z'; }
		static bool IsDigit(char Char) { return Char >= '0' && Char <= '9'; }

		/** Avanza sobre \d* y devuelve el final de la racha de dígitos ASCII. */
		static size_t SkipDigits(std::string_view Text, size_t Index)
		{
			while (Index < Text.size() && IsDigit(Text[Index])) { ++Index; }
			return Index;
		}

		/** `match ? Number(match) : 1`: el subíndice se lee como double, así que veinte nueves dan 1e20. */
		static double Subscript(std::string_view Digits)
		{
			if (Digits.empty()) { return 1.0; }
			const std::string Text(Digits);
			return std::strtod(Text.c_str(), nullptr);
		}

		static TResult<double> BadFormula(std::string_view Formula)
		{
			return TResult<double>::Fail(EError::BadFormula, "F\303\263rmula no v\303\241lida: " + std::string(Formula));
		}
	}

	TResult<double> MolarMass(std::string_view Formula)
	{
		using namespace FormulaDetail;

		// Equivale a pattern.exec() en bucle con /([A-Z][a-z]?)(\d*)|(\()|(\))(\d*)/g: los caracteres que no casan
		// se saltan sin error y solo al final se compara lo consumido con la longitud. JavaScript cuenta unidades
		// UTF-16 y aquí bytes UTF-8, pero el resultado es el mismo: ningún byte de un carácter no ASCII casa, así
		// que en ambos casos lo consumido iguala a la longitud solo si se consumió la cadena entera.
		std::vector<double> Stack{ 0.0 };
		const size_t Length = Formula.size();
		size_t Consumed = 0;
		size_t Index = 0;
		while (Index < Length)
		{
			const char Char = Formula[Index];
			if (IsUpper(Char))
			{
				const size_t SymbolEnd = Index + 1 < Length && IsLower(Formula[Index + 1]) ? Index + 2 : Index + 1;
				const size_t End = SkipDigits(Formula, SymbolEnd);
				Consumed += End - Index;
				const std::string_view Symbol = Formula.substr(Index, SymbolEnd - Index);
				const FAtomicWeight* Found = nullptr;
				for (const FAtomicWeight& Entry : AtomicWeights)
				{
					if (Symbol == Entry.Symbol) { Found = &Entry; break; }
				}
				if (!Found) { return TResult<double>::Fail(EError::UnknownElement, "Elemento desconocido: " + std::string(Symbol)); }
				Stack.back() += Found->Weight * Subscript(Formula.substr(SymbolEnd, End - SymbolEnd));
				Index = End;
			}
			else if (Char == '(')
			{
				Consumed += 1;
				Stack.push_back(0.0);
				++Index;
			}
			else if (Char == ')')
			{
				const size_t End = SkipDigits(Formula, Index + 1);
				Consumed += End - Index;
				if (Stack.size() < 2) { return BadFormula(Formula); }
				const double Group = Stack.back();
				Stack.pop_back();
				Stack.back() += Group * Subscript(Formula.substr(Index + 1, End - (Index + 1)));
				Index = End;
			}
			else
			{
				++Index;
			}
		}
		if (Consumed != Length || Stack.size() != 1 || Formula.empty()) { return BadFormula(Formula); }
		return TResult<double>::Ok(Stack[0]);
	}
}

#if defined(_MSC_VER)
#pragma float_control(pop)
#endif
