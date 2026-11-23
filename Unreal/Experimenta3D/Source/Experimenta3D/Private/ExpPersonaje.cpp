#include "ExpPersonaje.h"

#include "Camera/CameraComponent.h"
#include "Components/BoxComponent.h"
#include "Components/CapsuleComponent.h"
#include "Components/StaticMeshComponent.h"
#include "EnhancedInputComponent.h"
#include "EnhancedInputSubsystems.h"
#include "Engine/LocalPlayer.h"
#include "Engine/StaticMesh.h"
#include "Engine/World.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "GameFramework/PlayerController.h"
#include "HAL/PlatformMisc.h"
#include "InputAction.h"
#include "InputMappingContext.h"
#include "InputModifiers.h"
#include "Kismet/GameplayStatics.h"
#include "Kismet/KismetSystemLibrary.h"
#include "Materials/MaterialInterface.h"
#include "Misc/CommandLine.h"
#include "Misc/Parse.h"
#include "UObject/ConstructorHelpers.h"
#include "UnrealClient.h"

#include "ExpHud.h"
#include "ExpJuego.h"

DEFINE_LOG_CATEGORY_STATIC(LogExpJuego, Log, All);

using namespace ExperimentaChem;

AExpPersonaje::AExpPersonaje()
{
	PrimaryActorTick.bCanEverTick = true;
	GetCapsuleComponent()->InitCapsuleSize(30.0f, 88.0f);
	GetCharacterMovement()->MaxWalkSpeed = VelocidadPaso;
	GetCharacterMovement()->BrakingDecelerationWalking = 1600.0f;
	GetCharacterMovement()->GroundFriction = 10.0f;
	bUseControllerRotationYaw = true;

	// Ojos a 1,65 m: la cápsula mide 1,76 m (centro a 88 cm del suelo) → 165 - 88 = 77 cm sobre el centro.
	Camara = CreateDefaultSubobject<UCameraComponent>(TEXT("Camara"));
	Camara->SetupAttachment(GetCapsuleComponent());
	Camara->SetRelativeLocation(FVector(0.0f, 0.0f, 77.0f));
	Camara->bUsePawnControlRotation = true;
	Camara->SetFieldOfView(78.0f);

	Manos = CreateDefaultSubobject<USceneComponent>(TEXT("Manos"));
	Manos->SetupAttachment(Camara);

	// Mallas de manos de art/blender/manos.py (ya importadas) y manga de bata: un cilindro del motor.
	static ConstructorHelpers::FObjectFinder<UStaticMesh> MallaDerecha(TEXT("/Game/Laboratorio/Importado/SM_Hand_R/SM_Hand_R/StaticMeshes/SM_Hand_R.SM_Hand_R"));
	static ConstructorHelpers::FObjectFinder<UStaticMesh> MallaIzquierda(TEXT("/Game/Laboratorio/Importado/SM_Hand_L/SM_Hand_L/StaticMeshes/SM_Hand_L.SM_Hand_L"));
	static ConstructorHelpers::FObjectFinder<UStaticMesh> Cilindro(TEXT("/Engine/BasicShapes/Cylinder.Cylinder"));
	static ConstructorHelpers::FObjectFinder<UMaterialInterface> Piel(TEXT("/Game/Juego/Materiales/M_Exp_Piel.M_Exp_Piel"));
	static ConstructorHelpers::FObjectFinder<UMaterialInterface> Guante(TEXT("/Game/Juego/Materiales/M_Exp_Guante_Nitrilo.M_Exp_Guante_Nitrilo"));
	static ConstructorHelpers::FObjectFinder<UMaterialInterface> Bata(TEXT("/Game/Juego/Materiales/M_Exp_Bata.M_Exp_Bata"));
	static ConstructorHelpers::FObjectFinder<UMaterialInterface> Agua(TEXT("/Game/Laboratorio/Materiales/M_Liquido_Incoloro.M_Liquido_Incoloro"));
	MaterialPiel = Piel.Object; MaterialGuante = Guante.Object; MaterialBata = Bata.Object;

	for (int32 I = 0; I < 2; ++I)
	{
		const float Lado = I == 0 ? -1.0f : 1.0f;   // 0 = izquierda, 1 = derecha (EHand)
		const FString Sufijo = I == 0 ? TEXT("Izq") : TEXT("Der");
		Mano[I] = CreateDefaultSubobject<UStaticMeshComponent>(*(TEXT("Mano") + Sufijo));
		Mano[I]->SetupAttachment(Manos);
		Mano[I]->SetStaticMesh(I == 0 ? MallaIzquierda.Object : MallaDerecha.Object);
		Mano[I]->SetCollisionEnabled(ECollisionEnabled::NoCollision);
		Mano[I]->SetCastShadow(false);
		Mano[I]->SetRelativeLocation(FVector(34.0f, 17.0f * Lado, -17.0f));
		Mano[I]->SetRelativeRotation(FRotator(6.0f, -9.0f * Lado, 0.0f));
		if (MaterialPiel) { Mano[I]->SetMaterial(0, MaterialPiel); }

		// Puño de bata: cilindro de 9 cm de diámetro y 30 cm detrás de la muñeca.
		Manga[I] = CreateDefaultSubobject<UStaticMeshComponent>(*(TEXT("Manga") + Sufijo));
		Manga[I]->SetupAttachment(Mano[I]);
		Manga[I]->SetStaticMesh(Cilindro.Object);
		Manga[I]->SetCollisionEnabled(ECollisionEnabled::NoCollision);
		Manga[I]->SetCastShadow(false);
		Manga[I]->SetRelativeLocation(FVector(-19.0f, 0.0f, -1.0f));
		Manga[I]->SetRelativeRotation(FRotator(90.0f, 0.0f, 0.0f));
		Manga[I]->SetRelativeScale3D(FVector(0.095f, 0.095f, 0.30f));
		if (MaterialBata) { Manga[I]->SetMaterial(0, MaterialBata); }

		// Agarre: delante de la palma, donde queda el centro del frasco sujeto.
		Punto[I] = CreateDefaultSubobject<USceneComponent>(*(TEXT("Agarre") + Sufijo));
		Punto[I]->SetupAttachment(Mano[I]);
		Punto[I]->SetRelativeLocation(FVector(7.0f, -4.0f * Lado, -9.0f));
	}

	Chorro = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Chorro"));
	Chorro->SetupAttachment(GetCapsuleComponent());
	Chorro->SetUsingAbsoluteLocation(true);
	Chorro->SetUsingAbsoluteRotation(true);
	Chorro->SetUsingAbsoluteScale(true);
	Chorro->SetStaticMesh(Cilindro.Object);
	if (Agua.Object) { Chorro->SetMaterial(0, Agua.Object); }
	Chorro->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	Chorro->SetCastShadow(false);
	Chorro->SetVisibility(false);
}

USceneComponent* AExpPersonaje::Agarre(EHand H) const
{
	return Punto[H == EHand::Left ? 0 : 1];
}

void AExpPersonaje::BeginPlay()
{
	Super::BeginPlay();
	for (int32 I = 0; I < 2; ++I) { BaseMano[I] = Mano[I]->GetRelativeLocation(); BaseRotMano[I] = Mano[I]->GetRelativeRotation(); }
	if (UExpSubsistema* S = GetWorld()->GetSubsystem<UExpSubsistema>()) { S->Jugador = this; }
	if (APlayerController* PC = Cast<APlayerController>(GetController()))
	{
		PC->PlayerCameraManager->ViewPitchMin = -80.0f;
		PC->PlayerCameraManager->ViewPitchMax = 80.0f;
		Hud = CreateWidget<UExpHud>(PC, UExpHud::StaticClass());
		if (Hud) { Hud->AddToViewport(0); }
		Menu = CreateWidget<UExpMenuPausa>(PC, UExpMenuPausa::StaticClass());
		PC->SetInputMode(FInputModeGameOnly());
		PC->SetShowMouseCursor(false);
	}
	bRecorrido = FParse::Param(FCommandLine::Get(), TEXT("ExpRecorrido"));
	if (bRecorrido) { UE_LOG(LogExpJuego, Display, TEXT("RECORRIDO inicio")); }
	// Calidad Media por defecto (objetivo del proyecto): la del menú de pausa.
	UExpMenuPausa::AplicarCalidad(GetWorld(), 1);
}

void AExpPersonaje::CrearEntrada()
{
	if (Contexto) { return; }
	auto Accion = [this](const TCHAR* Nombre, EInputActionValueType Tipo)
	{
		UInputAction* A = NewObject<UInputAction>(this, Nombre);
		A->ValueType = Tipo;
		return A;
	};
	AMover = Accion(TEXT("IA_Mover"), EInputActionValueType::Axis2D);
	AMirar = Accion(TEXT("IA_Mirar"), EInputActionValueType::Axis2D);
	ARapido = Accion(TEXT("IA_Correr"), EInputActionValueType::Boolean);
	AUsar = Accion(TEXT("IA_Usar"), EInputActionValueType::Boolean);
	ADejar = Accion(TEXT("IA_Dejar"), EInputActionValueType::Boolean);
	AMano1 = Accion(TEXT("IA_ManoIzquierda"), EInputActionValueType::Boolean);
	AMano2 = Accion(TEXT("IA_ManoDerecha"), EInputActionValueType::Boolean);
	AAnotar = Accion(TEXT("IA_Anotar"), EInputActionValueType::Boolean);
	APausa = Accion(TEXT("IA_Pausa"), EInputActionValueType::Boolean);
	APausa->bTriggerWhenPaused = true;
	ACerca = Accion(TEXT("IA_MirarDeCerca"), EInputActionValueType::Boolean);

	Contexto = NewObject<UInputMappingContext>(this, TEXT("IMC_Jugador"));
	auto Tecla = [this](UInputAction* A, FKey K, bool bEjeY, bool bNegar)
	{
		FEnhancedActionKeyMapping& M = Contexto->MapKey(A, K);
		if (bEjeY)
		{
			UInputModifierSwizzleAxis* Cambio = NewObject<UInputModifierSwizzleAxis>(Contexto);
			Cambio->Order = EInputAxisSwizzle::YXZ;
			M.Modifiers.Add(Cambio);
		}
		if (bNegar) { M.Modifiers.Add(NewObject<UInputModifierNegate>(Contexto)); }
	};
	Tecla(AMover, EKeys::W, true, false);
	Tecla(AMover, EKeys::S, true, true);
	Tecla(AMover, EKeys::D, false, false);
	Tecla(AMover, EKeys::A, false, true);
	Contexto->MapKey(AMirar, EKeys::Mouse2D);
	Contexto->MapKey(ARapido, EKeys::LeftShift);
	Contexto->MapKey(AUsar, EKeys::E);
	Contexto->MapKey(AUsar, EKeys::LeftMouseButton);
	Contexto->MapKey(ADejar, EKeys::Q);
	Contexto->MapKey(AMano1, EKeys::One);
	Contexto->MapKey(AMano2, EKeys::Two);
	Contexto->MapKey(AAnotar, EKeys::N);
	Contexto->MapKey(APausa, EKeys::Escape);
	Contexto->MapKey(APausa, EKeys::P);
	Contexto->MapKey(ACerca, EKeys::RightMouseButton);
}

void AExpPersonaje::PawnClientRestart()
{
	Super::PawnClientRestart();
	CrearEntrada();
	if (const APlayerController* PC = Cast<APlayerController>(GetController()))
	{
		if (UEnhancedInputLocalPlayerSubsystem* E = ULocalPlayer::GetSubsystem<UEnhancedInputLocalPlayerSubsystem>(PC->GetLocalPlayer()))
		{
			E->AddMappingContext(Contexto, 0);
		}
	}
}

void AExpPersonaje::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
	Super::SetupPlayerInputComponent(PlayerInputComponent);
	CrearEntrada();
	if (UEnhancedInputComponent* E = Cast<UEnhancedInputComponent>(PlayerInputComponent))
	{
		E->BindAction(AMover, ETriggerEvent::Triggered, this, &AExpPersonaje::AlMover);
		E->BindAction(AMirar, ETriggerEvent::Triggered, this, &AExpPersonaje::AlMirar);
		E->BindAction(ARapido, ETriggerEvent::Started, this, &AExpPersonaje::AlRapido);
		E->BindAction(ARapido, ETriggerEvent::Completed, this, &AExpPersonaje::AlNormal);
		E->BindAction(AUsar, ETriggerEvent::Started, this, &AExpPersonaje::AlUsar);
		E->BindAction(AUsar, ETriggerEvent::Completed, this, &AExpPersonaje::AlSoltar);
		E->BindAction(ADejar, ETriggerEvent::Started, this, &AExpPersonaje::AlDejar);
		E->BindAction(AMano1, ETriggerEvent::Started, this, &AExpPersonaje::AlMano1);
		E->BindAction(AMano2, ETriggerEvent::Started, this, &AExpPersonaje::AlMano2);
		E->BindAction(AAnotar, ETriggerEvent::Started, this, &AExpPersonaje::AlAnotar);
		// La pausa debe responder con el juego en pausa.
		E->BindAction(APausa, ETriggerEvent::Started, this, &AExpPersonaje::AlPausa);
		E->BindAction(ACerca, ETriggerEvent::Started, this, &AExpPersonaje::AlCerca);
		E->BindAction(ACerca, ETriggerEvent::Completed, this, &AExpPersonaje::AlLejos);
	}
}

void AExpPersonaje::AlMover(const FInputActionValue& V) { DoMover(V.Get<FVector2D>()); }
void AExpPersonaje::AlMirar(const FInputActionValue& V) { DoMirar(V.Get<FVector2D>()); }
void AExpPersonaje::AlRapido(const FInputActionValue&) { GetCharacterMovement()->MaxWalkSpeed = VelocidadRapida; }
void AExpPersonaje::AlNormal(const FInputActionValue&) { GetCharacterMovement()->MaxWalkSpeed = VelocidadPaso; }
void AExpPersonaje::AlUsar(const FInputActionValue&) { DoUsar(true); }
void AExpPersonaje::AlSoltar(const FInputActionValue&) { DoUsar(false); }
void AExpPersonaje::AlDejar(const FInputActionValue&) { DoDejar(); }
void AExpPersonaje::AlMano1(const FInputActionValue&) { DoMano(0); }
void AExpPersonaje::AlMano2(const FInputActionValue&) { DoMano(1); }
void AExpPersonaje::AlAnotar(const FInputActionValue&) { DoAnotar(); }
void AExpPersonaje::AlPausa(const FInputActionValue&) { DoPausa(); }
void AExpPersonaje::AlCerca(const FInputActionValue&) { DoCerca(true); }
void AExpPersonaje::AlLejos(const FInputActionValue&) { DoCerca(false); }

void AExpPersonaje::DoMover(FVector2D Eje)
{
	if (!Controller) { return; }
	const FRotator Giro(0.0, Controller->GetControlRotation().Yaw, 0.0);
	AddMovementInput(FRotationMatrix(Giro).GetUnitAxis(EAxis::X), Eje.Y);
	AddMovementInput(FRotationMatrix(Giro).GetUnitAxis(EAxis::Y), Eje.X);
}

void AExpPersonaje::DoMirar(FVector2D Eje)
{
	const float K = Sensibilidad * (bCerca ? 0.45f : 1.0f);
	AddControllerYawInput(Eje.X * K);
	AddControllerPitchInput(-Eje.Y * K);
}

void AExpPersonaje::DoUsar(bool bPulsado)
{
	UExpSubsistema* S = GetWorld()->GetSubsystem<UExpSubsistema>();
	if (!S) { return; }
	if (bPulsado)
	{
		const int32 Activa = S->Partida().Sesion().Hand == EHand::Left ? 0 : 1;
		Alcance[Activa] = 1.0f;
		S->Partida().PulsarUsar();
	}
	else { S->Partida().SoltarUsar(); }
}

void AExpPersonaje::DoDejar()
{
	if (UExpSubsistema* S = GetWorld()->GetSubsystem<UExpSubsistema>())
	{
		Alcance[S->Partida().Sesion().Hand == EHand::Left ? 0 : 1] = 1.0f;
		S->Partida().Dejar();
	}
}

void AExpPersonaje::DoMano(int32 Indice)
{
	if (UExpSubsistema* S = GetWorld()->GetSubsystem<UExpSubsistema>()) { S->Partida().Mano(Indice == 0 ? EHand::Left : EHand::Right); }
}

void AExpPersonaje::DoAnotar()
{
	if (UExpSubsistema* S = GetWorld()->GetSubsystem<UExpSubsistema>()) { S->Partida().Anotar(); }
}

void AExpPersonaje::DoCerca(bool bActivo)
{
	bCerca = bActivo;
}

void AExpPersonaje::DoPausa()
{
	APlayerController* PC = Cast<APlayerController>(GetController());
	if (!PC || !Menu) { return; }
	const bool bPausar = !Menu->IsInViewport();
	if (UExpSubsistema* S = GetWorld()->GetSubsystem<UExpSubsistema>()) { S->Partida().SoltarUsar(); }
	if (bPausar)
	{
		Menu->AddToViewport(10);
		PC->SetPause(true);
		FInputModeGameAndUI Modo;
		Modo.SetWidgetToFocus(Menu->TakeWidget());
		Modo.SetHideCursorDuringCapture(false);
		PC->SetInputMode(Modo);
		PC->SetShowMouseCursor(true);
	}
	else
	{
		Menu->RemoveFromParent();
		PC->SetPause(false);
		PC->SetInputMode(FInputModeGameOnly());
		PC->SetShowMouseCursor(false);
	}
}

// ---------------------------------------------------------------- Fotograma

void AExpPersonaje::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	Tiempo += DeltaSeconds;
	UExpSubsistema* S = GetWorld()->GetSubsystem<UExpSubsistema>();
	if (!S) { return; }
	if (bRecorrido && !MiradaFija.IsEmpty())
	{
		APlayerController* PC = Cast<APlayerController>(GetController());
		if (const AExpObjeto* O = S->Buscar(MiradaFija); O && PC)
		{
			PC->SetControlRotation((O->Zona->GetComponentLocation() - Camara->GetComponentLocation()).Rotation());
		}
	}
	Apuntar();

	// Guantes: la mano pasa de piel a nitrilo azul al ponérselos.
	const bool bGuantes = S->Partida().Sesion().Ppe.bGloves;
	if (bGuantes != bGuantesPuestos && MaterialGuante)
	{
		bGuantesPuestos = bGuantes;
		for (int32 I = 0; I < 2; ++I) { Mano[I]->SetMaterial(0, bGuantes ? MaterialGuante.Get() : MaterialPiel.Get()); }
	}
	Camara->SetFieldOfView(FMath::FInterpTo(Camara->FieldOfView, bCerca ? 38.0f : 78.0f, DeltaSeconds, 10.0f));
	AnimarManos(DeltaSeconds);
	ActualizarChorro();
	if (Hud) { Hud->Actualizar(*S, *this); }
	if (bRecorrido) { Recorrido(DeltaSeconds); }
}

void AExpPersonaje::Apuntar()
{
	UExpSubsistema* S = GetWorld()->GetSubsystem<UExpSubsistema>();
	const FVector Desde = Camara->GetComponentLocation();
	const FVector Hasta = Desde + Camara->GetForwardVector() * AlcanceCm;
	FHitResult Golpe;
	FCollisionQueryParams Parametros(SCENE_QUERY_STAT(ExpApuntar), false, this);
	// El vidrio de la guillotina y la colisión simple de la encimera no tapan la puntería (Tools/juego_preparar.py).
	if (Transparentes.Num() == 0)
	{
		UGameplayStatics::GetAllActorsWithTag(GetWorld(), TEXT("ExpTransparente"), Transparentes);
		if (Transparentes.Num() == 0) { Transparentes.Add(this); }
	}
	Parametros.AddIgnoredActors(Transparentes);
	AExpObjeto* Nuevo = nullptr;
	if (GetWorld()->LineTraceSingleByChannel(Golpe, Desde, Hasta, ECC_Visibility, Parametros))
	{
		// Las paredes y los muebles tapan: solo vale si lo primero que toca es un objeto del juego.
		Nuevo = Cast<AExpObjeto>(Golpe.GetActor());
	}
	if (bRecorrido && FMath::Fmod(Tiempo, 1.0f) < GetWorld()->GetDeltaSeconds())
	{
		UE_LOG(LogExpJuego, Display, TEXT("RECORRIDO traza %s -> %s / %s en %s"), *Desde.ToString(),
			Golpe.GetActor() ? *Golpe.GetActor()->GetActorNameOrLabel() : TEXT("(nada)"), Golpe.GetComponent() ? *Golpe.GetComponent()->GetName() : TEXT("-"), *Golpe.ImpactPoint.ToString());
	}
	if (Nuevo != ObjetivoActual.Get())
	{
		if (AExpObjeto* Viejo = ObjetivoActual.Get()) { Viejo->FijarApuntado(false); }
		if (Nuevo) { Nuevo->FijarApuntado(true); }
		ObjetivoActual = Nuevo;
	}
	S->Partida().Apuntar(Nuevo ? Nuevo->TargetId : FString());
	TextoAviso = ConstruirAviso(Nuevo);
}

FString AExpPersonaje::ConstruirAviso(const AExpObjeto* O) const
{
	if (!O) { return FString(); }
	const UExpSubsistema* S = GetWorld()->GetSubsystem<UExpSubsistema>();
	const FExpPartida& P = S->Partida();
	const FHood& H = P.Campana();
	const int32 Sostenido = H.HeldIn(P.Sesion().Hand);
	const bool bMano = Sostenido >= 0;
	FString Nombre = O->Nombre, Acciones;
	switch (O->Tipo)
	{
	case EExpTipo::Frasco: Acciones = bMano ? TEXT("Q · Dejar el frasco de la mano") : TEXT("E · Recoger"); break;
	case EExpTipo::Proteccion: Acciones = TEXT("E · Ponértelos"); break;
	case EExpTipo::Probeta:
		Nombre += FString::Printf(TEXT(" — %s mL"), *FExpPartida::Texto(FormatEs(FMath::RoundToDouble(H.Cylinder.Ml * 10.0) / 10.0, 1)));
		if (H.Cylinder.Reagent >= 0) { Nombre += TEXT(" de ") + FExpPartida::Texto(GetReagents()[static_cast<size_t>(H.Cylinder.Reagent)].Name); }
		else if (H.Cylinder.Dirty >= 0) { Nombre += TEXT(" (con restos: enjuágala)"); }
		Acciones = bMano ? TEXT("Mantén clic · Llenar   ·   Q · Dejar el frasco en la campana") : TEXT("E · Verter en el matraz   ·   Clic dcho. · Mirar de cerca");
		break;
	case EExpTipo::Matraz:
	{
		const double Ml = AnalyzeMixture(H.Mixture).VolumeMl;
		Nombre += FString::Printf(TEXT(" — %s mL"), *FExpPartida::Texto(FormatEs(FMath::RoundToDouble(Ml * 10.0) / 10.0, 1)));
		Acciones = bMano ? TEXT("Mantén clic · Verter directamente   ·   Q · Dejar el frasco") : TEXT("E · Anotar en el cuaderno");
		break;
	}
	case EExpTipo::Piseta: Acciones = TEXT("E · Enjuagar la probeta"); break;
	case EExpTipo::Residuos: Acciones = TEXT("E · Desechar la mezcla del matraz"); break;
	case EExpTipo::Tablero: Acciones = TEXT("E · Elegir práctica"); break;
	case EExpTipo::Estanteria: Acciones = bMano ? TEXT("Q · Devolver el frasco") : FString(); break;
	case EExpTipo::Bandeja: Acciones = bMano ? TEXT("Q · Dejar el frasco en la campana") : FString(); break;
	}
	return Acciones.IsEmpty() ? Nombre : Nombre + TEXT("\n") + Acciones;
}

void AExpPersonaje::AnimarManos(float DeltaSeconds)
{
	const UExpSubsistema* S = GetWorld()->GetSubsystem<UExpSubsistema>();
	const FExpPartida& P = S->Partida();
	const int32 Activa = P.Sesion().Hand == EHand::Left ? 0 : 1;
	const float Paso = GetVelocity().Size2D() / FMath::Max(1.0f, VelocidadPaso);
	for (int32 I = 0; I < 2; ++I)
	{
		// Vertiendo con esta mano: la muñeca inclina el frasco hacia dentro (~75°).
		const bool bVierte = P.Vertiendo() && I == Activa;
		Inclinacion[I] = FMath::FInterpTo(Inclinacion[I], bVierte ? 1.0f : 0.0f, DeltaSeconds, 6.0f);
		Alcance[I] = FMath::FInterpTo(Alcance[I], 0.0f, DeltaSeconds, 5.0f);
		const float Lado = I == 0 ? -1.0f : 1.0f;
		// Balanceo suave al andar (pocos milímetros, sin mareo) y respiración.
		const FVector Vaiven(0.0f, 0.0f, 0.35f * FMath::Sin(Tiempo * 1.6f) + 0.6f * Paso * FMath::Sin(Tiempo * 9.0f + I * PI));
		const FVector Estirar = FVector(10.0f, -4.0f * Lado, 4.0f) * FMath::Sin(Alcance[I] * PI * 0.5f);
		const FVector Activo = I == Activa ? FVector(0.0f, 0.0f, 1.5f) : FVector::ZeroVector;
		const FVector Vertido = FVector(6.0f, -7.0f * Lado, 5.0f) * Inclinacion[I];
		Mano[I]->SetRelativeLocation(BaseMano[I] + Vaiven + Estirar + Activo + Vertido);
		Mano[I]->SetRelativeRotation(BaseRotMano[I] + FRotator(0.0f, 0.0f, -75.0f * Lado * Inclinacion[I]));
	}
}

void AExpPersonaje::ActualizarChorro()
{
	const UExpSubsistema* S = GetWorld()->GetSubsystem<UExpSubsistema>();
	const FExpPartida& P = S->Partida();
	const AExpObjeto* Destino = Apuntado();
	const int32 Sostenido = P.Campana().HeldIn(P.Sesion().Hand);
	AExpObjeto* Frasco = nullptr;
	if (Sostenido >= 0)
	{
		for (const TWeakObjectPtr<AExpObjeto>& O : S->Objetos())
		{
			if (O.IsValid() && O->Tipo == EExpTipo::Frasco && O->IndiceReactivo() == Sostenido) { Frasco = O.Get(); break; }
		}
	}
	const bool bVisible = P.Vertiendo() && Destino && Frasco && Inclinacion[P.Sesion().Hand == EHand::Left ? 0 : 1] > 0.6f;
	Chorro->SetVisibility(bVisible);
	if (!bVisible) { return; }
	const FVector A = Frasco->Boca(), B = Destino->Boca();
	const FVector D = B - A;
	const float Largo = FMath::Max(1.0f, static_cast<float>(D.Size()));
	// Cilindro del motor: 100 cm de alto centrado en su origen, eje Z.
	Chorro->SetWorldLocationAndRotation((A + B) * 0.5, FRotationMatrix::MakeFromZ(D).Rotator());
	Chorro->SetWorldScale3D(FVector(0.004f, 0.004f, Largo / 100.0f));
}

// ---------------------------------------------------------------- Recorrido automático

bool AExpPersonaje::MirarA(const FString& Id, float Distancia, float /*AlturaOjos*/)
{
	UExpSubsistema* S = GetWorld()->GetSubsystem<UExpSubsistema>();
	const AExpObjeto* O = S ? S->Buscar(Id) : nullptr;
	APlayerController* PC = Cast<APlayerController>(GetController());
	if (!O || !PC) { return false; }
	const FVector Centro = O->Zona->GetComponentLocation();
	UE_LOG(LogExpJuego, Display, TEXT("RECORRIDO mirar %s centro %s extension %s"), *Id, *Centro.ToString(), *O->Zona->GetScaledBoxExtent().ToString());
	// Se coloca entre el objeto y el centro de la sala, a la distancia pedida, con los ojos a la altura pedida.
	// Lo que está contra la pared del fondo (estación) se mira de frente; lo demás, desde el centro de la sala.
	FVector Hacia = Centro.Y < 60.0 ? FVector(0.0, 1.0, 0.0) : (FVector(0.0, 190.0, 0.0) - FVector(Centro.X, Centro.Y, 0.0)).GetSafeNormal2D();
	// Los pies siguen en el suelo (la cámara a 1,65 m); se apunta desde la posición real de la cámara.
	const FVector Pie = FVector(Centro.X, Centro.Y, 0.0) + Hacia * Distancia;
	SetActorLocation(FVector(Pie.X, Pie.Y, GetActorLocation().Z), false, nullptr, ETeleportType::TeleportPhysics);
	PC->SetControlRotation((Centro - Camara->GetComponentLocation()).Rotation());
	MiradaFija = Id;
	return true;
}

void AExpPersonaje::Recorrido(float DeltaSeconds)
{
	UExpSubsistema* S = GetWorld()->GetSubsystem<UExpSubsistema>();
	FExpPartida& P = S->Partida();
	TiempoRecorrido += DeltaSeconds;
	EsperaRecorrido -= DeltaSeconds;
	if (EsperaRecorrido > 0.0f) { return; }

	auto Captura = [](const TCHAR* Nombre)
	{
		const FString Ruta = FPaths::ConvertRelativePathToFull(FPaths::ProjectSavedDir() / TEXT("Recorrido") / Nombre);
		FScreenshotRequest::RequestScreenshot(Ruta, true, false);
		UE_LOG(LogExpJuego, Display, TEXT("RECORRIDO captura %s"), *Ruta);
	};
	auto Registro = [this, &P](const TCHAR* Que)
	{
		FString Pendiente = TEXT("(ninguno)");
		for (const FExpPaso& Paso : P.Pasos()) { if (!Paso.bHecho) { Pendiente = Paso.Clave; break; } }
		UE_LOG(LogExpJuego, Display, TEXT("RECORRIDO paso %d %s | objetivo='%s' | pendiente=%s | mensaje=%s"), PasoRecorrido, Que,
			*P.Objetivo(), *Pendiente, *P.Mensaje());
	};
	// Cada caso hace una acción y fija la espera; el trazado de la cámara elige el objetivo al fotograma siguiente.
	switch (PasoRecorrido)
	{
	case 0: if (TiempoRecorrido < 4.0f) { return; } Captura(TEXT("00_vista_inicial.png")); EsperaRecorrido = 0.6f; break;
	case 1: MirarA(TEXT("recipe-board"), 130.0f, 160.0f); EsperaRecorrido = 0.5f; break;
	case 2: DoUsar(true); DoUsar(false); Registro(TEXT("tablero")); EsperaRecorrido = 0.4f; break;
	case 3: DoUsar(true); DoUsar(false); Registro(TEXT("elegir")); Captura(TEXT("01_practica_elegida.png")); EsperaRecorrido = 1.0f; break;
	case 4: MirarA(TEXT("ppe-goggles"), 90.0f, 160.0f); EsperaRecorrido = 0.5f; break;
	case 5: DoUsar(true); DoUsar(false); Registro(TEXT("gafas")); EsperaRecorrido = 0.4f; break;
	case 6: MirarA(TEXT("ppe-gloves"), 90.0f, 160.0f); EsperaRecorrido = 0.5f; break;
	case 7:
		if (!bFotoPrevia) { Captura(TEXT("01b_apuntando_guantes.png")); bFotoPrevia = true; EsperaRecorrido = 0.4f; return; }
		bFotoPrevia = false; DoUsar(true); DoUsar(false); Registro(TEXT("guantes")); EsperaRecorrido = 0.6f; break;
	case 8: MirarA(TEXT("reagent:agno3"), 75.0f, 150.0f); EsperaRecorrido = 0.5f; break;
	case 9: Captura(TEXT("02_apuntando_frasco.png")); DoUsar(true); DoUsar(false); Registro(TEXT("agno3")); EsperaRecorrido = 0.5f; break;
	case 10: DoMano(0); MirarA(TEXT("reagent:nacl"), 75.0f, 150.0f); EsperaRecorrido = 0.5f; break;
	case 11: DoUsar(true); DoUsar(false); Registro(TEXT("nacl")); DoMano(1); EsperaRecorrido = 0.5f; break;
	case 12: MirarA(TEXT("hood-cylinder"), 70.0f, 140.0f); EsperaRecorrido = 0.6f; break;
	case 13: DoUsar(true); Registro(TEXT("llenar AgNO3")); EsperaRecorrido = 0.0f; break;
	case 14:
		if (P.Campana().Cylinder.Ml < 20.0 && TiempoRecorrido < 150.0f) { if (P.Campana().Cylinder.Ml > 10.0 && P.Campana().Cylinder.Ml < 10.2) { Captura(TEXT("03_llenando_probeta.png")); } return; }
		DoUsar(false); Registro(TEXT("20 mL")); EsperaRecorrido = 0.5f; break;
	case 15: DoDejar(); Registro(TEXT("dejar AgNO3")); EsperaRecorrido = 0.4f; break;
	case 16: DoUsar(true); DoUsar(false); Registro(TEXT("verter AgNO3")); EsperaRecorrido = 0.7f; break;
	case 17: Captura(TEXT("04_vertiendo_probeta.png")); EsperaRecorrido = 1.5f; break;
	case 18: MirarA(TEXT("hood-washbottle"), 70.0f, 140.0f); EsperaRecorrido = 0.5f; break;
	case 19: DoUsar(true); DoUsar(false); Registro(TEXT("enjuagar")); EsperaRecorrido = 1.5f; break;
	case 20: DoMano(0); MirarA(TEXT("hood-cylinder"), 70.0f, 140.0f); EsperaRecorrido = 0.6f; break;
	case 21: DoUsar(true); Registro(TEXT("llenar NaCl")); EsperaRecorrido = 0.0f; break;
	case 22:
		if (P.Campana().Cylinder.Ml < 5.0 && TiempoRecorrido < 150.0f) { return; }
		DoUsar(false); Registro(TEXT("5 mL")); EsperaRecorrido = 0.5f; break;
	case 23: DoDejar(); DoUsar(true); DoUsar(false); Registro(TEXT("verter NaCl")); EsperaRecorrido = 2.5f; break;
	case 24: MirarA(TEXT("hood"), 105.0f, 165.0f); EsperaRecorrido = 1.5f; break;
	case 25: Captura(TEXT("05_precipitado_AgCl.png")); Registro(TEXT("observar")); EsperaRecorrido = 5.0f; break;
	case 26: Captura(TEXT("06_precipitado_sedimentando.png")); DoUsar(true); DoUsar(false); Registro(TEXT("anotar")); EsperaRecorrido = 0.6f; break;
	case 27: MirarA(TEXT("hood-waste"), 80.0f, 150.0f); EsperaRecorrido = 0.6f; break;
	case 28: DoUsar(true); DoUsar(false); Registro(TEXT("desechar")); EsperaRecorrido = 2.5f; break;
	case 29:
	{
		const bool bOk = P.PracticaCompleta() && P.ReglasDisparadas().Contains(TEXT("ksp-AgCl"));
		Registro(TEXT("fin"));
		UE_LOG(LogExpJuego, Display, TEXT("RECORRIDO_%s practica completa=%d, reglas=[%s], precipitado %s %.4f g, %.1f s"),
			bOk ? TEXT("OK") : TEXT("FALLO"), P.PracticaCompleta() ? 1 : 0, *FString::Join(P.ReglasDisparadas(), TEXT(",")),
			*P.PrecipitadoNombre(), P.PrecipitadoGramos(), TiempoRecorrido);
		// Vista general para la captura y la medición de FPS (calidad Media).
		MirarA(TEXT("hood"), 230.0f, 165.0f);
		EsperaRecorrido = 1.0f;
		break;
	}
	case 30: Captura(TEXT("07_completado.png")); Tiempos.Reset(); EsperaRecorrido = 3.0f; break;
	case 31:
		// 20 s de medición con la vista fija.
		Tiempos.Add(DeltaSeconds);
		if (Tiempos.Num() < 100000 && Tiempos.Num() > 0)
		{
			double Total = 0.0; for (float T : Tiempos) { Total += T; }
			if (Total < 20.0) { return; }
			TArray<float> Orden = Tiempos; Orden.Sort();
			const float P95 = Orden[FMath::Clamp(FMath::FloorToInt(Orden.Num() * 0.95f), 0, Orden.Num() - 1)];
			UE_LOG(LogExpJuego, Display, TEXT("RECORRIDO_FPS media %.1f FPS (%d fotogramas en %.1f s), p95 %.2f ms, resolucion %s"),
				Tiempos.Num() / Total, Tiempos.Num(), Total, P95 * 1000.0f, *GEngine->GameViewport->Viewport->GetSizeXY().ToString());
		}
		EsperaRecorrido = 0.5f;
		break;
	case 32:
		UE_LOG(LogExpJuego, Display, TEXT("RECORRIDO_FIN"));
		if (APlayerController* PC = Cast<APlayerController>(GetController())) { UKismetSystemLibrary::QuitGame(this, PC, EQuitPreference::Quit, false); }
		EsperaRecorrido = 100.0f;
		break;
	default: return;
	}
	++PasoRecorrido;
}
