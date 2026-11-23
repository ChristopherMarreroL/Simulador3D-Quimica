#include "BalanzaActor.h"

#include "Components/TextRenderComponent.h"
#include "EngineUtils.h"
#include "MezclaComponent.h"
#include "RecipienteActor.h"

ABalanzaActor::ABalanzaActor()
{
	PrimaryActorTick.bCanEverTick = true;
	PrimaryActorTick.TickInterval = 0.1f;

	Platillo = CreateDefaultSubobject<USceneComponent>(TEXT("Platillo"));
	RootComponent = Platillo;

	Pantalla = CreateDefaultSubobject<UTextRenderComponent>(TEXT("Pantalla"));
	Pantalla->SetupAttachment(Platillo);
	Pantalla->SetHorizontalAlignment(EHTA_Center);
	Pantalla->SetVerticalAlignment(EVRTA_TextCenter);
	Pantalla->SetWorldSize(2.2f);
	Pantalla->SetTextRenderColor(FColor(40, 230, 90));
}

void ABalanzaActor::BeginPlay()
{
	Super::BeginPlay();
	// Pantalla inclinada hacia arriba para leerla de pie.
	Pantalla->SetRelativeLocationAndRotation(PosicionPantalla, FRotator(55.0f, 0.0f, 0.0f));
}

void ABalanzaActor::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	Lectura = 0.0f;
	const FVector Centro = GetActorLocation();
	for (TActorIterator<ARecipienteActor> It(GetWorld()); It; ++It)
	{
		// La navecilla cuenta si está apoyada en el platillo (no en una mano, que la lleva más alta o lejos).
		if (It->Rol == ERolRecipiente::Navecilla && FVector::Dist2D(It->GetActorLocation(), Centro) < RadioPlatilloCm
			&& FMath::Abs(It->GetActorLocation().Z - Centro.Z) < 3.0f)
		{
			Lectura += It->VolumenML;
		}
	}
	if (!FMath::IsNearlyEqual(Lectura, Mostrado, 0.004f))
	{
		Mostrado = Lectura;
		Pantalla->SetText(FText::FromString(UMezclaComponent::FormatoEs(Lectura, 2) + TEXT(" g")));
	}
}
