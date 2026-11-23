#include "PuertaActor.h"

#include "Components/StaticMeshComponent.h"
#include "Components/TextRenderComponent.h"

APuertaActor::APuertaActor()
{
	PrimaryActorTick.bCanEverTick = true;
	PrimaryActorTick.bStartWithTickEnabled = false;

	Bisagra = CreateDefaultSubobject<USceneComponent>(TEXT("Bisagra"));
	Bisagra->SetMobility(EComponentMobility::Movable);
	RootComponent = Bisagra;

	Hoja = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Hoja"));
	Hoja->SetupAttachment(Bisagra);
	Hoja->SetMobility(EComponentMobility::Movable);
	// El rayo de puntería la ve, pero no estorba el paso cuando queda abierta hacia el pasillo.
	Hoja->SetCollisionEnabled(ECollisionEnabled::QueryOnly);
	Hoja->SetCollisionResponseToAllChannels(ECR_Ignore);
	Hoja->SetCollisionResponseToChannel(ECC_Visibility, ECR_Block);

	Rotulo = CreateDefaultSubobject<UTextRenderComponent>(TEXT("Rotulo"));
	Rotulo->SetupAttachment(Hoja);
	Rotulo->SetUsingAbsoluteScale(true);
	Rotulo->SetHorizontalAlignment(EHTA_Center);
	Rotulo->SetVerticalAlignment(EVRTA_TextCenter);
	Rotulo->SetWorldSize(3.2f);
	Rotulo->SetTextRenderColor(FColor(25, 25, 25));
}

void APuertaActor::ActualizarRotulo()
{
	Rotulo->SetText(FText::FromString(TextoRotulo.Replace(TEXT("\n"), TEXT("<br>"))));
	Rotulo->SetVisibility(!TextoRotulo.IsEmpty());
	// El rótulo se coloca en coordenadas de la bisagra, no de la hoja (que va escalada).
	Rotulo->SetWorldLocation(Bisagra->GetComponentTransform().TransformPosition(PosicionRotulo));
	Rotulo->SetWorldRotation(Bisagra->GetComponentRotation());
}

void APuertaActor::OnConstruction(const FTransform& Transform)
{
	Super::OnConstruction(Transform);
	ActualizarRotulo();
}

void APuertaActor::BeginPlay()
{
	Super::BeginPlay();
	RotacionCerrada = GetActorRotation();
	PosicionCerrada = GetActorLocation();
	ActualizarRotulo();
}

void APuertaActor::Alternar()
{
	bAbierta = !bAbierta;
	SetActorTickEnabled(true);
}

void APuertaActor::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	const float Destino = bAbierta ? 1.0f : 0.0f;
	Apertura = FMath::FInterpConstantTo(Apertura, Destino, DeltaSeconds, 1.0f / SegundosEnAbrir);
	// Arranque y frenada suaves.
	const float Suave = FMath::InterpEaseInOut(0.0f, 1.0f, Apertura, 2.0f);
	if (bDeslizante)
	{
		SetActorLocation(PosicionCerrada + RotacionCerrada.RotateVector(Desplazamiento) * Suave);
	}
	else
	{
		SetActorRotation(RotacionCerrada + FRotator(0.0f, AnguloAbierta * Suave, 0.0f));
	}
	if (FMath::IsNearlyEqual(Apertura, Destino))
	{
		SetActorTickEnabled(false);
	}
}
