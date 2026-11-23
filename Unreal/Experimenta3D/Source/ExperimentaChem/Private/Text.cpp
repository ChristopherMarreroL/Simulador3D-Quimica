#include "ExperimentaChem/Chem.h"

#include <algorithm>
#include <charconv>
#include <cmath>

// IEEE estricto aunque el módulo se compile sin FPSemanticsMode.Precise (ver Sandbox.cpp): con /fp:fast el compilador
// reagrupa las operaciones y los resultados dejan de coincidir en bits con el TypeScript.
#if defined(_MSC_VER)
#pragma float_control(precise, on, push)
#endif

// Equivalentes a Number.prototype.toLocaleString('es', { maximumFractionDigits }) y Math.round.
namespace ExperimentaChem
{
	namespace TextDetail
	{
		/** Suma una unidad en la última cifra; devuelve true si el acarreo sale por delante (9,99 → 10,0). */
		static bool IncrementDigits(std::string& Digits)
		{
			for (size_t Index = Digits.size(); Index > 0; --Index)
			{
				if (Digits[Index - 1] != '9') { ++Digits[Index - 1]; return false; }
				Digits[Index - 1] = '0';
			}
			Digits.insert(Digits.begin(), '1');
			return true;
		}
	}

	std::string FormatEs(double Value, int MaxFractionDigits)
	{
		if (std::isnan(Value)) { return "NaN"; }
		// JavaScript conserva el signo aunque el resultado redondee a cero: (-0.04) → «-0».
		std::string Out = std::signbit(Value) ? "-" : "";
		if (std::isinf(Value)) { return Out + "\342\210\236"; }
		// Intl solo admite de 0 a 100 decimales (fuera de ese rango lanza RangeError); aquí se acota.
		const int MaxDigits = (std::max)(0, (std::min)(MaxFractionDigits, 100));

		// ICU no redondea el valor binario exacto del double, sino su decimal más corto que lo recupera
		// (el mismo que imprime String(x)): por eso 0,15 → «0,2» y 1,005 → «1,01» con 1 y 2 decimales.
		// to_chars sin precisión da justo esas cifras: «d.ddde±XX».
		char Buffer[48];
		const std::to_chars_result Converted = std::to_chars(Buffer, Buffer + sizeof(Buffer), std::fabs(Value), std::chars_format::scientific);
		std::string Digits;
		int Exponent = 0;
		{
			const char* Cursor = Buffer;
			for (; Cursor != Converted.ptr && *Cursor != 'e'; ++Cursor)
			{
				if (*Cursor != '.') { Digits.push_back(*Cursor); }
			}
			bool bNegativeExponent = false;
			for (; Cursor != Converted.ptr; ++Cursor)
			{
				if (*Cursor == '-') { bNegativeExponent = true; }
				else if (*Cursor >= '0' && *Cursor <= '9') { Exponent = Exponent * 10 + (*Cursor - '0'); }
			}
			if (bNegativeExponent) { Exponent = -Exponent; }
		}

		// El valor es 0,Digits × 10^Point. Se conservan las cifras hasta MaxDigits decimales.
		int Point = Exponent + 1;
		const int Keep = Point + MaxDigits;
		if (Keep < 0) { Digits.clear(); }
		else if (Keep < static_cast<int>(Digits.size()))
		{
			// «halfExpand»: la mitad se aleja de cero, así que basta mirar la primera cifra descartada.
			const bool bRoundUp = Digits[static_cast<size_t>(Keep)] >= '5';
			Digits.resize(static_cast<size_t>(Keep));
			if (bRoundUp && TextDetail::IncrementDigits(Digits)) { ++Point; }
		}

		std::string Integer;
		std::string Fraction;
		if (!Digits.empty())
		{
			const int Count = static_cast<int>(Digits.size());
			if (Point > 0)
			{
				Integer = Digits.substr(0, static_cast<size_t>((std::min)(Point, Count)));
				if (Point > Count) { Integer.append(static_cast<size_t>(Point - Count), '0'); }
				if (Point < Count) { Fraction = Digits.substr(static_cast<size_t>(Point)); }
			}
			else
			{
				Fraction.assign(static_cast<size_t>(-Point), '0');
				Fraction += Digits;
			}
			while (!Fraction.empty() && Fraction.back() == '0') { Fraction.pop_back(); }
		}
		if (Integer.empty()) { Integer = "0"; }

		// En «es» el punto de millar solo aparece a partir de cinco cifras enteras (1234 pero 10.000).
		const size_t IntegerDigits = Integer.size();
		for (size_t Index = 0; Index < IntegerDigits; ++Index)
		{
			if (Index > 0 && IntegerDigits >= 5 && (IntegerDigits - Index) % 3 == 0) { Out.push_back('.'); }
			Out.push_back(Integer[Index]);
		}
		if (!Fraction.empty())
		{
			Out.push_back(',');
			Out += Fraction;
		}
		return Out;
	}

	double JsRound(double Value)
	{
		// Math.round: entero más cercano con la mitad hacia +∞. Coincide con floor(x + 0,5) salvo donde esa suma
		// redondea mal (0,49999999999999994 da 0, no 1; los impares ≥ 2^52 no cambian) y conserva NaN, ±∞ y -0.
		double Rounded = std::floor(Value);
		if (Value - Rounded >= 0.5) { Rounded += 1.0; }
		return Rounded == 0.0 ? std::copysign(0.0, Value) : Rounded;
	}
}

#if defined(_MSC_VER)
#pragma float_control(pop)
#endif
