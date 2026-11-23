#include "ExpJuego.h"

#include "Components/BoxComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Components/TextRenderComponent.h"
#include "Engine/World.h"

#include "ExpPersonaje.h"
#include "LiquidoComponent.h"
#include "MezclaComponent.h"

using namespace ExperimentaChem;

// ---------------------------------------------------------------- Subsistema

void UExpSubsistema::Tick(float DeltaTime)
{
	Juego.Avanzar(FMath::Min(static_cast<double>(DeltaTime), 0.1));
	Pasos = Juego.Pasos();
	Guia.Reset();
	for (const FExpPaso& Paso : Pasos)
	{
		if (!Paso.bHecho) { Guia = Paso.Objetivos; break; }
	}
	if (!Juego.PracticaElegida()) { Guia = { TEXT("recipe-board") }; }
}

void UExpSubsistema::Registrar(AExpObjeto* Objeto)
{
	Lista.RemoveAll([](const TWeakObjectPtr<AExpObjeto>& O) { return !O.IsValid(); });
	Lista.AddUnique(Objeto);
}

AExpObjeto* UExpSubsistema::Buscar(const FString& Id) const
{
	for (const TWeakObjectPtr<AExpObjeto>& O : Lista) { if (O.IsValid() && O->TargetId == Id) { return O.Get(); } }
	return nullptr;
}

AExpObjeto* UExpSubsistema::PrimeroDeTipo(uint8 InTipo) const
{
	for (const TWeakObjectPtr<AExpObjeto>& O : Lista) { if (O.IsValid() && static_cast<uint8>(O->Tipo) == InTipo) { return O.Get(); } }
	return nullptr;
}

// ---------------------------------------------------------------- Objeto

AExpObjeto::AExpObjeto()
{
	PrimaryActorTick.bCanEverTick = true;
	Raiz = CreateDefaultSubobject<USceneComponent>(TEXT("Raiz"));
	RootComponent = Raiz;
	Pivote = CreateDefaultSubobject<USceneComponent>(TEXT("Pivote"));
	Pivote->SetupAttachment(Raiz);

	auto Malla = [this](const TCHAR* Id)
	{
		UStaticMeshComponent* C = CreateDefaultSubobject<UStaticMeshComponent>(Id);
		C->SetupAttachment(Pivote);
		C->SetMobility(EComponentMobility::Movable);
		C->SetCollisionEnabled(ECollisionEnabled::NoCollision);
		return C;
	};
	Cuerpo = Malla(TEXT("Cuerpo"));
	// El cuerpo bloquea el paso del jugador (colisión simple de la malla); la puntería usa la zona.
	Cuerpo->SetCollisionEnabled(ECollisionEnabled::QueryAndPhysics);
	Cuerpo->SetCollisionResponseToAllChannels(ECR_Block);
	Cuerpo->SetCollisionResponseToChannel(ECC_Visibility, ECR_Ignore);
	Extra = Malla(TEXT("Extra"));
	Tapa = Malla(TEXT("Tapa"));

	Liquido = CreateDefaultSubobject<ULiquidoComponent>(TEXT("Liquido"));
	Liquido->SetupAttachment(Pivote);
	Sedimento = CreateDefaultSubobject<ULiquidoComponent>(TEXT("Sedimento"));
	Sedimento->SetupAttachment(Pivote);
	Mezcla = CreateDefaultSubobject<UMezclaComponent>(TEXT("Mezcla"));

	Rotulo = CreateDefaultSubobject<UTextRenderComponent>(TEXT("Rotulo"));
	Rotulo->SetupAttachment(Pivote);
	Rotulo->SetHorizontalAlignment(EHTA_Center);
	Rotulo->SetVerticalAlignment(EVRTA_TextCenter);
	Rotulo->SetWorldSize(1.2f);
	Rotulo->SetTextRenderColor(FColor(20, 20, 24));
	Rotulo->SetCastShadow(false);

	Marca = CreateDefaultSubobject<UTextRenderComponent>(TEXT("Marca"));
	Marca->SetupAttachment(Raiz);
	Marca->SetHorizontalAlignment(EHTA_Center);
	Marca->SetVerticalAlignment(EVRTA_TextCenter);
	Marca->SetWorldSize(7.0f);
	Marca->SetText(FText::FromString(TEXT("V")));
	Marca->SetTextRenderColor(FColor(255, 190, 40));
	Marca->SetCastShadow(false);
	Marca->SetVisibility(false);

	Zona = CreateDefaultSubobject<UBoxComponent>(TEXT("Zona"));
	Zona->SetupAttachment(Pivote);
	Zona->SetCollisionEnabled(ECollisionEnabled::QueryOnly);
	Zona->SetCollisionResponseToAllChannels(ECR_Ignore);
	Zona->SetCollisionResponseToChannel(ECC_Visibility, ECR_Block);
	Zona->SetGenerateOverlapEvents(false);
}

void AExpObjeto::OnConstruction(const FTransform& Transform)
{
	Super::OnConstruction(Transform);
	Configurar();
}

void AExpObjeto::Configurar()
{
	Zona->SetBoxExtent(ZonaExtension);
	Zona->SetRelativeLocation(ZonaCentro);
	Mezcla->Liquido = Tipo == EExpTipo::Matraz ? Liquido.Get() : nullptr;
	Mezcla->Sedimento = Tipo == EExpTipo::Matraz ? Sedimento.Get() : nullptr;
	Mezcla->SetComponentTickEnabled(Tipo == EExpTipo::Matraz);
	Marca->SetRelativeLocation(FVector(0.0, 0.0, ZonaCentro.Z + ZonaExtension.Z + 9.0));
}

void AExpObjeto::BeginPlay()
{
	Super::BeginPlay();
	Configurar();
	Origen = GetActorTransform();
	if (Tipo == EExpTipo::Frasco && Nombre.IsEmpty())
	{
		const int32 Indice = IndiceReactivo();
		if (Indice >= 0) { Nombre = FExpPartida::Texto(GetReagents()[static_cast<size_t>(Indice)].Name); }
	}
	if (UExpSubsistema* S = GetWorld()->GetSubsystem<UExpSubsistema>()) { S->Registrar(this); }
	if (Tipo != EExpTipo::Matraz && Tipo != EExpTipo::Probeta) { Liquido->SetVisibility(false); }
	if (Tipo != EExpTipo::Matraz) { Sedimento->SetVisibility(false); }
	if (Tipo == EExpTipo::Matraz) { Mezcla->Vaciar(); }
	if (Tipo == EExpTipo::Probeta) { Liquido->FijarVolumenML(0.0f); }
}

int32 AExpObjeto::IndiceReactivo() const
{
	if (ReactivoId.IsEmpty()) { return -1; }
	return FindReagent(FExpPartida::Utf8(ReactivoId));
}

FVector AExpObjeto::Boca() const
{
	return Pivote->GetComponentTransform().TransformPosition(FVector(0.0, 0.0, BocaCm));
}

FTransform AExpObjeto::Hueco(int32 Indice) const
{
	// Bandeja de 8 frascos: dos filas de cuatro (separación de diseño: 9 cm).
	const FVector Local((Indice % 4) * -9.5, (Indice / 4) * 10.0, 0.0);
	return FTransform(GetActorRotation(), GetActorTransform().TransformPosition(Local));
}

void AExpObjeto::FijarApuntado(bool bNuevo)
{
	if (bNuevo == bApuntado) { return; }
	bApuntado = bNuevo;
	for (UStaticMeshComponent* C : { Cuerpo.Get(), Tapa.Get(), Extra.Get() })
	{
		if (C && C->GetStaticMesh()) { C->SetOverlayMaterial(bApuntado ? MaterialContorno.Get() : nullptr); }
	}
}

void AExpObjeto::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	Reloj += DeltaSeconds;
	UExpSubsistema* S = GetWorld()->GetSubsystem<UExpSubsistema>();
	if (!S) { return; }
	Recolocar(*S, DeltaSeconds);
	const bool bGuia = S->ObjetivosGuia().Contains(TargetId) && !IsHidden() && GetAttachParentActor() == nullptr;
	Marca->SetVisibility(bGuia);
	if (bGuia)
	{
		Marca->SetRelativeLocation(FVector(0.0, 0.0, ZonaCentro.Z + ZonaExtension.Z + 9.0 + 2.0 * FMath::Sin(Reloj * 3.0f)));
		if (const AExpPersonaje* J = S->Jugador.Get())
		{
			const FVector Hacia = J->GetActorLocation() - Marca->GetComponentLocation();
			Marca->SetWorldRotation(FRotator(0.0, Hacia.Rotation().Yaw, 0.0));
		}
	}
}

void AExpObjeto::Recolocar(UExpSubsistema& S, float DeltaSeconds)
{
	const FExpPartida& P = S.Partida();
	const FHood& H = P.Campana();
	AExpPersonaje* Jugador = S.Jugador.Get();

	auto Transferencia = [&H](ETransfer Tipo) { return H.Transfer.has_value() && H.Transfer->Kind == Tipo; };
	// Coreografía sencilla de una transferencia temporizada: ir (0–0,3), inclinar y verter (0,3–0,8), volver.
	auto Coreografia = [this](double Progreso, const FVector& Destino, float Grados)
	{
		const double Ida = FMath::Clamp(Progreso / 0.3, 0.0, 1.0), Vuelta = FMath::Clamp((Progreso - 0.8) / 0.2, 0.0, 1.0);
		const double Mezcla01 = FMath::InterpEaseInOut(0.0, 1.0, Ida, 2.0) * (1.0 - FMath::InterpEaseInOut(0.0, 1.0, Vuelta, 2.0));
		const double Giro = FMath::Clamp((Progreso - 0.25) / 0.2, 0.0, 1.0) * (1.0 - Vuelta);
		Pivote->SetWorldLocation(FMath::Lerp(GetActorLocation(), Destino, Mezcla01));
		Pivote->SetWorldRotation(FRotator(0.0, GetActorRotation().Yaw, -Grados * Giro));
	};
	auto Reposo = [this]()
	{
		Pivote->SetRelativeLocationAndRotation(FVector::ZeroVector, FRotator::ZeroRotator);
	};

	switch (Tipo)
	{
	case EExpTipo::Frasco:
	{
		const int32 Indice = IndiceReactivo();
		if (Indice < 0) { return; }
		const EPlace Lugar = H.Places[static_cast<size_t>(Indice)];
		const bool bEnMano = Lugar == EPlace::Left || Lugar == EPlace::Right;
		if (bEnMano && Jugador)
		{
			USceneComponent* Agarre = Jugador->Agarre(Lugar == EPlace::Left ? EHand::Left : EHand::Right);
			if (GetRootComponent()->GetAttachParent() != Agarre)
			{
				AttachToComponent(Agarre, FAttachmentTransformRules::SnapToTargetNotIncludingScale);
				Zona->SetCollisionEnabled(ECollisionEnabled::NoCollision);
				Cuerpo->SetCollisionEnabled(ECollisionEnabled::NoCollision);
			}
			// Destapado mientras está en la mano (la tapa es solo visual: la capa de estado no la modela).
			Tapa->SetVisibility(false);
			return;
		}
		if (GetRootComponent()->GetAttachParent())
		{
			DetachFromActor(FDetachmentTransformRules::KeepWorldTransform);
			Zona->SetCollisionEnabled(ECollisionEnabled::QueryOnly);
			Cuerpo->SetCollisionEnabled(ECollisionEnabled::QueryAndPhysics);
		}
		Tapa->SetVisibility(true);
		Reposo();
		if (Lugar == EPlace::Hood)
		{
			int32 Hueco = 0;
			for (const int Otro : GetShelfOrder())
			{
				if (Otro == Indice) { break; }
				if (H.Places[static_cast<size_t>(Otro)] == EPlace::Hood) { ++Hueco; }
			}
			if (const AExpObjeto* Bandeja = S.PrimeroDeTipo(static_cast<uint8>(EExpTipo::Bandeja)))
			{
				SetActorTransform(Bandeja->Hueco(Hueco));
				return;
			}
		}
		SetActorTransform(Origen);
		return;
	}
	case EExpTipo::Proteccion:
	{
		const bool bPuesto = TargetId == TEXT("ppe-goggles") ? P.Sesion().Ppe.bGoggles : P.Sesion().Ppe.bGloves;
		SetActorHiddenInGame(bPuesto);
		Zona->SetCollisionEnabled(bPuesto ? ECollisionEnabled::NoCollision : ECollisionEnabled::QueryOnly);
		return;
	}
	case EExpTipo::Probeta:
	{
		const float Ml = static_cast<float>(H.Cylinder.Ml);
		if (!FMath::IsNearlyEqual(Liquido->VolumenML, Ml, 0.01f)) { Liquido->FijarVolumenML(Ml); }
		const AExpObjeto* Matraz = S.Buscar(TEXT("hood"));
		if (Transferencia(ETransfer::Cylinder) && Matraz)
		{
			Coreografia(P.ProgresoTransferencia(), Matraz->Boca() + FVector(0.0, 9.0, 16.0), 105.0f);
		}
		else { Reposo(); }
		return;
	}
	case EExpTipo::Piseta:
	{
		const AExpObjeto* Probeta = S.Buscar(TEXT("hood-cylinder"));
		if (Transferencia(ETransfer::Rinse) && Probeta) { Coreografia(P.ProgresoTransferencia(), Probeta->Boca() + FVector(0.0, 8.0, 10.0), 40.0f); }
		else { Reposo(); }
		return;
	}
	case EExpTipo::Matraz:
	{
		double Firma = static_cast<double>(H.Mixture.Additions.size()) * 1.0e6 + static_cast<double>(H.Disposals) * 1.0e3;
		for (const FAddition& A : H.Mixture.Additions) { Firma += A.Amount; }
		if (Firma != FirmaMezcla)
		{
			FirmaMezcla = Firma;
			Mezcla->FijarMezcla(H.Mixture);
		}
		const AExpObjeto* Residuos = S.Buscar(TEXT("hood-waste"));
		if (Transferencia(ETransfer::Waste) && Residuos) { Coreografia(P.ProgresoTransferencia(), Residuos->Boca() + FVector(0.0, 0.0, 18.0), 110.0f); }
		else { Reposo(); }
		return;
	}
	case EExpTipo::Tablero:
	{
		FString Texto;
		if (!P.PracticaElegida())
		{
			Texto = TEXT("PRACTICAS<br><br>> Prueba de cloruros<br><br>Pulsa E para elegir");
		}
		else
		{
			Texto = P.TituloPractica().ToUpper() + TEXT("<br><br>");
			bool bActual = true;
			for (const FExpPaso& Paso : S.PasosCache())
			{
				const TCHAR* Signo = Paso.bHecho ? TEXT("+ ") : (bActual ? TEXT("> ") : TEXT("- "));
				if (!Paso.bHecho) { bActual = false; }
				Texto += Signo + Paso.Titulo + TEXT("<br>");
			}
			if (P.PracticaCompleta()) { Texto += TEXT("<br>EXPERIMENTO COMPLETADO"); }
		}
		Rotulo->SetText(FText::FromString(Texto));
		return;
	}
	default:
		return;
	}
}

// ---------------------------------------------------------------- Modo de juego

AExpGameMode::AExpGameMode()
{
	DefaultPawnClass = AExpPersonaje::StaticClass();
}
