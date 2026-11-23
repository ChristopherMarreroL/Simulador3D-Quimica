#include "ExperimentaHUD.h"

#include "Engine/Canvas.h"
#include "Engine/Engine.h"
#include "Engine/Font.h"
#include "ExperimentaPersonaje.h"
#include "PracticaGuiada.h"

void AExperimentaHUD::DrawHUD()
{
	Super::DrawHUD();
	const AExperimentaPersonaje* Personaje = Cast<AExperimentaPersonaje>(GetOwningPawn());
	if (!Canvas || !Personaje)
	{
		return;
	}
	UFont* Fuente = GEngine ? GEngine->GetMediumFont() : nullptr;
	const float CX = Canvas->ClipX * 0.5f;
	const float CY = Canvas->ClipY * 0.5f;
	const FLinearColor Blanco(1.0f, 1.0f, 1.0f, 0.95f);
	const FLinearColor Tenue(1.0f, 1.0f, 1.0f, 0.55f);
	const FLinearColor Fondo(0.0f, 0.0f, 0.0f, 0.55f);
	const FLinearColor Dorado(1.0f, 0.78f, 0.25f, 1.0f);

	auto Texto = [&](const FString& Cadena, float X, float Y, const FLinearColor& Color, bool bCentrado)
	{
		float Ancho = 0.0f, Alto = 0.0f;
		GetTextSize(Cadena, Ancho, Alto, Fuente, 1.0f);
		const float X0 = bCentrado ? X - Ancho * 0.5f : X;
		DrawRect(Fondo, X0 - 8.0f, Y - 4.0f, Ancho + 16.0f, Alto + 8.0f);
		DrawText(Cadena, Color, X0, Y, Fuente, 1.0f, false);
		return Alto + 10.0f;
	};

	// Punto de mira: dorado cuando hay algo que se puede usar.
	const FString Aviso = Personaje->AvisoContextual();
	DrawRect(Aviso.IsEmpty() ? Blanco : Dorado, CX - 2.0f, CY - 2.0f, 4.0f, 4.0f);
	if (!Aviso.IsEmpty())
	{
		TArray<FString> Lineas;
		Aviso.ParseIntoArrayLines(Lineas);
		float Y = CY + 18.0f;
		for (int32 i = 0; i < Lineas.Num(); ++i)
		{
			Y += Texto(Lineas[i], CX, Y, i == 0 ? Blanco : Tenue, true);
		}
	}

	// Manos: 1 = derecha, 2 = izquierda; la seleccionada va resaltada.
	const float Base = Canvas->ClipY - 46.0f;
	for (int32 Mano = 0; Mano < 2; ++Mano)
	{
		const FString Nombre = Personaje->NombreEnMano(Mano);
		const FString Linea = FString::Printf(TEXT("%d  %s: %s"), Mano + 1, Mano == 0 ? TEXT("Mano derecha") : TEXT("Mano izquierda"),
			Nombre.IsEmpty() ? TEXT("vacía") : *Nombre);
		// La derecha se dibuja a la derecha de la pantalla, como se ve la mano.
		Texto(Linea, Mano == 0 ? CX + 20.0f : CX - 20.0f - 300.0f, Base, Personaje->ManoSeleccionada() == Mano ? Dorado : Tenue, false);
	}

	// Panel de tarea, arriba a la izquierda: título, progreso y pasos (hecho, actual, pendiente).
	if (const UPracticaGuiadaComponent* Practica = Personaje->Practica)
	{
		const TArray<FPasoPractica> Pasos = Practica->Pasos();
		const int32 Actual = Practica->PasoActual();
		const FLinearColor Verde(0.45f, 0.9f, 0.5f, 0.95f);
		int32 Hechos = 0;
		for (const FPasoPractica& Paso : Pasos)
		{
			Hechos += Paso.bHecho ? 1 : 0;
		}
		const float X = 28.0f;
		const float AnchoPanel = 620.0f;
		const float AltoPanel = 86.0f + Pasos.Num() * 26.0f + (Actual >= 0 ? 28.0f : 0.0f);
		DrawRect(FLinearColor(0.02f, 0.02f, 0.03f, 0.72f), X - 14.0f, 18.0f, AnchoPanel, AltoPanel);
		float Y = 28.0f;
		DrawText(Practica->Titulo(), Blanco, X, Y, Fuente, 1.25f, false);
		const FString Progreso = Actual >= 0 ? FString::Printf(TEXT("Paso %d de %d"), Actual + 1, Pasos.Num()) : FString(TEXT("Completada"));
		DrawText(Progreso, Tenue, X + AnchoPanel - 150.0f, Y + 4.0f, Fuente, 1.0f, false);
		Y += 30.0f;
		// Barra de progreso.
		DrawRect(FLinearColor(1.0f, 1.0f, 1.0f, 0.18f), X, Y, AnchoPanel - 28.0f, 5.0f);
		DrawRect(Dorado, X, Y, (AnchoPanel - 28.0f) * Hechos / FMath::Max(1, Pasos.Num()), 5.0f);
		Y += 16.0f;
		for (int32 i = 0; i < Pasos.Num(); ++i)
		{
			const bool bActual = i == Actual;
			if (bActual)
			{
				DrawRect(FLinearColor(1.0f, 1.0f, 1.0f, 0.10f), X - 8.0f, Y - 3.0f, AnchoPanel - 12.0f, 24.0f);
			}
			// Casilla: rellena en verde si está hecho; borde dorado en el paso actual.
			DrawRect(Pasos[i].bHecho ? Verde : (bActual ? Dorado : Tenue), X, Y + 3.0f, 12.0f, 12.0f);
			if (!Pasos[i].bHecho)
			{
				DrawRect(FLinearColor(0.02f, 0.02f, 0.03f, 1.0f), X + 2.0f, Y + 5.0f, 8.0f, 8.0f);
			}
			DrawText(Pasos[i].Titulo, Pasos[i].bHecho ? Verde : (bActual ? Blanco : Tenue), X + 22.0f, Y, Fuente, 1.0f, false);
			Y += 26.0f;
		}
		if (Actual >= 0)
		{
			DrawText(Pasos[Actual].Detalle, Tenue, X + 22.0f, Y + 2.0f, Fuente, 1.0f, false);
		}

		// Marcador dorado sobre el objeto que pide el paso actual.
		FString Etiqueta;
		if (const AActor* Objetivo = Personaje->ObjetivoGuia(Etiqueta))
		{
			FVector Origen, Extension;
			Objetivo->GetActorBounds(false, Origen, Extension);
			const FVector Pantalla = Project(Origen + FVector(0.0f, 0.0f, Extension.Z + 4.0f));
			if (Pantalla.Z > 0.0f)
			{
				float AnchoEtiqueta = 0.0f, AltoEtiqueta = 0.0f;
				GetTextSize(Etiqueta, AnchoEtiqueta, AltoEtiqueta, Fuente, 1.0f);
				const float PX = FMath::Clamp(static_cast<float>(Pantalla.X), 20.0f + AnchoEtiqueta * 0.5f, Canvas->ClipX - 20.0f - AnchoEtiqueta * 0.5f);
				const float PY = FMath::Clamp(static_cast<float>(Pantalla.Y), 60.0f, Canvas->ClipY - 90.0f);
				// Flecha hacia abajo hecha con tres franjas.
				DrawRect(Dorado, PX - 9.0f, PY - 16.0f, 18.0f, 4.0f);
				DrawRect(Dorado, PX - 6.0f, PY - 12.0f, 12.0f, 4.0f);
				DrawRect(Dorado, PX - 3.0f, PY - 8.0f, 6.0f, 4.0f);
				DrawRect(Fondo, PX - AnchoEtiqueta * 0.5f - 8.0f, PY - 44.0f, AnchoEtiqueta + 16.0f, AltoEtiqueta + 8.0f);
				DrawText(Etiqueta, Dorado, PX - AnchoEtiqueta * 0.5f, PY - 40.0f, Fuente, 1.0f, false);
			}
		}
	}

	const FString Mensaje = Personaje->MensajeActual();
	if (!Mensaje.IsEmpty())
	{
		Texto(Mensaje, CX, Canvas->ClipY * 0.72f, Blanco, true);
	}
}
