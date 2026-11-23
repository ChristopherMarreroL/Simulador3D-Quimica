// Prueba Automation «Experimenta.Practica.Cloruros»: los pasos guiados de «Prueba de cloruros»
// se derivan del estado igual que en la web (regla del 90 %, observación por reglas, sin orden).
#include "CoreMinimal.h"
#include "Misc/AutomationTest.h"

#include "PracticaGuiada.h"

#if WITH_DEV_AUTOMATION_TESTS

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FExperimentaPracticaClorurosTest, "Experimenta.Practica.Cloruros",
	EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FExperimentaPracticaClorurosTest::RunTest(const FString& Parameters)
{
	UPracticaGuiadaComponent* Practica = NewObject<UPracticaGuiadaComponent>();
	const TArray<FString> SinReglas;
	const TArray<FString> ReglaAgCl = { TEXT("ksp-AgCl") };

	TArray<FPasoPractica> Pasos = Practica->Pasos();
	TestEqual(TEXT("Tres pasos"), Pasos.Num(), 3);
	TestEqual(TEXT("Claves como en la web"), Pasos[0].Clave + TEXT(",") + Pasos[1].Clave + TEXT(",") + Pasos[2].Clave,
		FString(TEXT("add-0,add-1,observe")));
	TestEqual(TEXT("Título del primer paso"), Pasos[0].Titulo,
		FString(TEXT("Mide 20 mL de Nitrato de plata en la probeta y viértelos en el matraz")));
	TestEqual(TEXT("Título del segundo paso"), Pasos[1].Titulo,
		FString(TEXT("Mide 5 mL de Cloruro de sodio en la probeta y viértelos en el matraz")));
	TestEqual(TEXT("Empieza en el paso 1"), Practica->PasoActual(), 0);

	// Regla del 90 %: 17,9 mL no basta; 18,0 mL sí (inclusive).
	Practica->RegistrarAdicion(TEXT("agno3"), 17.9f, SinReglas);
	TestEqual(TEXT("17,9 mL: sigue en el paso 1"), Practica->PasoActual(), 0);
	Practica->Reiniciar();
	Practica->RegistrarAdicion(TEXT("agno3"), 18.0f, SinReglas);
	TestEqual(TEXT("18,0 mL: pasa al paso 2"), Practica->PasoActual(), 1);

	// Rareza heredada: con 4,4 mL de NaCl ya precipita, así que «observe» se cumple antes que «add-1».
	Practica->RegistrarAdicion(TEXT("nacl"), 4.4f, ReglaAgCl);
	Pasos = Practica->Pasos();
	TestFalse(TEXT("4,4 mL: add-1 sin hacer"), Pasos[1].bHecho);
	TestTrue(TEXT("4,4 mL: observe hecho"), Pasos[2].bHecho);
	TestEqual(TEXT("El paso actual sigue siendo el 2"), Practica->PasoActual(), 1);
	TestFalse(TEXT("Aún no completada"), Practica->Completada());
	Practica->RegistrarAdicion(TEXT("nacl"), 0.1f, SinReglas);
	TestTrue(TEXT("4,5 mL acumulados: completada"), Practica->Completada());

	// Orden inverso y cantidades dobles también completan; un reactivo ajeno se cuenta pero no cambia nada.
	Practica->Reiniciar();
	TestEqual(TEXT("Reiniciar vuelve al paso 1"), Practica->PasoActual(), 0);
	Practica->RegistrarAdicion(TEXT("water"), 50.0f, SinReglas);
	TestEqual(TEXT("El agua no avanza la práctica"), Practica->PasoActual(), 0);
	TestEqual(TEXT("Pero queda anotada"), Practica->Anadido(TEXT("water")), 50.0f);
	Practica->RegistrarAdicion(TEXT("nacl"), 10.0f, SinReglas);
	TestEqual(TEXT("NaCl primero: sigue faltando el paso 1"), Practica->PasoActual(), 0);
	Practica->RegistrarAdicion(TEXT("agno3"), 40.0f, ReglaAgCl);
	TestTrue(TEXT("Orden inverso y doble cantidad: completada"), Practica->Completada());
	return true;
}

#endif // WITH_DEV_AUTOMATION_TESTS
