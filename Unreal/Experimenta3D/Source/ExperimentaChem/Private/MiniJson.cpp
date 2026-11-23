#include "MiniJson.h"

#include <charconv>
#include <cmath>
#include <system_error>
#include <utility>

namespace ExperimentaChem
{
namespace MiniJson
{
	const FValue* FValue::Find(std::string_view Key) const
	{
		if (Type != EType::Object) { return nullptr; }
		for (size_t Index = Keys.size(); Index > 0; --Index)
		{
			if (Keys[Index - 1] == Key) { return &Items[Index - 1]; }
		}
		return nullptr;
	}

	FValue FValue::MakeBool(bool bInValue) { FValue V; V.Type = EType::Bool; V.bValue = bInValue; return V; }
	FValue FValue::MakeNumber(double InNumber) { FValue V; V.Type = EType::Number; V.Number = InNumber; return V; }
	FValue FValue::MakeString(std::string_view InText) { FValue V; V.Type = EType::String; V.String.assign(InText.data(), InText.size()); return V; }
	FValue FValue::MakeArray() { FValue V; V.Type = EType::Array; return V; }
	FValue FValue::MakeObject() { FValue V; V.Type = EType::Object; return V; }

	void FValue::Push(FValue InValue) { Items.push_back(std::move(InValue)); }
	void FValue::Set(std::string_view InKey, FValue InValue)
	{
		Keys.emplace_back(InKey.data(), InKey.size());
		Items.push_back(std::move(InValue));
	}

	namespace
	{
		// Límite de anidamiento: el lector es recursivo y un texto hostil no debe agotar la pila.
		const int MaxDepth = 256;

		bool IsDigit(char C) { return C >= '0' && C <= '9'; }

		void AppendUtf8(std::string& Out, unsigned int Code)
		{
			if (Code < 0x80u)
			{
				Out.push_back(static_cast<char>(Code));
			}
			else if (Code < 0x800u)
			{
				Out.push_back(static_cast<char>(0xC0u | (Code >> 6)));
				Out.push_back(static_cast<char>(0x80u | (Code & 0x3Fu)));
			}
			else if (Code < 0x10000u)
			{
				Out.push_back(static_cast<char>(0xE0u | (Code >> 12)));
				Out.push_back(static_cast<char>(0x80u | ((Code >> 6) & 0x3Fu)));
				Out.push_back(static_cast<char>(0x80u | (Code & 0x3Fu)));
			}
			else
			{
				Out.push_back(static_cast<char>(0xF0u | (Code >> 18)));
				Out.push_back(static_cast<char>(0x80u | ((Code >> 12) & 0x3Fu)));
				Out.push_back(static_cast<char>(0x80u | ((Code >> 6) & 0x3Fu)));
				Out.push_back(static_cast<char>(0x80u | (Code & 0x3Fu)));
			}
		}

		/**
		 * Valor de un número con sintaxis válida que from_chars da por fuera de rango: ±infinito si es
		 * demasiado grande y ±0 si es demasiado pequeño, que es lo que devuelve JSON.parse.
		 */
		double OutOfRangeValue(const char* First, const char* Last)
		{
			const char* P = First;
			bool bNegative = false;
			if (P != Last && *P == '-') { bNegative = true; ++P; }
			// Exponente decimal de la primera cifra significativa de la mantisa.
			long long LeadExponent = 0;
			long long IntegerDigits = 0;
			long long FractionZeros = 0;
			bool bSeenNonZero = false;
			bool bInFraction = false;
			for (; P != Last && *P != 'e' && *P != 'E'; ++P)
			{
				if (*P == '.') { bInFraction = true; continue; }
				if (!bInFraction)
				{
					if (bSeenNonZero || *P != '0') { bSeenNonZero = true; ++IntegerDigits; }
				}
				else if (!bSeenNonZero)
				{
					if (*P == '0') { ++FractionZeros; }
					else { bSeenNonZero = true; LeadExponent = -(FractionZeros + 1); }
				}
			}
			if (IntegerDigits > 0) { LeadExponent = IntegerDigits - 1; }
			long long Exponent = 0;
			if (P != Last)
			{
				++P;
				bool bNegativeExponent = false;
				if (P != Last && (*P == '+' || *P == '-')) { bNegativeExponent = *P == '-'; ++P; }
				for (; P != Last; ++P)
				{
					if (Exponent < 1000000) { Exponent = Exponent * 10 + (*P - '0'); }
				}
				if (bNegativeExponent) { Exponent = -Exponent; }
			}
			const bool bHuge = bSeenNonZero && LeadExponent + Exponent > 0;
			const double Magnitude = bHuge ? HUGE_VAL : 0.0;
			return bNegative ? -Magnitude : Magnitude;
		}

		struct FParser
		{
			std::string_view Text;
			size_t Pos = 0;
			const char* Problem = nullptr;   // nullptr = sin error
			size_t ProblemPos = 0;

			bool Fail(const char* Message)
			{
				if (Problem == nullptr) { Problem = Message; ProblemPos = Pos; }
				return false;
			}

			/** Carácter actual, o 0 al final del texto. */
			char Peek() const { return Pos < Text.size() ? Text[Pos] : '\0'; }

			void SkipSpace()
			{
				while (Pos < Text.size())
				{
					const char C = Text[Pos];
					if (C != ' ' && C != '\n' && C != '\r' && C != '\t') { break; }
					++Pos;
				}
			}

			bool ParseHex4(unsigned int& Code)
			{
				if (Text.size() - Pos < 4) { return Fail("escape \\u incompleto"); }
				Code = 0;
				for (int Index = 0; Index < 4; ++Index)
				{
					const char C = Text[Pos];
					unsigned int Digit = 0;
					if (C >= '0' && C <= '9') { Digit = static_cast<unsigned int>(C - '0'); }
					else if (C >= 'a' && C <= 'f') { Digit = static_cast<unsigned int>(C - 'a') + 10u; }
					else if (C >= 'A' && C <= 'F') { Digit = static_cast<unsigned int>(C - 'A') + 10u; }
					else { return Fail("escape \\u con una cifra hexadecimal no v\303\241lida"); }
					Code = (Code << 4) | Digit;
					++Pos;
				}
				return true;
			}

			/** Text[Pos] es la comilla de apertura. */
			bool ParseString(std::string& Out)
			{
				++Pos;
				for (;;)
				{
					// Tramo sin escapes: se copia de una vez.
					const size_t Start = Pos;
					while (Pos < Text.size())
					{
						const char C = Text[Pos];
						if (C == '"' || C == '\\' || static_cast<unsigned char>(C) < 0x20u) { break; }
						++Pos;
					}
					Out.append(Text.data() + Start, Pos - Start);
					if (Pos >= Text.size()) { return Fail("cadena sin cerrar"); }
					const char C = Text[Pos];
					if (C == '"') { ++Pos; return true; }
					if (C != '\\') { return Fail("car\303\241cter de control sin escapar dentro de una cadena"); }
					if (Pos + 1 >= Text.size()) { return Fail("cadena sin cerrar"); }
					const char Escape = Text[Pos + 1];
					switch (Escape)
					{
					case '"': Out.push_back('"'); Pos += 2; break;
					case '\\': Out.push_back('\\'); Pos += 2; break;
					case '/': Out.push_back('/'); Pos += 2; break;
					case 'b': Out.push_back('\b'); Pos += 2; break;
					case 'f': Out.push_back('\f'); Pos += 2; break;
					case 'n': Out.push_back('\n'); Pos += 2; break;
					case 'r': Out.push_back('\r'); Pos += 2; break;
					case 't': Out.push_back('\t'); Pos += 2; break;
					case 'u':
					{
						Pos += 2;
						unsigned int Code = 0;
						if (!ParseHex4(Code)) { return false; }
						if (Code >= 0xD800u && Code <= 0xDBFFu)
						{
							// Sustituto alto: solo vale seguido de \uDC00–\uDFFF.
							bool bPaired = false;
							if (Text.size() - Pos >= 6 && Text[Pos] == '\\' && Text[Pos + 1] == 'u')
							{
								const size_t Saved = Pos;
								Pos += 2;
								unsigned int Low = 0;
								if (!ParseHex4(Low)) { return false; }
								if (Low >= 0xDC00u && Low <= 0xDFFFu)
								{
									Code = 0x10000u + ((Code - 0xD800u) << 10) + (Low - 0xDC00u);
									bPaired = true;
								}
								else
								{
									Pos = Saved;   // el escape siguiente se lee por su cuenta
								}
							}
							if (!bPaired) { Code = 0xFFFDu; }
						}
						else if (Code >= 0xDC00u && Code <= 0xDFFFu)
						{
							Code = 0xFFFDu;
						}
						AppendUtf8(Out, Code);
						break;
					}
					default:
						return Fail("escape no v\303\241lido dentro de una cadena");
					}
				}
			}

			bool ParseNumber(FValue& Out)
			{
				const size_t Start = Pos;
				if (Peek() == '-') { ++Pos; }
				if (Peek() == '0')
				{
					++Pos;
				}
				else if (IsDigit(Peek()))
				{
					while (IsDigit(Peek())) { ++Pos; }
				}
				else
				{
					return Fail("n\303\272mero no v\303\241lido: falta la parte entera");
				}
				if (Peek() == '.')
				{
					++Pos;
					if (!IsDigit(Peek())) { return Fail("n\303\272mero no v\303\241lido: faltan cifras tras el punto decimal"); }
					while (IsDigit(Peek())) { ++Pos; }
				}
				if (Peek() == 'e' || Peek() == 'E')
				{
					++Pos;
					if (Peek() == '+' || Peek() == '-') { ++Pos; }
					if (!IsDigit(Peek())) { return Fail("n\303\272mero no v\303\241lido: faltan cifras en el exponente"); }
					while (IsDigit(Peek())) { ++Pos; }
				}
				const char* First = Text.data() + Start;
				const char* Last = Text.data() + Pos;
				double Parsed = 0.0;
				const std::from_chars_result Result = std::from_chars(First, Last, Parsed);
				if (Result.ec == std::errc::result_out_of_range)
				{
					Parsed = OutOfRangeValue(First, Last);
				}
				else if (Result.ec != std::errc() || Result.ptr != Last)
				{
					Pos = Start;
					return Fail("n\303\272mero no v\303\241lido");
				}
				Out.Type = EType::Number;
				Out.Number = Parsed;
				return true;
			}

			bool ParseLiteral(std::string_view Word, FValue& Out, EType InType, bool bInValue)
			{
				if (Text.size() - Pos < Word.size() || Text.compare(Pos, Word.size(), Word) != 0)
				{
					return Fail("valor no v\303\241lido: se esperaba true, false o null");
				}
				Pos += Word.size();
				Out.Type = InType;
				Out.bValue = bInValue;
				return true;
			}

			bool ParseValue(FValue& Out, int Depth)
			{
				SkipSpace();
				if (Pos >= Text.size()) { return Fail("el texto termina donde se esperaba un valor"); }
				const char C = Text[Pos];
				if (C == '{')
				{
					if (Depth >= MaxDepth) { return Fail("demasiados niveles anidados"); }
					Out.Type = EType::Object;
					++Pos;
					SkipSpace();
					if (Peek() == '}') { ++Pos; return true; }
					for (;;)
					{
						SkipSpace();
						if (Peek() != '"') { return Fail("se esperaba una clave entre comillas"); }
						std::string Key;
						if (!ParseString(Key)) { return false; }
						SkipSpace();
						if (Peek() != ':') { return Fail("se esperaba ':' despu\303\251s de la clave"); }
						++Pos;
						Out.Keys.push_back(std::move(Key));
						Out.Items.emplace_back();
						if (!ParseValue(Out.Items.back(), Depth + 1)) { return false; }
						SkipSpace();
						if (Peek() == ',') { ++Pos; continue; }
						if (Peek() == '}') { ++Pos; return true; }
						return Fail("se esperaba ',' o '}' dentro de un objeto");
					}
				}
				if (C == '[')
				{
					if (Depth >= MaxDepth) { return Fail("demasiados niveles anidados"); }
					Out.Type = EType::Array;
					++Pos;
					SkipSpace();
					if (Peek() == ']') { ++Pos; return true; }
					for (;;)
					{
						Out.Items.emplace_back();
						if (!ParseValue(Out.Items.back(), Depth + 1)) { return false; }
						SkipSpace();
						if (Peek() == ',') { ++Pos; continue; }
						if (Peek() == ']') { ++Pos; return true; }
						return Fail("se esperaba ',' o ']' dentro de un array");
					}
				}
				if (C == '"')
				{
					Out.Type = EType::String;
					return ParseString(Out.String);
				}
				if (C == '-' || IsDigit(C)) { return ParseNumber(Out); }
				if (C == 't') { return ParseLiteral("true", Out, EType::Bool, true); }
				if (C == 'f') { return ParseLiteral("false", Out, EType::Bool, false); }
				if (C == 'n') { return ParseLiteral("null", Out, EType::Null, false); }
				return Fail("car\303\241cter inesperado donde se esperaba un valor");
			}
		};

		void AppendQuoted(std::string& Out, std::string_view Text)
		{
			static const char Hex[] = "0123456789abcdef";
			Out.push_back('"');
			for (const char C : Text)
			{
				switch (C)
				{
				case '"': Out += "\\\""; break;
				case '\\': Out += "\\\\"; break;
				case '\b': Out += "\\b"; break;
				case '\f': Out += "\\f"; break;
				case '\n': Out += "\\n"; break;
				case '\r': Out += "\\r"; break;
				case '\t': Out += "\\t"; break;
				default:
					if (static_cast<unsigned char>(C) < 0x20u)
					{
						Out += "\\u00";
						Out.push_back(Hex[(static_cast<unsigned char>(C) >> 4) & 0xF]);
						Out.push_back(Hex[static_cast<unsigned char>(C) & 0xF]);
					}
					else
					{
						Out.push_back(C);
					}
					break;
				}
			}
			Out.push_back('"');
		}

		void AppendValue(std::string& Out, const FValue& Value)
		{
			switch (Value.Type)
			{
			case EType::Null: Out += "null"; break;
			case EType::Bool: Out += Value.bValue ? "true" : "false"; break;
			case EType::Number: Out += NumberToString(Value.Number); break;
			case EType::String: AppendQuoted(Out, Value.String); break;
			case EType::Array:
				Out.push_back('[');
				for (size_t Index = 0; Index < Value.Items.size(); ++Index)
				{
					if (Index > 0) { Out.push_back(','); }
					AppendValue(Out, Value.Items[Index]);
				}
				Out.push_back(']');
				break;
			case EType::Object:
				Out.push_back('{');
				for (size_t Index = 0; Index < Value.Items.size(); ++Index)
				{
					if (Index > 0) { Out.push_back(','); }
					AppendQuoted(Out, Value.Keys[Index]);
					Out.push_back(':');
					AppendValue(Out, Value.Items[Index]);
				}
				Out.push_back('}');
				break;
			}
		}
	}

	FParseResult Parse(std::string_view Text)
	{
		FParseResult Result;
		FParser Parser;
		Parser.Text = Text;
		// Marca BOM de UTF-8.
		if (Text.size() >= 3 && Text[0] == '\xEF' && Text[1] == '\xBB' && Text[2] == '\xBF') { Parser.Pos = 3; }
		bool bOk = Parser.ParseValue(Result.Root, 0);
		if (bOk)
		{
			Parser.SkipSpace();
			if (Parser.Pos != Text.size()) { bOk = Parser.Fail("sobra texto despu\303\251s del valor"); }
		}
		if (bOk)
		{
			Result.bOk = true;
			return Result;
		}
		// La línea y la columna solo se calculan si hay error: una pasada.
		int Line = 1;
		size_t LineStart = 0;
		const size_t End = Parser.ProblemPos < Text.size() ? Parser.ProblemPos : Text.size();
		for (size_t Index = 0; Index < End; ++Index)
		{
			if (Text[Index] == '\n') { ++Line; LineStart = Index + 1; }
		}
		Result.Root = FValue();
		Result.Offset = Parser.ProblemPos;
		Result.Line = Line;
		Result.Column = static_cast<int>(End - LineStart) + 1;
		Result.Error = "JSON no v\303\241lido en la l\303\255nea " + std::to_string(Result.Line) + ", columna " + std::to_string(Result.Column)
			+ " (byte " + std::to_string(Result.Offset) + "): " + (Parser.Problem != nullptr ? Parser.Problem : "error desconocido");
		return Result;
	}

	std::string NumberToString(double Value)
	{
		if (std::isnan(Value)) { return "NaN"; }
		if (std::isinf(Value)) { return Value > 0.0 ? "Infinity" : "-Infinity"; }
		if (Value == 0.0) { return "0"; }
		// to_chars da las cifras más cortas que vuelven al mismo double, en la forma d[.ddd]e±XX.
		char Buffer[48];
		const std::to_chars_result Result = std::to_chars(Buffer, Buffer + sizeof(Buffer), std::fabs(Value), std::chars_format::scientific);
		if (Result.ec != std::errc()) { return "?"; }
		std::string Digits;
		const char* P = Buffer;
		for (; P != Result.ptr && *P != 'e'; ++P)
		{
			if (*P != '.') { Digits.push_back(*P); }
		}
		int Exponent = 0;
		if (P != Result.ptr)
		{
			++P;
			bool bNegativeExponent = false;
			if (P != Result.ptr && (*P == '+' || *P == '-')) { bNegativeExponent = *P == '-'; ++P; }
			for (; P != Result.ptr; ++P) { Exponent = Exponent * 10 + (*P - '0'); }
			if (bNegativeExponent) { Exponent = -Exponent; }
		}
		// Reglas de Number::toString de ECMAScript: el valor es 0,Digits × 10^N.
		const int K = static_cast<int>(Digits.size());
		const int N = Exponent + 1;
		std::string Out;
		if (Value < 0.0) { Out.push_back('-'); }
		if (K <= N && N <= 21)
		{
			Out += Digits;
			Out.append(static_cast<size_t>(N - K), '0');
		}
		else if (0 < N && N <= 21)
		{
			Out.append(Digits, 0, static_cast<size_t>(N));
			Out.push_back('.');
			Out.append(Digits, static_cast<size_t>(N), std::string::npos);
		}
		else if (-6 < N && N <= 0)
		{
			Out += "0.";
			Out.append(static_cast<size_t>(-N), '0');
			Out += Digits;
		}
		else
		{
			Out.push_back(Digits[0]);
			if (K > 1)
			{
				Out.push_back('.');
				Out.append(Digits, 1, std::string::npos);
			}
			Out.push_back('e');
			Out.push_back(N - 1 < 0 ? '-' : '+');
			Out += std::to_string(N - 1 < 0 ? 1 - N : N - 1);
		}
		return Out;
	}

	std::string Describe(const FValue& Value)
	{
		std::string Out;
		AppendValue(Out, Value);
		return Out;
	}
}
}
