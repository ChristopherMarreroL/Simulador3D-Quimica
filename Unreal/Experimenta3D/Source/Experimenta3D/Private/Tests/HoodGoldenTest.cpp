// Prueba Automation «Experimenta.Hood.Golden»: ejecuta los vectores de golden/steps.json (capa de estado de la
// campana) contra Hood.h tal como lo compila Unreal. Falla, listando las diferencias, si no pasan todos.
//
// Sin interfaz:
//   UnrealEditor-Cmd.exe <Experimenta3D.uproject> -ExecCmds="Automation RunTests Experimenta.Hood; Quit"
//     -unattended -nopause -nosplash -nullrhi -stdout -FullStdOutLogOutput
#include "CoreMinimal.h"
#include "Misc/AutomationTest.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"

#include "ExperimentaChem/HoodGolden.h"

#include <string>
#include <string_view>

#if WITH_DEV_AUTOMATION_TESTS

DEFINE_LOG_CATEGORY_STATIC(LogExperimentaHood, Log, All);

namespace
{
	// Todo el texto del módulo químico es UTF-8.
	FString FromUtf8(const std::string& Text)
	{
		const FUTF8ToTCHAR Converted(Text.data(), static_cast<int32>(Text.size()));
		return FString::ConstructFromPtrSize(Converted.Get(), Converted.Length());
	}
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FExperimentaHoodGoldenTest, "Experimenta.Hood.Golden",
	EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FExperimentaHoodGoldenTest::RunTest(const FString& Parameters)
{
	// El JSON está en la raíz del repositorio, dos niveles por encima del proyecto de Unreal.
	FString JsonPath = FPaths::ConvertRelativePathToFull(FPaths::Combine(FPaths::ProjectDir(), TEXT("../../golden/steps.json")));
	FPaths::CollapseRelativeDirectories(JsonPath);

	TArray<uint8> Bytes;
	if (!FFileHelper::LoadFileToArray(Bytes, *JsonPath))
	{
		AddError(FString::Printf(TEXT("No se pudo leer %s"), *JsonPath));
		return false;
	}

	// Se pasan los bytes tal cual: RunStepsGolden espera UTF-8.
	const std::string_view JsonText(reinterpret_cast<const char*>(Bytes.GetData()), static_cast<size_t>(Bytes.Num()));
	const ExperimentaChem::FStepsReport Report = ExperimentaChem::RunStepsGolden(JsonText, 40);

	if (!Report.bParsed)
	{
		AddError(FString::Printf(TEXT("No se pudieron leer los vectores de %s: %s"), *JsonPath, *FromUtf8(Report.Error)));
		return false;
	}

	for (const ExperimentaChem::FGoldenFamily& Family : Report.Families)
	{
		UE_LOG(LogExperimentaHood, Display, TEXT("  %-26s %5d casos, %5d aprobados%s"),
			*FromUtf8(Family.Name), Family.Cases, Family.Passed, Family.Passed == Family.Cases ? TEXT("") : TEXT("   <-- FALLA"));
	}

	const FString Summary = FString::Printf(
		TEXT("Experimenta.Hood.Golden: %d de %d casos aprobados, %d operaciones; comprobaciones de tablas que no coinciden: %d (%s, %d bytes)"),
		Report.Passed, Report.Cases, Report.Ops, Report.TableFailures, *JsonPath, Bytes.Num());
	UE_LOG(LogExperimentaHood, Display, TEXT("%s"), *Summary);

	if (!Report.AllPassed())
	{
		AddError(Summary);
		// «id op N (operación).ruta: esperado frente a obtenido»; como mucho 40 líneas.
		for (const std::string& Line : Report.Failures)
		{
			AddError(FromUtf8(Line));
		}
		return false;
	}

	AddInfo(Summary);
	return true;
}

#endif // WITH_DEV_AUTOMATION_TESTS
