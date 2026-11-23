// Experimenta.Juego.Cloruros: recorre la «Prueba de cloruros» de principio a fin con las MISMAS acciones que el
// jugador (apuntar a un objetivo, pulsar y soltar el clic, Q, 1/2, N y el paso del tiempo), a través de FExpPartida,
// que es lo que llama el personaje del juego. Comprueba el orden de los pasos, que la mezcla antes de desechar es la
// que da el motor con las mismas cantidades y que se dispara la regla del modelo 'ksp-AgCl'.
// Variantes negativas: sin protección no se recoge; con la probeta sucia no se mide el segundo reactivo.
#include "Misc/AutomationTest.h"

#include "ExpPartida.h"

using namespace ExperimentaChem;

namespace
{
	/** Mantiene el clic sobre el objetivo hasta tener al menos Ml en la probeta, en fotogramas de 1/60 s. */
	bool Medir(FExpPartida& P, double Ml)
	{
		P.Apuntar(TEXT("hood-cylinder"));
		P.PulsarUsar();
		for (int Fotograma = 0; Fotograma < 60 * 30 && P.Campana().Cylinder.Ml < Ml; ++Fotograma) { P.Avanzar(1.0 / 60.0); }
		P.SoltarUsar();
		return P.Campana().Cylinder.Ml >= Ml;
	}

	void Esperar(FExpPartida& P, double Segundos)
	{
		for (double T = 0.0; T < Segundos; T += 1.0 / 60.0) { P.Avanzar(1.0 / 60.0); }
	}

	FString PrimerPasoPendiente(const FExpPartida& P)
	{
		for (const FExpPaso& Paso : P.Pasos()) { if (!Paso.bHecho) { return Paso.Clave; } }
		return TEXT("(ninguno)");
	}
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FExpJuegoClorurosTest, "Experimenta.Juego.Cloruros",
	EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FExpJuegoClorurosTest::RunTest(const FString& Parameters)
{
	FExpPartida P;
	const int AgNO3 = FindReagent("agno3"), NaCl = FindReagent("nacl");
	TestTrue(TEXT("reactivos del modelo"), AgNO3 >= 0 && NaCl >= 0);

	// 1. Tablero: abre el panel y E elige la práctica.
	P.Apuntar(TEXT("recipe-board")); P.PulsarUsar();
	TestTrue(TEXT("panel de prácticas abierto"), P.PanelPracticas());
	P.PulsarUsar();
	TestTrue(TEXT("práctica elegida"), P.PracticaElegida());
	TestEqual(TEXT("título"), P.TituloPractica(), FString(TEXT("Prueba de cloruros")));
	TestEqual(TEXT("primer paso"), PrimerPasoPendiente(P), FString(TEXT("ppe")));

	// Negativo: sin protección no se coge el frasco.
	P.Apuntar(TEXT("reagent:agno3")); P.PulsarUsar();
	TestEqual(TEXT("sin protección el frasco sigue en la estantería"), P.Campana().Places[AgNO3], EPlace::Shelf);

	// 2. Protección.
	P.Apuntar(TEXT("ppe-goggles")); P.PulsarUsar();
	P.Apuntar(TEXT("ppe-gloves")); P.PulsarUsar();
	TestEqual(TEXT("tras la protección"), PrimerPasoPendiente(P), FString(TEXT("collect")));

	// 3. Reactivos: AgNO3 en la mano derecha (la activa al empezar) y NaCl en la izquierda.
	P.Apuntar(TEXT("reagent:agno3")); P.PulsarUsar();
	P.Mano(EHand::Left);
	P.Apuntar(TEXT("reagent:nacl")); P.PulsarUsar();
	TestEqual(TEXT("AgNO3 en la mano derecha"), P.Campana().Places[AgNO3], EPlace::Right);
	TestEqual(TEXT("NaCl en la mano izquierda"), P.Campana().Places[NaCl], EPlace::Left);
	TestEqual(TEXT("reactivos reunidos"), PrimerPasoPendiente(P), FString(TEXT("add-0")));

	// 4. Medir 20 mL de AgNO3 manteniendo el clic sobre la probeta.
	P.Mano(EHand::Right);
	TestTrue(TEXT("20 mL medidos"), Medir(P, 20.0));
	TestEqual(TEXT("probeta con AgNO3"), P.Campana().Cylinder.Reagent, AgNO3);
	// 5. Mano libre: el frasco a la bandeja de la campana (Q) y E sobre la probeta la vierte (1,5 s).
	P.Apuntar(TEXT("hood-cylinder")); P.Dejar();
	TestEqual(TEXT("AgNO3 en la bandeja"), P.Campana().Places[AgNO3], EPlace::Hood);
	P.PulsarUsar();
	TestTrue(TEXT("transferencia en curso"), P.ProgresoTransferencia() >= 0.0);
	Esperar(P, 2.0);
	const double MlAgNO3 = P.Campana().Mixture.Additions.empty() ? 0.0 : P.Campana().Mixture.Additions[0].Amount;
	TestTrue(TEXT("AgNO3 en el matraz"), MlAgNO3 >= 18.0);
	TestEqual(TEXT("paso de AgNO3 hecho"), PrimerPasoPendiente(P), FString(TEXT("add-1")));

	// Negativo: con la probeta sucia de AgNO3 no se mide NaCl.
	P.Mano(EHand::Left);
	P.Apuntar(TEXT("hood-cylinder")); P.PulsarUsar(); Esperar(P, 1.0); P.SoltarUsar();
	TestTrue(TEXT("la probeta sucia no admite otro reactivo"), P.Campana().Cylinder.Ml <= 0.0);

	// 6. Enjuagar con la piseta (0,9 s).
	P.Apuntar(TEXT("hood-washbottle")); P.PulsarUsar(); Esperar(P, 1.2);
	TestEqual(TEXT("probeta limpia"), P.Campana().Cylinder.Dirty, -1);

	// 7. Medir 5 mL de NaCl, dejar el frasco y verter.
	TestTrue(TEXT("5 mL medidos"), Medir(P, 5.0));
	P.Apuntar(TEXT("hood-cylinder")); P.Dejar(); P.PulsarUsar(); Esperar(P, 2.0);
	TestTrue(TEXT("regla del modelo ksp-AgCl"), P.ReglasDisparadas().Contains(TEXT("ksp-AgCl")));
	TestTrue(TEXT("precipitado de AgCl"), P.PrecipitadoGramos() > 0.0);
	TestEqual(TEXT("observado"), PrimerPasoPendiente(P), FString(TEXT("save")));

	// La mezcla del matraz es exactamente la del motor con las mismas cantidades.
	const FMixture& Mezcla = P.Campana().Mixture;
	if (TestEqual(TEXT("dos adiciones"), static_cast<int32>(Mezcla.Additions.size()), 2))
	{
		auto A = AddReagent(EmptyMixture(), "agno3", Mezcla.Additions[0].Amount);
		auto B = AddReagent(A.Value.Mixture, "nacl", Mezcla.Additions[1].Amount);
		const FAnalysis Directo = AnalyzeMixture(B.Value.Mixture), Juego = AnalyzeMixture(Mezcla);
		TestEqual(TEXT("volumen"), Juego.VolumeMl, Directo.VolumeMl);
		TestTrue(TEXT("sólidos"), Juego.Solids.size() == Directo.Solids.size() && !Juego.Solids.empty() && Juego.Solids[0].Grams == Directo.Solids[0].Grams);
		AddInfo(FString::Printf(TEXT("AgNO3 %.1f mL + NaCl %.1f mL -> %s %.4f g"), Mezcla.Additions[0].Amount, Mezcla.Additions[1].Amount,
			*P.PrecipitadoNombre(), P.PrecipitadoGramos()));
	}

	// 8. Anotar (E en el matraz con la mano libre) y desechar en residuos (1,5 s).
	P.Apuntar(TEXT("hood")); P.PulsarUsar();
	TestEqual(TEXT("anotado"), PrimerPasoPendiente(P), FString(TEXT("dispose")));
	P.Apuntar(TEXT("hood-waste")); P.PulsarUsar(); Esperar(P, 2.0);
	TestTrue(TEXT("matraz vacío"), P.Campana().Mixture.Additions.empty());
	TestTrue(TEXT("práctica completa"), P.PracticaCompleta());
	TestTrue(TEXT("el resultado se conserva tras desechar"), P.PrecipitadoGramos() > 0.0);
	return true;
}
