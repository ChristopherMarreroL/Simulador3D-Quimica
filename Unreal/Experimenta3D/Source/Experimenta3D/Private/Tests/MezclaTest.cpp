// Prueba Automation «Experimenta.Mezcla.Cloruros»: la práctica «Prueba de cloruros» (20 mL de
// AgNO3 0,1 mol/L y 5 mL de NaCl 1,0 mol/L) a través de UMezclaComponent, comprobando que el
// líquido recibe el volumen que da el modelo químico y que los rechazos no cambian nada.
#include "CoreMinimal.h"
#include "Misc/AutomationTest.h"

#include "LiquidoComponent.h"
#include "MezclaComponent.h"

#if WITH_DEV_AUTOMATION_TESTS

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FExperimentaMezclaClorurosTest, "Experimenta.Mezcla.Cloruros",
	EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FExperimentaMezclaClorurosTest::RunTest(const FString& Parameters)
{
	ULiquidoComponent* Liquido = NewObject<ULiquidoComponent>();
	// Recipiente de prueba: cilindro de radio 10 mm y 400 mm de alto (125,7 mL).
	Liquido->PerfilInteriorMM = { FVector2D(0.0, 0.0), FVector2D(10.0, 0.0), FVector2D(10.0, 400.0) };
	UMezclaComponent* Mezcla = NewObject<UMezclaComponent>();
	Mezcla->Liquido = Liquido;

	FString Mensaje;
	TestFalse(TEXT("Reactivo desconocido rechazado"), Mezcla->AnadirReactivo(TEXT("no-existe"), 10.0f, Mensaje));
	TestFalse(TEXT("El rechazo lleva mensaje"), Mensaje.IsEmpty());
	TestFalse(TEXT("Cantidad fuera de rango rechazada"), Mezcla->AnadirReactivo(TEXT("agno3"), 0.5f, Mensaje));
	TestEqual(TEXT("Los rechazos no añaden volumen"), Mezcla->VolumenML(), 0.0f);
	TestFalse(TEXT("Sin líquido no hay pH"), Mezcla->TienePH());

	TestTrue(TEXT("20 mL de AgNO3 aceptados"), Mezcla->AnadirReactivo(TEXT("agno3"), 20.0f, Mensaje));
	TestNearlyEqual(TEXT("Volumen tras AgNO3"), Mezcla->VolumenML(), 20.0f, 0.05f);
	TestNearlyEqual(TEXT("Sin sólido antes del cloruro"), Mezcla->SolidosGramos(), 0.0f, 1.0e-6f);

	TestTrue(TEXT("5 mL de NaCl aceptados"), Mezcla->AnadirReactivo(TEXT("nacl"), 5.0f, Mensaje));
	TestTrue(TEXT("Dispara la regla ksp-AgCl"), Mezcla->ReglasUltimaAdicion().Contains(TEXT("ksp-AgCl")));
	TestEqual(TEXT("El sólido es AgCl"), Mezcla->SolidoPrincipal(), FString(TEXT("AgCl")));
	// 0,002 mol de Ag+ (limitante) x 143,32 g/mol = 0,2866 g, menos lo que queda disuelto (Ksp).
	TestNearlyEqual(TEXT("Gramos de AgCl"), Mezcla->SolidosGramos(), 0.2866f, 0.001f);
	TestNearlyEqual(TEXT("Volumen final"), Mezcla->VolumenML(), 25.0f, 0.05f);
	TestTrue(TEXT("Hay pH"), Mezcla->TienePH());

	TestEqual(TEXT("El líquido recibe el volumen del modelo"), Liquido->VolumenML, Mezcla->VolumenML());
	TestNearlyEqual(TEXT("Nivel del líquido"), Liquido->AlturaNivelMM(),
		Mezcla->VolumenML() * 1000.0f / (UE_PI * 100.0f), 0.01f);
	AddInfo(FString::Printf(TEXT("Cloruros: %.3f mL, pH %.2f, %.1f C, %s %.4f g, nivel %.2f mm"), Mezcla->VolumenML(),
		Mezcla->PH(), Mezcla->TemperaturaC(), *Mezcla->SolidoPrincipal(), Mezcla->SolidosGramos(), Liquido->AlturaNivelMM()));

	// Aspecto: lo precipitado empieza en suspensión, se deposita con el tiempo y la masa se conserva.
	ULiquidoComponent* Sedimento = NewObject<ULiquidoComponent>();
	Sedimento->PerfilInteriorMM = Liquido->PerfilInteriorMM;
	Mezcla->Sedimento = Sedimento;
	const float Solido = Mezcla->SolidosGramos();
	TestNearlyEqual(TEXT("Recién precipitado: todo en suspensión"), Mezcla->SuspendidoGramos(), Solido, 1.0e-5f);
	TestTrue(TEXT("Recién precipitado: turbio"), Mezcla->Turbidez() > 0.8f);
	Mezcla->AvanzarAspecto(Mezcla->SegundosSedimentacion);
	TestNearlyEqual(TEXT("Tras una constante de tiempo queda 1/e"), Mezcla->SuspendidoGramos(), Solido * FMath::Exp(-1.0f), 1.0e-4f);
	TestNearlyEqual(TEXT("La masa se conserva"), Mezcla->SuspendidoGramos() + Mezcla->SedimentoGramos(), Solido, 1.0e-6f);
	for (int32 i = 0; i < 300; ++i)
	{
		Mezcla->AvanzarAspecto(1.0f);
	}
	TestEqual(TEXT("Al final nada en suspensión"), Mezcla->SuspendidoGramos(), 0.0f);
	TestNearlyEqual(TEXT("Al final todo depositado"), Mezcla->SedimentoGramos(), Solido, 1.0e-6f);
	TestEqual(TEXT("Al final el líquido queda claro"), Mezcla->Turbidez(), 0.0f);
	TestNearlyEqual(TEXT("Volumen de la capa"), Sedimento->VolumenML, Solido / Mezcla->DensidadAparenteSedimento, 0.03f);
	TestEqual(TEXT("El sólido del modelo no cambia al sedimentar"), Mezcla->SolidosGramos(), Solido);

	Mezcla->Vaciar();
	TestEqual(TEXT("Vaciar quita la suspensión"), Mezcla->SuspendidoGramos(), 0.0f);
	TestEqual(TEXT("Vaciar quita el sedimento"), Sedimento->VolumenML, 0.0f);
	TestEqual(TEXT("Vaciar deja 0 mL"), Mezcla->VolumenML(), 0.0f);
	TestEqual(TEXT("Vacío: sin color"), Mezcla->IntensidadColor(), 0.0f);

	// Color de la disolución: lo da el modelo (solutionColor), aquí solo se transmite.
	TestTrue(TEXT("Agua aceptada"), Mezcla->AnadirReactivo(TEXT("water"), 50.0f, Mensaje));
	TestEqual(TEXT("Agua: incolora"), Mezcla->IntensidadColor(), 0.0f);
	Mezcla->Vaciar();

	TestTrue(TEXT("CuSO4 aceptado"), Mezcla->AnadirReactivo(TEXT("cuso4"), 50.0f, Mensaje));
	// 0,5 mol/L de Cu2+: capa de peso 1 - exp(-3,5 * 0,5) = 0,826 y color #2f8fe0.
	TestEqual(TEXT("CuSO4: color del modelo"), Mezcla->ColorModeloHex(), FString(TEXT("#2f8fe0")));
	TestNearlyEqual(TEXT("CuSO4: intensidad"), Mezcla->IntensidadColor(), 1.0f - FMath::Exp(-1.75f), 1.0e-4f);
	TestTrue(TEXT("CuSO4: azul"), Mezcla->ColorDisolucion().B > Mezcla->ColorDisolucion().R);
	Mezcla->Vaciar();

	// Fenolftaleína: incolora en ácido, rosa (#e0218a) en base.
	TestTrue(TEXT("HCl aceptado"), Mezcla->AnadirReactivo(TEXT("hcl"), 20.0f, Mensaje));
	TestTrue(TEXT("Fenolftaleína aceptada"), Mezcla->AnadirReactivo(TEXT("phenolphthalein"), 3.0f, Mensaje));
	TestEqual(TEXT("Fenolftaleína en ácido: incolora"), Mezcla->IntensidadColor(), 0.0f);
	TestTrue(TEXT("NaOH aceptado"), Mezcla->AnadirReactivo(TEXT("naoh"), 25.0f, Mensaje));
	TestTrue(TEXT("Exceso de base: pH alto"), Mezcla->PH() > 10.0f);
	TestEqual(TEXT("Fenolftaleína en base: rosa del modelo"), Mezcla->ColorModeloHex(), FString(TEXT("#e0218a")));
	TestNearlyEqual(TEXT("Fenolftaleína en base: intensidad"), Mezcla->IntensidadColor(), 0.82f, 1.0e-4f);
	AddInfo(FString::Printf(TEXT("Valoración: %.2f mL, pH %.2f, %.1f C, color %s, intensidad %.2f"), Mezcla->VolumenML(),
		Mezcla->PH(), Mezcla->TemperaturaC(), *Mezcla->ColorModeloHex(), Mezcla->IntensidadColor()));
	Mezcla->Vaciar();
	TestEqual(TEXT("Vaciar deja el líquido en 0 mL"), Liquido->VolumenML, 0.0f);
	return true;
}

#endif // WITH_DEV_AUTOMATION_TESTS
