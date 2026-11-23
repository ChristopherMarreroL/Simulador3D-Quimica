#include "ExpHud.h"

#include "Blueprint/WidgetTree.h"
#include "Components/Border.h"
#include "Components/Button.h"
#include "Components/CanvasPanel.h"
#include "Components/CanvasPanelSlot.h"
#include "Components/ProgressBar.h"
#include "Components/TextBlock.h"
#include "Components/VerticalBox.h"
#include "Components/VerticalBoxSlot.h"
#include "Engine/Engine.h"
#include "Engine/World.h"
#include "GameFramework/PlayerController.h"
#include "Kismet/KismetSystemLibrary.h"
#include "Styling/CoreStyle.h"

#include "ExpJuego.h"
#include "ExpPersonaje.h"

using namespace ExperimentaChem;

namespace
{
	const FLinearColor Oro(1.0f, 0.74f, 0.18f, 1.0f);
	const FLinearColor Fondo(0.02f, 0.025f, 0.035f, 0.72f);

	UTextBlock* Texto(UWidgetTree* Arbol, int32 Tam, const FLinearColor& Color = FLinearColor::White, bool bNegrita = false)
	{
		UTextBlock* T = Arbol->ConstructWidget<UTextBlock>();
		T->SetFont(FCoreStyle::GetDefaultFontStyle(bNegrita ? "Bold" : "Regular", Tam));
		T->SetColorAndOpacity(FSlateColor(Color));
		T->SetAutoWrapText(true);
		T->SetShadowOffset(FVector2D(1.0, 1.0));
		T->SetShadowColorAndOpacity(FLinearColor(0, 0, 0, 0.6f));
		return T;
	}

	UBorder* Caja(UWidgetTree* Arbol, UWidget* Dentro, const FLinearColor& Color = Fondo)
	{
		UBorder* B = Arbol->ConstructWidget<UBorder>();
		B->SetBrushColor(Color);
		B->SetPadding(FMargin(14.0f, 10.0f));
		B->SetContent(Dentro);
		return B;
	}

	UCanvasPanelSlot* Poner(UCanvasPanel* Lienzo, UWidget* W, const FAnchors& Ancla, const FVector2D& Alineacion, const FVector2D& Posicion,
		const FVector2D& Tam = FVector2D::ZeroVector)
	{
		UCanvasPanelSlot* S = Lienzo->AddChildToCanvas(W);
		S->SetAnchors(Ancla);
		S->SetAlignment(Alineacion);
		S->SetPosition(Posicion);
		if (Tam.IsZero()) { S->SetAutoSize(true); } else { S->SetSize(Tam); }
		return S;
	}

	FString NombreReactivo(int32 Indice)
	{
		return Indice >= 0 ? FExpPartida::Texto(GetReagents()[static_cast<size_t>(Indice)].Name) : FString(TEXT("vacía"));
	}
}

// ---------------------------------------------------------------- HUD

void UExpHud::NativeOnInitialized()
{
	Super::NativeOnInitialized();
	UCanvasPanel* Lienzo = WidgetTree->ConstructWidget<UCanvasPanel>();
	WidgetTree->RootWidget = Lienzo;

	Mira = Texto(WidgetTree, 16);
	Mira->SetText(FText::FromString(TEXT("+")));
	Poner(Lienzo, Mira, FAnchors(0.5f, 0.5f), FVector2D(0.5f, 0.5f), FVector2D::ZeroVector);

	Aviso = Texto(WidgetTree, 15);
	Aviso->SetJustification(ETextJustify::Center);
	Poner(Lienzo, Aviso, FAnchors(0.5f, 0.5f), FVector2D(0.5f, 0.0f), FVector2D(0.0f, 26.0f), FVector2D(640.0f, 70.0f));

	// Panel de tarea arriba a la izquierda.
	UVerticalBox* Columna = WidgetTree->ConstructWidget<UVerticalBox>();
	Titulo = Texto(WidgetTree, 18, Oro, true);
	Ecuacion = Texto(WidgetTree, 13, FLinearColor(0.85f, 0.88f, 0.92f));
	Progreso = WidgetTree->ConstructWidget<UProgressBar>();
	Progreso->SetFillColorAndOpacity(Oro);
	Contador = Texto(WidgetTree, 12, FLinearColor(0.75f, 0.78f, 0.82f));
	Lista = WidgetTree->ConstructWidget<UVerticalBox>();
	Detalle = Texto(WidgetTree, 12, FLinearColor(0.80f, 0.84f, 0.90f));
	for (UWidget* W : { static_cast<UWidget*>(Titulo), static_cast<UWidget*>(Ecuacion), static_cast<UWidget*>(Progreso),
		static_cast<UWidget*>(Contador), static_cast<UWidget*>(Lista), static_cast<UWidget*>(Detalle) })
	{
		UVerticalBoxSlot* S = Columna->AddChildToVerticalBox(W);
		S->SetPadding(FMargin(0.0f, 2.0f));
	}
	for (int32 I = 0; I < 9; ++I)
	{
		UTextBlock* L = Texto(WidgetTree, 13);
		Lista->AddChildToVerticalBox(L)->SetPadding(FMargin(0.0f, 1.0f));
		Lineas.Add(L);
	}
	Panel = Caja(WidgetTree, Columna);
	Poner(Lienzo, Panel, FAnchors(0.0f, 0.0f), FVector2D(0.0f, 0.0f), FVector2D(24.0f, 24.0f), FVector2D(430.0f, 0.0f))->SetAutoSize(true);

	// Mensaje de la capa de estado, sobre las manos.
	Mensaje = Texto(WidgetTree, 15);
	Mensaje->SetJustification(ETextJustify::Center);
	UBorder* CajaMensaje = Caja(WidgetTree, Mensaje, FLinearColor(0.02f, 0.025f, 0.035f, 0.55f));
	Poner(Lienzo, CajaMensaje, FAnchors(0.5f, 1.0f), FVector2D(0.5f, 1.0f), FVector2D(0.0f, -112.0f), FVector2D(760.0f, 0.0f))->SetAutoSize(true);

	// Casillas de las manos.
	for (int32 I = 0; I < 2; ++I)
	{
		TextoMano[I] = Texto(WidgetTree, 14);
		CajaMano[I] = Caja(WidgetTree, TextoMano[I]);
		Poner(Lienzo, CajaMano[I], FAnchors(0.5f, 1.0f), FVector2D(I == 0 ? 1.0f : 0.0f, 1.0f), FVector2D(I == 0 ? -10.0f : 10.0f, -24.0f), FVector2D(300.0f, 72.0f));
	}

	Ayuda = Texto(WidgetTree, 11, FLinearColor(0.75f, 0.78f, 0.82f, 0.9f));
	Ayuda->SetText(FText::FromString(TEXT("WASD mover · Mayús correr · E / clic usar (mantener para verter) · Q dejar · 1 / 2 mano · N anotar · Clic dcho. de cerca · Esc menú")));
	Ayuda->SetJustification(ETextJustify::Right);
	Poner(Lienzo, Ayuda, FAnchors(1.0f, 1.0f), FVector2D(1.0f, 1.0f), FVector2D(-20.0f, -8.0f), FVector2D(560.0f, 40.0f));

	TextoResultado = Texto(WidgetTree, 17);
	TextoResultado->SetJustification(ETextJustify::Center);
	Resultado = Caja(WidgetTree, TextoResultado, FLinearColor(0.03f, 0.05f, 0.04f, 0.85f));
	Resultado->SetPadding(FMargin(28.0f, 20.0f));
	Poner(Lienzo, Resultado, FAnchors(0.5f, 0.0f), FVector2D(0.5f, 0.0f), FVector2D(0.0f, 40.0f), FVector2D(620.0f, 0.0f))->SetAutoSize(true);
	Resultado->SetVisibility(ESlateVisibility::Collapsed);
}

void UExpHud::Actualizar(const UExpSubsistema& S, const AExpPersonaje& Jugador)
{
	const FExpPartida& P = S.Partida();
	const FHood& H = P.Campana();
	Aviso->SetText(FText::FromString(Jugador.Aviso()));
	Mira->SetColorAndOpacity(FSlateColor(Jugador.Apuntado() ? Oro : FLinearColor(1, 1, 1, 0.85f)));

	// Panel de tarea.
	const TArray<FExpPaso>& Pasos = S.PasosCache();
	if (Pasos.Num() == 0)
	{
		Titulo->SetText(FText::FromString(TEXT("Experimenta 3D · Campana")));
		Ecuacion->SetText(FText::FromString(TEXT("Laboratorio virtual interactivo")));
		Progreso->SetPercent(0.0f);
		Contador->SetText(FText::FromString(TEXT("Sin práctica elegida")));
		for (int32 I = 0; I < Lineas.Num(); ++I)
		{
			Lineas[I]->SetText(FText::FromString(I == 0 ? TEXT("▶  Elige la práctica en el tablero de la pared (E)") : TEXT("")));
			Lineas[I]->SetVisibility(I == 0 ? ESlateVisibility::Visible : ESlateVisibility::Collapsed);
		}
		Detalle->SetText(FText::GetEmpty());
	}
	else
	{
		int32 Hechos = 0;
		for (const FExpPaso& Paso : Pasos) { Hechos += Paso.bHecho ? 1 : 0; }
		Titulo->SetText(FText::FromString(P.TituloPractica()));
		Ecuacion->SetText(FText::FromString(P.EcuacionPractica()));
		Progreso->SetPercent(static_cast<float>(Hechos) / Pasos.Num());
		Contador->SetText(FText::FromString(FString::Printf(TEXT("Paso %d de %d"), FMath::Min(Hechos + 1, Pasos.Num()), Pasos.Num())));
		bool bActual = true;
		FString DetalleActual;
		for (int32 I = 0; I < Lineas.Num(); ++I)
		{
			if (I >= Pasos.Num()) { Lineas[I]->SetVisibility(ESlateVisibility::Collapsed); continue; }
			const FExpPaso& Paso = Pasos[I];
			const bool bEsActual = !Paso.bHecho && bActual;
			if (bEsActual) { bActual = false; DetalleActual = Paso.Detalle; }
			Lineas[I]->SetVisibility(ESlateVisibility::Visible);
			Lineas[I]->SetText(FText::FromString((Paso.bHecho ? TEXT("✔  ") : bEsActual ? TEXT("▶  ") : TEXT("○  ")) + Paso.Titulo));
			Lineas[I]->SetColorAndOpacity(FSlateColor(Paso.bHecho ? FLinearColor(0.55f, 0.85f, 0.60f) : bEsActual ? Oro : FLinearColor(0.80f, 0.82f, 0.86f)));
		}
		Detalle->SetText(FText::FromString(DetalleActual));
	}

	// Mensaje y manos.
	Mensaje->SetText(FText::FromString(P.Mensaje()));
	Mensaje->GetParent()->SetVisibility(P.Mensaje().IsEmpty() ? ESlateVisibility::Collapsed : ESlateVisibility::HitTestInvisible);
	for (int32 I = 0; I < 2; ++I)
	{
		const EHand Lado = I == 0 ? EHand::Left : EHand::Right;
		const bool bActiva = P.Sesion().Hand == Lado;
		FString Contenido = NombreReactivo(H.HeldIn(Lado));
		if (P.Vertiendo() && bActiva) { Contenido += TEXT("  · vertiendo…"); }
		TextoMano[I]->SetText(FText::FromString(FString::Printf(TEXT("%d · Mano %s%s\n%s"), I + 1, I == 0 ? TEXT("izquierda") : TEXT("derecha"),
			bActiva ? TEXT(" (activa)") : TEXT(""), *Contenido)));
		CajaMano[I]->SetBrushColor(bActiva ? FLinearColor(0.25f, 0.18f, 0.03f, 0.80f) : Fondo);
		TextoMano[I]->SetColorAndOpacity(FSlateColor(bActiva ? Oro : FLinearColor(0.85f, 0.88f, 0.92f)));
	}

	// Resultado al completar: lo que calculó el modelo, no un texto fijo.
	if (P.PracticaCompleta())
	{
		const double Gramos = P.PrecipitadoGramos();
		FString Texto = TEXT("¡Experimento completado!\n\n");
		if (Gramos > 0.0)
		{
			Texto += FString::Printf(TEXT("Se formó un precipitado blanco de %s: %s g\n"), *P.PrecipitadoNombre(), *FExpPartida::Texto(FormatEs(Gramos, 4)));
		}
		const auto& Mezcla = P.UltimoAnalisis();
		if (Mezcla.has_value())
		{
			Texto += FString::Printf(TEXT("Volumen final antes de desechar: %s mL\n"), *FExpPartida::Texto(FormatEs(Mezcla->VolumeMl, 1)));
		}
		Texto += TEXT("Reglas del modelo: ") + FString::Join(P.ReglasDisparadas(), TEXT(", ")) + TEXT("\n\nEsc · menú (puedes repetir la práctica)");
		TextoResultado->SetText(FText::FromString(Texto));
		Resultado->SetVisibility(ESlateVisibility::HitTestInvisible);
	}
	else { Resultado->SetVisibility(ESlateVisibility::Collapsed); }
}

// ---------------------------------------------------------------- Menú de pausa

int32 UExpMenuPausa::CalidadActual = 1;

void UExpMenuPausa::AplicarCalidad(UWorld* Mundo, int32 Nivel)
{
	CalidadActual = FMath::Clamp(Nivel, 0, 2);
	static const TCHAR* Grupos[] = { TEXT("ViewDistanceQuality"), TEXT("AntiAliasingQuality"), TEXT("ShadowQuality"), TEXT("GlobalIlluminationQuality"),
		TEXT("ReflectionQuality"), TEXT("PostProcessQuality"), TEXT("TextureQuality"), TEXT("EffectsQuality"), TEXT("FoliageQuality"),
		TEXT("ShadingQuality"), TEXT("LandscapeQuality") };
	TArray<FString> Ordenes;
	for (const TCHAR* G : Grupos) { Ordenes.Add(FString::Printf(TEXT("sg.%s %d"), G, CalidadActual)); }
	Ordenes.Append({ TEXT("r.DynamicGlobalIlluminationMethod 0"), TEXT("r.ReflectionMethod 2"), TEXT("r.Shadow.Virtual.Enable 0"), TEXT("r.AntiAliasingMethod 2") });
	if (CalidadActual == 0)
	{
		Ordenes.Append({ TEXT("r.TemporalAA.Upsampling 1"), TEXT("r.ScreenPercentage 75"), TEXT("r.SSR.Quality 0"), TEXT("r.AmbientOcclusionLevels 0"), TEXT("r.BloomQuality 1") });
	}
	else if (CalidadActual == 1)
	{
		Ordenes.Append({ TEXT("r.ScreenPercentage 100"), TEXT("r.SSR.Quality 1"), TEXT("r.AmbientOcclusionLevels 1") });
	}
	else
	{
		Ordenes.Append({ TEXT("r.ScreenPercentage 100"), TEXT("r.SSR.Quality 3"), TEXT("r.AmbientOcclusionLevels -1") });
	}
	for (const FString& Orden : Ordenes) { GEngine->Exec(Mundo, *Orden); }
}

void UExpMenuPausa::NativeOnInitialized()
{
	Super::NativeOnInitialized();
	UCanvasPanel* Lienzo = WidgetTree->ConstructWidget<UCanvasPanel>();
	WidgetTree->RootWidget = Lienzo;
	UBorder* Velo = WidgetTree->ConstructWidget<UBorder>();
	Velo->SetBrushColor(FLinearColor(0, 0, 0, 0.45f));
	UCanvasPanelSlot* SV = Lienzo->AddChildToCanvas(Velo);
	SV->SetAnchors(FAnchors(0.0f, 0.0f, 1.0f, 1.0f));
	SV->SetOffsets(FMargin(0.0f));

	UVerticalBox* Columna = WidgetTree->ConstructWidget<UVerticalBox>();
	UTextBlock* Cabecera = Texto(WidgetTree, 24, Oro, true);
	Cabecera->SetText(FText::FromString(TEXT("Pausa")));
	Columna->AddChildToVerticalBox(Cabecera)->SetPadding(FMargin(0, 0, 0, 12));
	auto Boton = [this, Columna](const TCHAR* Rotulo, void (UExpMenuPausa::*Accion)())
	{
		UButton* B = WidgetTree->ConstructWidget<UButton>();
		UTextBlock* T = Texto(WidgetTree, 16, FLinearColor(0.05f, 0.05f, 0.06f));
		T->SetText(FText::FromString(Rotulo));
		T->SetJustification(ETextJustify::Center);
		T->SetShadowOffset(FVector2D::ZeroVector);
		B->AddChild(T);
		if (Accion == &UExpMenuPausa::AlContinuar) { B->OnClicked.AddDynamic(this, &UExpMenuPausa::AlContinuar); }
		else if (Accion == &UExpMenuPausa::AlBaja) { B->OnClicked.AddDynamic(this, &UExpMenuPausa::AlBaja); }
		else if (Accion == &UExpMenuPausa::AlMedia) { B->OnClicked.AddDynamic(this, &UExpMenuPausa::AlMedia); }
		else if (Accion == &UExpMenuPausa::AlAlta) { B->OnClicked.AddDynamic(this, &UExpMenuPausa::AlAlta); }
		else { B->OnClicked.AddDynamic(this, &UExpMenuPausa::AlSalir); }
		Columna->AddChildToVerticalBox(B)->SetPadding(FMargin(0, 4));
	};
	Boton(TEXT("Continuar"), &UExpMenuPausa::AlContinuar);
	UTextBlock* Calidad = Texto(WidgetTree, 14, FLinearColor(0.85f, 0.88f, 0.92f));
	Calidad->SetText(FText::FromString(TEXT("Calidad gráfica")));
	Columna->AddChildToVerticalBox(Calidad)->SetPadding(FMargin(0, 14, 0, 2));
	Boton(TEXT("Baja"), &UExpMenuPausa::AlBaja);
	Boton(TEXT("Media (recomendada)"), &UExpMenuPausa::AlMedia);
	Boton(TEXT("Alta"), &UExpMenuPausa::AlAlta);
	Estado = Texto(WidgetTree, 13, FLinearColor(0.75f, 0.78f, 0.82f));
	Columna->AddChildToVerticalBox(Estado)->SetPadding(FMargin(0, 6, 0, 14));
	Boton(TEXT("Salir del juego"), &UExpMenuPausa::AlSalir);

	UBorder* Marco = Caja(WidgetTree, Columna, FLinearColor(0.03f, 0.035f, 0.05f, 0.92f));
	Marco->SetPadding(FMargin(32.0f, 24.0f));
	UCanvasPanelSlot* SM = Lienzo->AddChildToCanvas(Marco);
	SM->SetAnchors(FAnchors(0.5f, 0.5f));
	SM->SetAlignment(FVector2D(0.5f, 0.5f));
	SM->SetAutoSize(true);
	Refrescar();
}

void UExpMenuPausa::Refrescar()
{
	static const TCHAR* Nombres[] = { TEXT("Baja"), TEXT("Media"), TEXT("Alta") };
	if (Estado) { Estado->SetText(FText::FromString(FString::Printf(TEXT("Actual: %s"), Nombres[CalidadActual]))); }
}

void UExpMenuPausa::AlContinuar()
{
	if (APlayerController* PC = GetOwningPlayer())
	{
		if (AExpPersonaje* J = Cast<AExpPersonaje>(PC->GetPawn())) { J->DoPausa(); }
	}
}

void UExpMenuPausa::AlBaja() { AplicarCalidad(GetWorld(), 0); Refrescar(); }
void UExpMenuPausa::AlMedia() { AplicarCalidad(GetWorld(), 1); Refrescar(); }
void UExpMenuPausa::AlAlta() { AplicarCalidad(GetWorld(), 2); Refrescar(); }

void UExpMenuPausa::AlSalir()
{
	UKismetSystemLibrary::QuitGame(this, GetOwningPlayer(), EQuitPreference::Quit, false);
}
