// chem_golden: ejecuta golden/chemistry.json contra el módulo ExperimentaChem compilado fuera de Unreal.
// Uso: chem_golden [ruta a chemistry.json] [máximo de líneas de fallo]
// Devuelve 0 solo si pasan todos los casos y todas las comprobaciones de tablas; 1 si algo falla; 2 si no se pudo leer el archivo.
#include "ExperimentaChem/Golden.h"

#include <cstdio>
#include <cstdlib>
#include <string>

#ifdef _WIN32
// Para que la consola muestre el informe, que es UTF-8. Se declara aquí para no arrastrar <windows.h>.
extern "C" __declspec(dllimport) int __stdcall SetConsoleOutputCP(unsigned int CodePage);
#endif

namespace
{
	bool ReadFile(const char* Path, std::string& Out)
	{
		std::FILE* File = nullptr;
#ifdef _MSC_VER
		if (fopen_s(&File, Path, "rb") != 0) { File = nullptr; }
#else
		File = std::fopen(Path, "rb");
#endif
		if (File == nullptr) { return false; }
		char Buffer[65536];
		size_t Count = 0;
		while ((Count = std::fread(Buffer, 1, sizeof(Buffer), File)) > 0) { Out.append(Buffer, Count); }
		const bool bOk = std::ferror(File) == 0;
		std::fclose(File);
		return bOk;
	}
}

int main(int ArgCount, char** Args)
{
#ifdef _WIN32
	SetConsoleOutputCP(65001u);
#endif
	const char* Path = ArgCount > 1 ? Args[1] : "golden/chemistry.json";
	const int MaxFailures = ArgCount > 2 ? std::atoi(Args[2]) : 40;

	std::string Json;
	if (!ReadFile(Path, Json))
	{
		std::fprintf(stderr, "No se pudo leer %s\n", Path);
		return 2;
	}

	const ExperimentaChem::FGoldenReport Report = ExperimentaChem::RunGolden(Json, MaxFailures);
	std::printf("Vectores de referencia: %s (%zu bytes)\n", Path, Json.size());
	if (!Report.bParsed)
	{
		std::printf("No se pudieron leer los vectores: %s\n", Report.Error.c_str());
		return 2;
	}

	std::printf("\n%-26s %7s %10s\n", "Familia", "Casos", "Aprobados");
	for (const ExperimentaChem::FGoldenFamily& Family : Report.Families)
	{
		std::printf("%-26s %7d %10d%s\n", Family.Name.c_str(), Family.Cases, Family.Passed, Family.Passed == Family.Cases ? "" : "   <-- FALLA");
	}
	std::printf("%-26s %7d %10d\n", "TOTAL", Report.Cases, Report.Passed);
	std::printf("Comprobaciones de tablas que no coinciden: %d\n", Report.TableFailures);

	if (!Report.Failures.empty())
	{
		std::printf("\nDiferencias (esperado frente a obtenido; se muestran %zu):\n", Report.Failures.size());
		for (const std::string& Line : Report.Failures) { std::printf("  %s\n", Line.c_str()); }
	}

	const bool bAllPassed = Report.AllPassed();
	std::printf("\n%s\n", bAllPassed
		? "RESULTADO: CORRECTO. El m\303\263dulo reproduce todos los vectores de referencia."
		: "RESULTADO: FALLO. El m\303\263dulo no reproduce los vectores de referencia.");
	return bAllPassed ? 0 : 1;
}
