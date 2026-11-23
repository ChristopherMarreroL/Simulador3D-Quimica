// Lector JSON mínimo para los vectores de referencia (golden/chemistry.json).
// Solo C++17 y la biblioteca estándar, sin excepciones. No es una biblioteca JSON general:
// lee un documento entero en memoria y lo deja como un árbol de valores.
#pragma once

#include <cstddef>
#include <string>
#include <string_view>
#include <vector>

namespace ExperimentaChem
{
namespace MiniJson
{
	enum class EType : unsigned char { Null, Bool, Number, String, Array, Object };

	struct FValue
	{
		EType Type = EType::Null;
		bool bValue = false;             // Bool
		double Number = 0.0;             // Number
		std::string String;              // String (UTF-8)
		std::vector<FValue> Items;       // Array: elementos. Object: valores, en paralelo con Keys.
		std::vector<std::string> Keys;   // Object: claves en el orden del texto.

		bool IsNull() const { return Type == EType::Null; }
		bool IsBool() const { return Type == EType::Bool; }
		bool IsNumber() const { return Type == EType::Number; }
		bool IsString() const { return Type == EType::String; }
		bool IsArray() const { return Type == EType::Array; }
		bool IsObject() const { return Type == EType::Object; }

		/** Valor de la clave, o nullptr si no existe o esto no es un objeto. Con claves repetidas gana la última, como en JSON.parse. */
		const FValue* Find(std::string_view Key) const;

		static FValue MakeNull() { return FValue(); }
		static FValue MakeBool(bool bInValue);
		static FValue MakeNumber(double InNumber);
		static FValue MakeString(std::string_view InText);
		static FValue MakeArray();
		static FValue MakeObject();

		/** Añade un elemento al final de un array. */
		void Push(FValue InValue);
		/** Añade una clave al final de un objeto (no busca repetidas). */
		void Set(std::string_view InKey, FValue InValue);
	};

	struct FParseResult
	{
		bool bOk = false;
		/** «JSON no válido en la línea L, columna C (byte N): motivo». Línea y columna empiezan en 1; la columna cuenta bytes. */
		std::string Error;
		size_t Offset = 0; int Line = 0; int Column = 0;
		FValue Root;
	};

	/**
	 * Lee un documento JSON completo (RFC 8259) en UTF-8. Tiempo lineal en el tamaño del texto.
	 * - Los números se leen con std::from_chars (redondeo correcto, sin configuración regional). Fuera del rango
	 *   de double dan ±infinito o ±0, como JSON.parse.
	 * - \uXXXX se convierte a UTF-8, uniendo los pares sustitutos. Un sustituto suelto se sustituye por U+FFFD,
	 *   porque no tiene forma válida en UTF-8.
	 * - Se admite una marca BOM inicial. No se admiten comentarios, comas finales ni texto después del valor.
	 */
	FParseResult Parse(std::string_view Text);

	/** Número como lo escribe JavaScript (Number.prototype.toString): la forma más corta que vuelve al mismo double. */
	std::string NumberToString(double Value);

	/** Texto compacto como JSON.stringify, para diagnósticos. Única diferencia: los no finitos se escriben NaN, Infinity y -Infinity en vez de null. */
	std::string Describe(const FValue& Value);
}
}
