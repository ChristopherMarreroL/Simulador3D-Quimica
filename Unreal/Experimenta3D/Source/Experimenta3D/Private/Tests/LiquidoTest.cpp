// Prueba Automation «Experimenta.Liquido.Geometria»: comprueba la relación volumen <-> altura del
// componente de líquido con casos de solución exacta y con los perfiles reales exportados por
// Blender (art/export/perfiles_interiores.json), frente a las alturas que calculó Blender.
//
//   UnrealEditor-Cmd.exe <Experimenta3D.uproject> -ExecCmds="Automation RunTests Experimenta.Liquido; Quit"
//     -unattended -nopause -nosplash -nullrhi -stdout -FullStdOutLogOutput
#include "CoreMinimal.h"
#include "Dom/JsonObject.h"
#include "Misc/AutomationTest.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"

#include "LiquidoComponent.h"

#if WITH_DEV_AUTOMATION_TESTS

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FExperimentaLiquidoGeometriaTest, "Experimenta.Liquido.Geometria",
	EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FExperimentaLiquidoGeometriaTest::RunTest(const FString& Parameters)
{
	using namespace ExperimentaLiquido;

	// Cilindro de radio 10 mm y 100 mm de alto: V = pi * r^2 * h.
	const TArray<FVector2D> Cilindro = OrdenarPerfil({ FVector2D(10.0, 100.0), FVector2D(10.0, 0.0), FVector2D(0.0, 0.0) });
	TestNearlyEqual(TEXT("Cilindro: volumen a 50 mm"), VolumenHastaML(Cilindro, 50.0), UE_DOUBLE_PI * 100.0 * 50.0 / 1000.0, 1e-9);
	TestNearlyEqual(TEXT("Cilindro: altura para 10 mL"), AlturaParaML(Cilindro, 10.0), 10000.0 / (UE_DOUBLE_PI * 100.0), 1e-6);
	TestNearlyEqual(TEXT("Cilindro: radio a media altura"), RadioEn(Cilindro, 50.0), 10.0, 1e-12);

	// Tronco de cono de radios 30 y 10 mm y 60 mm de alto: V = pi*h/3*(R^2 + R*r + r^2).
	const TArray<FVector2D> Cono = OrdenarPerfil({ FVector2D(0.0, 0.0), FVector2D(30.0, 0.0), FVector2D(10.0, 60.0) });
	const double VolumenCono = UE_DOUBLE_PI * 60.0 / 3.0 * (900.0 + 300.0 + 100.0) / 1000.0;
	TestNearlyEqual(TEXT("Cono: volumen total"), VolumenHastaML(Cono, 60.0), VolumenCono, 1e-9);
	TestNearlyEqual(TEXT("Cono: ida y vuelta"), VolumenHastaML(Cono, AlturaParaML(Cono, 40.0)), 40.0, 1e-9);
	TestNearlyEqual(TEXT("Cono: se limita al borde"), AlturaParaML(Cono, 1.0e6), 60.0, 1e-12);
	TestNearlyEqual(TEXT("Cono: vacío en el fondo"), AlturaParaML(Cono, 0.0), 0.0, 1e-12);

	// Perfiles reales. Alturas de referencia (mm) impresas por Blender; Blender integra por pasos de
	// 0,02 mm, así que se admite una diferencia de 0,05 mm.
	FString Ruta = FPaths::ConvertRelativePathToFull(FPaths::Combine(FPaths::ProjectDir(), TEXT("../../art/export/perfiles_interiores.json")));
	FPaths::CollapseRelativeDirectories(Ruta);
	FString Texto;
	if (!FFileHelper::LoadFileToString(Texto, *Ruta))
	{
		AddError(FString::Printf(TEXT("No se pudo leer %s"), *Ruta));
		return false;
	}
	TSharedPtr<FJsonObject> Raiz;
	if (!FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(Texto), Raiz) || !Raiz.IsValid())
	{
		AddError(TEXT("perfiles_interiores.json no es JSON válido"));
		return false;
	}
	auto Leer = [&Raiz](const TCHAR* Nombre)
	{
		TArray<FVector2D> Perfil;
		const TArray<TSharedPtr<FJsonValue>>* Puntos = nullptr;
		if (Raiz->TryGetArrayField(Nombre, Puntos))
		{
			for (const TSharedPtr<FJsonValue>& Punto : *Puntos)
			{
				const TArray<TSharedPtr<FJsonValue>>& Par = Punto->AsArray();
				Perfil.Emplace(Par[0]->AsNumber(), Par[1]->AsNumber());
			}
		}
		return OrdenarPerfil(Perfil);
	};

	struct FCaso { const TCHAR* Recipiente; double ML; double AlturaMM; };
	const FCaso Casos[] = {
		{ TEXT("SM_GradCylinder_100"), 20.0, 45.0 }, { TEXT("SM_GradCylinder_100"), 100.0, 195.7 },
		{ TEXT("SM_Erlenmeyer_500"), 25.0, 6.4 }, { TEXT("SM_Erlenmeyer_500"), 500.0, 101.1 },
		{ TEXT("SM_ReagentBottle_500"), 400.0, 83.5 },
	};
	for (const FCaso& Caso : Casos)
	{
		const TArray<FVector2D> Perfil = Leer(Caso.Recipiente);
		if (Perfil.Num() < 2)
		{
			AddError(FString::Printf(TEXT("Falta el perfil de %s"), Caso.Recipiente));
			continue;
		}
		const double Altura = AlturaParaML(Perfil, Caso.ML);
		AddInfo(FString::Printf(TEXT("%s: %.1f mL -> %.3f mm (Blender %.1f)"), Caso.Recipiente, Caso.ML, Altura, Caso.AlturaMM));
		TestNearlyEqual(*FString::Printf(TEXT("%s a %.0f mL"), Caso.Recipiente, Caso.ML), Altura, Caso.AlturaMM, 0.1);
		TestNearlyEqual(*FString::Printf(TEXT("%s ida y vuelta"), Caso.Recipiente), VolumenHastaML(Perfil, Altura), Caso.ML, 1e-6);
	}
	return true;
}

#endif // WITH_DEV_AUTOMATION_TESTS
