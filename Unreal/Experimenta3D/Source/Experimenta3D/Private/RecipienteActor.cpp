#include "RecipienteActor.h"

#include "Components/StaticMeshComponent.h"
#include "Components/TextRenderComponent.h"
#include "Engine/StaticMesh.h"
#include "UObject/ConstructorHelpers.h"
#include "LiquidoComponent.h"
#include "MezclaComponent.h"

ARecipienteActor::ARecipienteActor()
{
	GetStaticMeshComponent()->SetMobility(EComponentMobility::Movable);

	// Etiqueta: una placa clara pegada al frente y el texto encima. Oculta si no hay texto.
	static ConstructorHelpers::FObjectFinder<UStaticMesh> Cubo(TEXT("/Engine/BasicShapes/Cube.Cube"));
	Placa = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Placa"));
	Placa->SetupAttachment(GetStaticMeshComponent());
	Placa->SetMobility(EComponentMobility::Movable);
	Placa->SetStaticMesh(Cubo.Object);
	Placa->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	Placa->SetCastShadow(false);
	Rotulo = CreateDefaultSubobject<UTextRenderComponent>(TEXT("Rotulo"));
	Rotulo->SetupAttachment(GetStaticMeshComponent());
	Rotulo->SetMobility(EComponentMobility::Movable);
	Rotulo->SetHorizontalAlignment(EHTA_Center);
	Rotulo->SetVerticalAlignment(EVRTA_TextCenter);
	Rotulo->SetWorldSize(0.95f);
	Rotulo->SetTextRenderColor(FColor(15, 15, 15));
	Rotulo->SetCastShadow(false);
}

void ARecipienteActor::ActualizarEtiqueta()
{
	const bool bVisible = !EtiquetaTexto.IsEmpty();
	Placa->SetVisibility(bVisible);
	Rotulo->SetVisibility(bVisible);
	if (!bVisible)
	{
		return;
	}
	Placa->SetRelativeLocation(FVector(EtiquetaRadioCm, 0.0f, EtiquetaAlturaCm));
	Placa->SetRelativeScale3D(FVector(0.002f, EtiquetaTamanoCm.X / 100.0f, EtiquetaTamanoCm.Y / 100.0f));
	Rotulo->SetRelativeLocation(FVector(EtiquetaRadioCm + 0.18f, 0.0f, EtiquetaAlturaCm));
	Rotulo->SetWorldSize(EtiquetaLetraCm);
	Rotulo->SetText(FText::FromString(EtiquetaTexto.Replace(TEXT("\n"), TEXT("<br>"))));
}

void ARecipienteActor::OnConstruction(const FTransform& Transform)
{
	Super::OnConstruction(Transform);
	ActualizarEtiqueta();
}

void ARecipienteActor::BeginPlay()
{
	Super::BeginPlay();
	PosicionOrigen = GetActorLocation();
	RotacionOrigen = GetActorRotation();
	ActualizarEtiqueta();
	// Lo que va unido directamente: el líquido (o la mezcla, en un matraz) y, si la hay, la tapa.
	TArray<AActor*> Unidos;
	GetAttachedActors(Unidos, true, false);
	for (AActor* Unido : Unidos)
	{
		if (AMezclaActor* ActorMezcla = Cast<AMezclaActor>(Unido))
		{
			MezclaComp = ActorMezcla->Mezcla;
		}
		else if (ALiquidoActor* ActorLiquido = Cast<ALiquidoActor>(Unido))
		{
			LiquidoComp = ActorLiquido->Liquido;
		}
		else if (ARecipienteActor* Otro = Cast<ARecipienteActor>(Unido))
		{
			Tapa = Otro;
			bTapado = true;
			TapaRelativa = GetActorTransform().InverseTransformPosition(Otro->GetActorLocation());
		}
	}
	if (LiquidoComp && (Rol == ERolRecipiente::Frasco || Rol == ERolRecipiente::Probeta))
	{
		FijarVolumen(VolumenML);
	}
}

void ARecipienteActor::FijarColisionConjunta(bool bActiva)
{
	SetActorEnableCollision(bActiva);
	TArray<AActor*> Unidos;
	GetAttachedActors(Unidos, true, true);
	for (AActor* Unido : Unidos)
	{
		// Los líquidos nunca tienen colisión: solo se restaura la de otros recipientes (tapas).
		if (Unido && (!bActiva || Unido->IsA<ARecipienteActor>()))
		{
			Unido->SetActorEnableCollision(bActiva);
		}
	}
}

ARecipienteActor* ARecipienteActor::RecipienteRaiz()
{
	ARecipienteActor* Actual = this;
	while (ARecipienteActor* Padre = Cast<ARecipienteActor>(Actual->GetAttachParentActor()))
	{
		Actual = Padre;
	}
	return Actual;
}

void ARecipienteActor::FijarVolumen(float NuevoML)
{
	VolumenML = FMath::Max(0.0f, NuevoML);
	if (CapacidadML > 0.0f)
	{
		VolumenML = FMath::Min(VolumenML, CapacidadML);
	}
	if (LiquidoComp)
	{
		LiquidoComp->FijarVolumenML(VolumenML);
	}
}

bool ARecipienteActor::AlternarTapa(const FVector& HaciaElLado)
{
	if (!Tapa)
	{
		return false;
	}
	if (bTapado)
	{
		// La tapa queda de pie en la misma superficie, a 9 cm del frasco. No se comprueba si pisa algo.
		FVector Lado = HaciaElLado;
		Lado.Z = 0.0f;
		Lado = Lado.GetSafeNormal(UE_SMALL_NUMBER, FVector::RightVector);
		Tapa->DetachFromActor(FDetachmentTransformRules::KeepWorldTransform);
		Tapa->SetActorLocationAndRotation(GetActorLocation() + Lado * 9.0f, FRotator::ZeroRotator);
		Tapa->SetActorEnableCollision(GetActorEnableCollision());
		bTapado = false;
	}
	else
	{
		Tapa->AttachToActor(this, FAttachmentTransformRules::KeepWorldTransform);
		Tapa->SetActorLocationAndRotation(GetActorTransform().TransformPosition(TapaRelativa), GetActorRotation());
		Tapa->SetActorEnableCollision(GetActorEnableCollision());
		bTapado = true;
	}
	return true;
}

FString ARecipienteActor::DescripcionContenido() const
{
	switch (Rol)
	{
	case ERolRecipiente::Gotero:
		return bSinModelo ? FString(TEXT("sin modelo químico")) : FString(TEXT("cuentagotas"));
	case ERolRecipiente::Tarro:
		return bSinModelo ? FString(TEXT("sólido · sin modelo químico")) : FString(TEXT("sólido"));
	case ERolRecipiente::Frasco:
		if (bSinModelo)
		{
			return FString(TEXT("sin modelo químico"));
		}
		return FString::Printf(TEXT("%s mL%s"), *UMezclaComponent::FormatoEs(VolumenML, 0), bTapado ? TEXT(" · tapado") : TEXT(" · destapado"));
	case ERolRecipiente::Navecilla:
		return VolumenML > 0.004f
			? FString::Printf(TEXT("%s g de %s"), *UMezclaComponent::FormatoEs(VolumenML, 2), *UMezclaComponent::NombreReactivo(ReactivoId))
			: FString(TEXT("vacía"));
	case ERolRecipiente::Pipeta:
	case ERolRecipiente::Probeta:
		return VolumenML > 0.05f
			? FString::Printf(TEXT("%s mL de %s"), *UMezclaComponent::FormatoEs(VolumenML, 1), *UMezclaComponent::NombreReactivo(ReactivoId))
			: FString(TEXT("vacía"));
	case ERolRecipiente::Matraz:
		if (MezclaComp && MezclaComp->VolumenML() > 0.0f)
		{
			return FString::Printf(TEXT("%s mL · pH %s · %s °C"), *UMezclaComponent::FormatoEs(MezclaComp->VolumenML(), 1),
				*UMezclaComponent::FormatoEs(MezclaComp->PH(), 2), *UMezclaComponent::FormatoEs(MezclaComp->TemperaturaC(), 1));
		}
		return FString(TEXT("vacío"));
	default:
		return FString();
	}
}
