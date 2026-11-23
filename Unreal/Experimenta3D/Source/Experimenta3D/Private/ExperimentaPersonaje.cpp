#include "ExperimentaPersonaje.h"

#include "ExperimentaHUD.h"

#include "Camera/CameraComponent.h"
#include "Components/CapsuleComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/LocalPlayer.h"
#include "Engine/StaticMesh.h"
#include "EngineUtils.h"
#include "EnhancedInputComponent.h"
#include "EnhancedInputSubsystems.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "GameFramework/PlayerController.h"
#include "InputAction.h"
#include "InputMappingContext.h"
#include "InputModifiers.h"
#include "MezclaComponent.h"
#include "Misc/CommandLine.h"
#include "Misc/Parse.h"
#include "PracticaGuiada.h"
#include "PuertaActor.h"
#include "RecipienteActor.h"
#include "Materials/MaterialInterface.h"
#include "UObject/ConstructorHelpers.h"

DEFINE_LOG_CATEGORY_STATIC(LogExperimentaPersonaje, Log, All);

namespace
{
	// Punto de la mano (en su propia malla) junto al que queda el objeto: +X hacia los dedos y el
	// pulgar hacia dentro. Lado = +1 en la derecha y -1 en la izquierda.
	FVector AgarreLocal(float Lado)
	{
		return FVector(11.0f, -6.5f * Lado, -3.0f);
	}
}

AExperimentaPersonaje::AExperimentaPersonaje()
{
	PrimaryActorTick.bCanEverTick = true;

	// Cápsula de 34 cm de radio y 176 cm de alto; ojos a 160 cm del suelo.
	GetCapsuleComponent()->InitCapsuleSize(34.0f, 88.0f);
	bUseControllerRotationYaw = true;
	bUseControllerRotationPitch = false;

	UCharacterMovementComponent* Movimiento = GetCharacterMovement();
	Movimiento->MaxWalkSpeed = VelocidadCaminar;
	Movimiento->MaxAcceleration = 900.0f;
	Movimiento->BrakingDecelerationWalking = 1200.0f;
	Movimiento->GroundFriction = 8.0f;
	Movimiento->bOrientRotationToMovement = false;
	Movimiento->NavAgentProps.bCanJump = false;
	Movimiento->MaxStepHeight = 20.0f;

	Camara = CreateDefaultSubobject<UCameraComponent>(TEXT("Camara"));
	Camara->SetupAttachment(GetCapsuleComponent());
	Camara->SetRelativeLocation(FVector(0.0f, 0.0f, 72.0f));
	Camara->bUsePawnControlRotation = true;
	Camara->SetFieldOfView(80.0f);

	Practica = CreateDefaultSubobject<UPracticaGuiadaComponent>(TEXT("Practica"));

	ManosRaiz = CreateDefaultSubobject<USceneComponent>(TEXT("ManosRaiz"));
	ManosRaiz->SetupAttachment(Camara);

	// Mallas generadas por art/blender/manos.py e importadas por Tools/importar_cristaleria.py.
	static ConstructorHelpers::FObjectFinder<UStaticMesh> MallaDerecha(
		TEXT("/Game/Laboratorio/Importado/SM_Hand_R/SM_Hand_R/StaticMeshes/SM_Hand_R.SM_Hand_R"));
	static ConstructorHelpers::FObjectFinder<UStaticMesh> MallaIzquierda(
		TEXT("/Game/Laboratorio/Importado/SM_Hand_L/SM_Hand_L/StaticMeshes/SM_Hand_L.SM_Hand_L"));

	auto CrearMano = [this](const TCHAR* Nombre, UStaticMesh* Malla, float Lado)
	{
		UStaticMeshComponent* Mano = CreateDefaultSubobject<UStaticMeshComponent>(Nombre);
		Mano->SetupAttachment(ManosRaiz);
		Mano->SetStaticMesh(Malla);
		Mano->SetCollisionEnabled(ECollisionEnabled::NoCollision);
		Mano->SetCastShadow(false);
		// Delante y por debajo de los ojos, algo abiertas y apuntando un poco hacia dentro.
		Mano->SetRelativeLocation(FVector(34.0f, 17.0f * Lado, -17.0f));
		Mano->SetRelativeRotation(FRotator(6.0f, -9.0f * Lado, 0.0f));
		return Mano;
	};
	// Chorro: un cilindro fino con el material de líquido incoloro; oculto salvo al verter.
	static ConstructorHelpers::FObjectFinder<UStaticMesh> Cilindro(TEXT("/Engine/BasicShapes/Cylinder.Cylinder"));
	Chorro = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Chorro"));
	Chorro->SetupAttachment(GetCapsuleComponent());
	Chorro->SetUsingAbsoluteLocation(true);
	Chorro->SetUsingAbsoluteRotation(true);
	Chorro->SetUsingAbsoluteScale(true);
	Chorro->SetStaticMesh(Cilindro.Object);
	Chorro->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	Chorro->SetCastShadow(false);
	Chorro->SetVisibility(false);

	ManoDerecha = CrearMano(TEXT("ManoDerecha"), MallaDerecha.Object, 1.0f);
	ManoIzquierda = CrearMano(TEXT("ManoIzquierda"), MallaIzquierda.Object, -1.0f);
}

UStaticMeshComponent* AExperimentaPersonaje::ComponenteMano(int32 Mano) const
{
	return Mano == 0 ? ManoDerecha : ManoIzquierda;
}

FVector AExperimentaPersonaje::TopeDe(const AActor* Actor)
{
	FVector Origen, Extension;
	Actor->GetActorBounds(false, Origen, Extension);
	return Origen + FVector(0.0f, 0.0f, Extension.Z);
}

// ---------------------------------------------------------------------------------- Entrada

void AExperimentaPersonaje::CrearEntrada()
{
	if (Contexto)
	{
		return;
	}
	// Acciones y teclas creadas por código: el proyecto no tiene todavía recursos de entrada.
	auto Accion = [this](const TCHAR* Nombre, EInputActionValueType Tipo)
	{
		UInputAction* Nueva = NewObject<UInputAction>(this, Nombre);
		Nueva->ValueType = Tipo;
		return Nueva;
	};
	AccionMover = Accion(TEXT("IA_Mover"), EInputActionValueType::Axis2D);
	AccionMirar = Accion(TEXT("IA_Mirar"), EInputActionValueType::Axis2D);
	AccionRapido = Accion(TEXT("IA_PasoRapido"), EInputActionValueType::Boolean);
	AccionInteractuar = Accion(TEXT("IA_Interactuar"), EInputActionValueType::Boolean);
	AccionDejar = Accion(TEXT("IA_Dejar"), EInputActionValueType::Boolean);
	AccionMano1 = Accion(TEXT("IA_Mano1"), EInputActionValueType::Boolean);
	AccionMano2 = Accion(TEXT("IA_Mano2"), EInputActionValueType::Boolean);
	AccionTapa = Accion(TEXT("IA_Tapa"), EInputActionValueType::Boolean);

	Contexto = NewObject<UInputMappingContext>(this, TEXT("IMC_Personaje"));
	auto Tecla = [this](UInputAction* Para, FKey Key, bool bEjeY, bool bNegar)
	{
		FEnhancedActionKeyMapping& Mapa = Contexto->MapKey(Para, Key);
		if (bEjeY)
		{
			// La tecla da un valor en X; se pasa a Y (adelante/atrás).
			UInputModifierSwizzleAxis* Cambio = NewObject<UInputModifierSwizzleAxis>(Contexto);
			Cambio->Order = EInputAxisSwizzle::YXZ;
			Mapa.Modifiers.Add(Cambio);
		}
		if (bNegar)
		{
			Mapa.Modifiers.Add(NewObject<UInputModifierNegate>(Contexto));
		}
	};
	Tecla(AccionMover, EKeys::W, true, false);
	Tecla(AccionMover, EKeys::S, true, true);
	Tecla(AccionMover, EKeys::D, false, false);
	Tecla(AccionMover, EKeys::A, false, true);
	Tecla(AccionMover, EKeys::Up, true, false);
	Tecla(AccionMover, EKeys::Down, true, true);
	Tecla(AccionMover, EKeys::Right, false, false);
	Tecla(AccionMover, EKeys::Left, false, true);
	Contexto->MapKey(AccionMirar, EKeys::Mouse2D);
	Contexto->MapKey(AccionRapido, EKeys::LeftShift);
	Contexto->MapKey(AccionInteractuar, EKeys::E);
	Contexto->MapKey(AccionInteractuar, EKeys::LeftMouseButton);
	Contexto->MapKey(AccionDejar, EKeys::Q);
	Contexto->MapKey(AccionMano1, EKeys::One);
	Contexto->MapKey(AccionMano2, EKeys::Two);
	Contexto->MapKey(AccionTapa, EKeys::F);
}

void AExperimentaPersonaje::PawnClientRestart()
{
	Super::PawnClientRestart();
	CrearEntrada();
	if (const APlayerController* Jugador = Cast<APlayerController>(GetController()))
	{
		if (UEnhancedInputLocalPlayerSubsystem* Entrada = ULocalPlayer::GetSubsystem<UEnhancedInputLocalPlayerSubsystem>(Jugador->GetLocalPlayer()))
		{
			Entrada->AddMappingContext(Contexto, 0);
		}
	}
}

void AExperimentaPersonaje::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
	Super::SetupPlayerInputComponent(PlayerInputComponent);
	CrearEntrada();
	if (UEnhancedInputComponent* Entrada = Cast<UEnhancedInputComponent>(PlayerInputComponent))
	{
		Entrada->BindAction(AccionMover, ETriggerEvent::Triggered, this, &AExperimentaPersonaje::AlMover);
		Entrada->BindAction(AccionMirar, ETriggerEvent::Triggered, this, &AExperimentaPersonaje::AlMirar);
		Entrada->BindAction(AccionRapido, ETriggerEvent::Started, this, &AExperimentaPersonaje::AlEmpezarRapido);
		Entrada->BindAction(AccionRapido, ETriggerEvent::Completed, this, &AExperimentaPersonaje::AlTerminarRapido);
		Entrada->BindAction(AccionInteractuar, ETriggerEvent::Started, this, &AExperimentaPersonaje::AlInteractuar);
		Entrada->BindAction(AccionInteractuar, ETriggerEvent::Triggered, this, &AExperimentaPersonaje::AlMantener);
		Entrada->BindAction(AccionTapa, ETriggerEvent::Started, this, &AExperimentaPersonaje::AlTapa);
		Entrada->BindAction(AccionDejar, ETriggerEvent::Started, this, &AExperimentaPersonaje::AlDejar);
		Entrada->BindAction(AccionMano1, ETriggerEvent::Started, this, &AExperimentaPersonaje::AlMano1);
		Entrada->BindAction(AccionMano2, ETriggerEvent::Started, this, &AExperimentaPersonaje::AlMano2);
	}
	else
	{
		UE_LOG(LogExperimentaPersonaje, Error, TEXT("El componente de entrada no es EnhancedInputComponent: sin controles."));
	}
}

void AExperimentaPersonaje::AlMover(const FInputActionValue& Valor) { Mover(Valor.Get<FVector2D>()); }
void AExperimentaPersonaje::AlMirar(const FInputActionValue& Valor) { Mirar(Valor.Get<FVector2D>()); }
void AExperimentaPersonaje::AlEmpezarRapido(const FInputActionValue& Valor) { FijarPasoRapido(true); }
void AExperimentaPersonaje::AlTerminarRapido(const FInputActionValue& Valor) { FijarPasoRapido(false); }
void AExperimentaPersonaje::AlInteractuar(const FInputActionValue& Valor) { Interactuar(); }
void AExperimentaPersonaje::AlMantener(const FInputActionValue& Valor) { Verter(GetWorld()->GetDeltaSeconds()); }
void AExperimentaPersonaje::AlDejar(const FInputActionValue& Valor) { Dejar(); }
void AExperimentaPersonaje::AlMano1(const FInputActionValue& Valor) { SeleccionarMano(0); }
void AExperimentaPersonaje::AlMano2(const FInputActionValue& Valor) { SeleccionarMano(1); }
void AExperimentaPersonaje::AlTapa(const FInputActionValue& Valor) { AlternarTapa(); }

void AExperimentaPersonaje::Mover(FVector2D Eje)
{
	AddMovementInput(GetActorForwardVector(), Eje.Y);
	AddMovementInput(GetActorRightVector(), Eje.X);
}

void AExperimentaPersonaje::Mirar(FVector2D Eje)
{
	// El mando aplica después sus escalas (2,5 en guiñada y -2,5 en cabeceo).
	AddControllerYawInput(Eje.X * 0.07f * SensibilidadRaton);
	AddControllerPitchInput(-Eje.Y * 0.07f * SensibilidadRaton);
}

void AExperimentaPersonaje::FijarPasoRapido(bool bRapido)
{
	GetCharacterMovement()->MaxWalkSpeed = bRapido ? VelocidadRapida : VelocidadCaminar;
}

void AExperimentaPersonaje::MirarHacia(const FVector& Punto)
{
	if (AController* Mando = GetController())
	{
		Mando->SetControlRotation((Punto - Camara->GetComponentLocation()).Rotation());
	}
}

// ---------------------------------------------------------------------------------- Avisos

void AExperimentaPersonaje::Avisar(const FString& Texto)
{
	// Mientras se mantiene una tecla el mismo aviso llega en cada fotograma: solo se registra una vez.
	const bool bRepetido = MensajeRestante > 0.0f && Mensaje == Texto;
	Mensaje = Texto;
	MensajeRestante = 3.5f;
	if (!bRepetido)
	{
		UE_LOG(LogExperimentaPersonaje, Display, TEXT("AVISO %s"), *Texto);
	}
}

void AExperimentaPersonaje::SeleccionarMano(int32 Mano)
{
	ManoActiva = FMath::Clamp(Mano, 0, 1);
}

FString AExperimentaPersonaje::NombreEnMano(int32 Mano) const
{
	return (Mano >= 0 && Mano < 2 && EnMano[Mano]) ? EnMano[Mano]->NombreVisible : FString();
}

FString AExperimentaPersonaje::MensajeActual() const
{
	return MensajeRestante > 0.0f ? Mensaje : FString();
}

FString AExperimentaPersonaje::AvisoContextual() const
{
	const ARecipienteActor* Llevado = EnMano[ManoActiva];
	if (Apuntado)
	{
		const FString Contenido = Apuntado->DescripcionContenido();
		const FString Detalle = Contenido.IsEmpty() ? Apuntado->NombreVisible
			: FString::Printf(TEXT("%s · %s"), *Apuntado->NombreVisible, *Contenido);
		if (Llevado && Llevado->Rol == ERolRecipiente::Frasco && Apuntado->Rol == ERolRecipiente::Probeta)
		{
			return FString::Printf(TEXT("Mantén E  Verter %s\n%s"), *Llevado->NombreVisible, *Detalle);
		}
		if (Llevado && (Llevado->Rol == ERolRecipiente::Probeta || Llevado->Rol == ERolRecipiente::Pipeta || Llevado->Rol == ERolRecipiente::Navecilla)
			&& Apuntado->Rol == ERolRecipiente::Matraz)
		{
			return FString::Printf(TEXT("E  Verter aquí · %s\n%s"), *Llevado->DescripcionContenido(), *Detalle);
		}
		if (Llevado && Llevado->Rol == ERolRecipiente::Tarro && Apuntado->Rol == ERolRecipiente::Navecilla)
		{
			return FString::Printf(TEXT("Mantén E  Echar %s\n%s"), *Llevado->NombreVisible, *Detalle);
		}
		if (Llevado && Llevado->Rol == ERolRecipiente::Pipeta && Apuntado->Rol == ERolRecipiente::Frasco)
		{
			return FString::Printf(TEXT("Mantén E  Aspirar · pipeta: %s\n%s"), *Llevado->DescripcionContenido(), *Detalle);
		}
		if (Llevado && Llevado->Rol == ERolRecipiente::Gotero && Apuntado->Rol == ERolRecipiente::Matraz)
		{
			return FString::Printf(TEXT("E  Añadir una gota · %s\n%s"), *Llevado->NombreVisible, *Detalle);
		}
		const bool bHayManoLibre = !EnMano[0] || !EnMano[1];
		FString Linea = bHayManoLibre ? FString::Printf(TEXT("E  Recoger · %s"), *Detalle)
			: FString::Printf(TEXT("%s · manos ocupadas"), *Detalle);
		if (Apuntado->Rol == ERolRecipiente::Frasco && Apuntado->TieneTapa())
		{
			Linea += Apuntado->EstaTapado() ? TEXT("\nF  Destapar") : TEXT("\nF  Tapar");
		}
		return Linea;
	}
	if (PuertaApuntada)
	{
		return FString::Printf(TEXT("E  %s · %s"), PuertaApuntada->EstaAbierta() ? TEXT("Cerrar") : TEXT("Abrir"), *PuertaApuntada->NombreVisible);
	}
	if (bSuperficieApuntada && Llevado)
	{
		return FString::Printf(TEXT("Q  Dejar · %s"), *Llevado->NombreVisible);
	}
	return FString();
}

// ---------------------------------------------------------------------------------- Puntería

void AExperimentaPersonaje::ActualizarPunteria()
{
	Apuntado = nullptr;
	PuertaApuntada = nullptr;
	bSuperficieApuntada = false;
	const FVector Inicio = Camara->GetComponentLocation();
	// Se usa la rotación de control, no la del componente de cámara: esta última no se actualiza hasta
	// el siguiente fotograma, y apuntar y actuar en el mismo fotograma (un tirón, la prueba automática)
	// lanzaba el rayo hacia donde se miraba antes.
	const FVector Fin = Inicio + GetControlRotation().Vector() * AlcanceCm;
	FCollisionQueryParams Parametros(SCENE_QUERY_STAT(PunteriaPersonaje), true, this);
	for (ARecipienteActor* Llevado : EnMano)
	{
		if (Llevado)
		{
			Parametros.AddIgnoredActor(Llevado);
		}
	}
	FHitResult Impacto;
	if (!GetWorld()->LineTraceSingleByChannel(Impacto, Inicio, Fin, ECC_Visibility, Parametros))
	{
		UltimoImpacto = TEXT("nada");
		return;
	}
	UltimoImpacto = FString::Printf(TEXT("%s a %.0f cm"), Impacto.GetActor() ? *Impacto.GetActor()->GetActorNameOrLabel() : TEXT("?"), Impacto.Distance);
	PuntoApuntado = Impacto.ImpactPoint;
	if (ARecipienteActor* Recipiente = Cast<ARecipienteActor>(Impacto.GetActor()))
	{
		Apuntado = Recipiente->RecipienteRaiz();
	}
	else if (APuertaActor* Puerta = Cast<APuertaActor>(Impacto.GetActor()))
	{
		PuertaApuntada = Puerta;
	}
	else if (Impacto.ImpactNormal.Z > 0.7f)
	{
		// Superficie horizontal (encimera, balda, suelo): sirve para dejar cosas.
		bSuperficieApuntada = true;
	}
}

// ---------------------------------------------------------------------------------- Gestos

bool AExperimentaPersonaje::ManoOcupada(int32 Mano) const
{
	const FGesto& G = Gestos[FMath::Clamp(Mano, 0, 1)];
	return G.bPendiente || G.Continuo > 0.0f || G.Extension > 0.03f;
}

bool AExperimentaPersonaje::IniciarGesto(int32 Mano, const FVector& Punto, bool bInclinar, float Espera, TFunction<void()> AlLlegar)
{
	if (ManoOcupada(Mano))
	{
		return false;
	}
	FGesto& G = Gestos[Mano];
	G.Punto = Punto;
	G.ExtensionDeseada = 1.0f;
	G.InclinacionDeseada = bInclinar ? 1.0f : 0.0f;
	G.bPendiente = true;
	G.Espera = Espera;
	G.AlLlegar = MoveTemp(AlLlegar);
	return true;
}

void AExperimentaPersonaje::ActualizarGestos(float DeltaSeconds)
{
	for (FGesto& G : Gestos)
	{
		if (G.Continuo > 0.0f)
		{
			// Vertido mantenido: la mano sigue sobre el recipiente mientras dure la pulsación.
			G.Continuo -= DeltaSeconds;
			G.ExtensionDeseada = 1.0f;
			G.InclinacionDeseada = G.bContinuoInclina ? 1.0f : 0.0f;
		}
		else if (!G.bPendiente && G.ExtensionDeseada > 0.0f)
		{
			G.Espera -= DeltaSeconds;
			if (G.Espera <= 0.0f)
			{
				G.ExtensionDeseada = 0.0f;
				G.InclinacionDeseada = 0.0f;
			}
		}
		// Al volver, primero se endereza el recipiente y después se recoge el brazo.
		const bool bEnderezando = G.InclinacionDeseada <= 0.0f && G.Inclinacion > 0.05f;
		G.Inclinacion = FMath::FInterpConstantTo(G.Inclinacion, G.InclinacionDeseada, DeltaSeconds, 1.0f / SegundosInclinar);
		if (!bEnderezando)
		{
			G.Extension = FMath::FInterpConstantTo(G.Extension, G.ExtensionDeseada, DeltaSeconds, 1.0f / SegundosEstirar);
		}
		if (G.bPendiente && G.Extension >= 0.999f && (G.InclinacionDeseada < 0.5f || G.Inclinacion >= 0.999f))
		{
			G.bPendiente = false;
			if (G.AlLlegar)
			{
				TFunction<void()> Accion = MoveTemp(G.AlLlegar);
				G.AlLlegar = nullptr;
				Accion();
			}
		}
	}
}

void AExperimentaPersonaje::AnimarManos(float DeltaSeconds)
{
	TiempoManos += DeltaSeconds;
	const float Velocidad = GetVelocity().Size2D();
	const float Marcha = FMath::Clamp(Velocidad / VelocidadCaminar, 0.0f, 1.6f);
	// El balanceo avanza con la distancia recorrida: un ciclo cada 150 cm.
	FasePaso += Velocidad * DeltaSeconds / 150.0f * UE_TWO_PI;

	// Inercia al girar: las manos se retrasan un poco respecto a la cámara y vuelven.
	const float Guinada = GetActorRotation().Yaw;
	const float Giro = FMath::FindDeltaAngleDegrees(GuinadaPrevia, Guinada);
	GuinadaPrevia = Guinada;
	InerciaGiro = FMath::FInterpTo(InerciaGiro + Giro * 0.06f, 0.0f, DeltaSeconds, 7.0f);
	InerciaGiro = FMath::Clamp(InerciaGiro, -3.0f, 3.0f);

	FVector Desplazamiento;
	Desplazamiento.X = 0.0f;
	Desplazamiento.Y = FMath::Sin(FasePaso * 0.5f) * 0.5f * Marcha - InerciaGiro;
	Desplazamiento.Z = FMath::Abs(FMath::Sin(FasePaso * 0.5f)) * -0.7f * Marcha + FMath::Sin(TiempoManos * 1.3f) * 0.18f;
	ManosRaiz->SetRelativeLocation(ManosBase + Desplazamiento);

	// Gestos: cada mano va de su posición de reposo hacia su punto, con arranque y frenada suaves.
	const FTransform Raiz = ManosRaiz->GetComponentTransform();
	for (int32 Mano = 0; Mano < 2; ++Mano)
	{
		const FGesto& G = Gestos[Mano];
		const float Lado = Mano == 0 ? 1.0f : -1.0f;
		UStaticMeshComponent* Componente = ComponenteMano(Mano);
		FVector Posicion = ManoBase[Mano];
		FRotator Rotacion = ManoRotacionBase[Mano];
		if (G.Extension > 0.0f || G.Inclinacion > 0.0f)
		{
			// Se quiere que el punto de agarre (no el origen de la mano) quede en el objetivo.
			FVector Delta = Raiz.InverseTransformPosition(G.Punto) - ManoRotacionBase[Mano].RotateVector(AgarreLocal(Lado)) - ManoBase[Mano];
			Delta = Delta.GetClampedToMaxSize(62.0f);   // largo útil del brazo
			const float Suave = FMath::InterpEaseInOut(0.0f, 1.0f, G.Extension, 2.0f);
			Posicion += Delta * Suave;
			// La muñeca gira hacia dentro para volcar el recipiente.
			Rotacion.Roll += -95.0f * Lado * FMath::InterpEaseInOut(0.0f, 1.0f, G.Inclinacion, 2.0f);
		}
		Componente->SetRelativeLocationAndRotation(Posicion, Rotacion);
	}
}

void AExperimentaPersonaje::LlevarObjetos()
{
	// Los objetos siguen a su mano. Van de pie salvo al verter, cuando se vuelcan con la muñeca.
	// Las manos son estáticas: el objeto queda junto a la palma, no rodeado por los dedos.
	for (int32 Mano = 0; Mano < 2; ++Mano)
	{
		ARecipienteActor* Objeto = EnMano[Mano];
		if (!Objeto)
		{
			continue;
		}
		const float Lado = Mano == 0 ? 1.0f : -1.0f;
		const FVector Agarre = ComponenteMano(Mano)->GetComponentTransform().TransformPosition(AgarreLocal(Lado));
		const float Vuelco = -100.0f * Lado * FMath::InterpEaseInOut(0.0f, 1.0f, Gestos[Mano].Inclinacion, 2.0f);
		// El frente del objeto (su etiqueta) mira al jugador; el vuelco gira sobre el eje de la mirada.
		const FQuat Giro = FQuat(GetActorForwardVector(), FMath::DegreesToRadians(Vuelco)) * FRotator(0.0f, GetActorRotation().Yaw + 180.0f, 0.0f).Quaternion();
		Objeto->SetActorLocationAndRotation(Agarre - Giro.RotateVector(FVector(0.0f, 0.0f, Objeto->AlturaAgarreCm)), Giro);
	}
}

// ---------------------------------------------------------------------------------- Acciones

bool AExperimentaPersonaje::AlternarTapa()
{
	ActualizarPunteria();
	if (!Apuntado || Apuntado->Rol != ERolRecipiente::Frasco || !Apuntado->TieneTapa())
	{
		return false;
	}
	// La tapa se deja a la derecha del jugador, que es donde la soltaría la mano.
	Apuntado->AlternarTapa(GetActorRightVector());
	UE_LOG(LogExperimentaPersonaje, Display, TEXT("TAPA %s -> %s"), *Apuntado->NombreVisible,
		Apuntado->EstaTapado() ? TEXT("tapado") : TEXT("destapado"));
	return true;
}

bool AExperimentaPersonaje::Verter(float Segundos)
{
	ARecipienteActor* Llevado = EnMano[ManoActiva];
	if (!Llevado || !Apuntado || Segundos <= 0.0f)
	{
		return false;
	}
	ARecipienteActor* Otro = Apuntado;
	const bool bFrascoAProbeta = Llevado->Rol == ERolRecipiente::Frasco && Otro->Rol == ERolRecipiente::Probeta;
	const bool bTarroANavecilla = Llevado->Rol == ERolRecipiente::Tarro && Otro->Rol == ERolRecipiente::Navecilla;
	const bool bPipetaDeFrasco = Llevado->Rol == ERolRecipiente::Pipeta && Otro->Rol == ERolRecipiente::Frasco;
	if (!bFrascoAProbeta && !bTarroANavecilla && !bPipetaDeFrasco)
	{
		return false;
	}
	// Quién da y quién recibe: la pipeta recibe del frasco apuntado; en los otros casos da lo que se lleva.
	ARecipienteActor* Origen = bPipetaDeFrasco ? Otro : Llevado;
	ARecipienteActor* Receptor = bPipetaDeFrasco ? Llevado : Otro;
	if (Origen->bSinModelo)
	{
		Avisar(FString::Printf(TEXT("«%s» todavía no tiene modelo químico en el simulador."), *Origen->NombreVisible));
		return false;
	}
	if (Origen->Rol == ERolRecipiente::Frasco && Origen->EstaTapado())
	{
		Avisar(bPipetaDeFrasco ? TEXT("El frasco está tapado. Destápalo con F.") : TEXT("El frasco está tapado. Déjalo en la mesa y destápalo con F."));
		return false;
	}
	const TCHAR* NombreReceptor = bTarroANavecilla ? TEXT("La navecilla") : (bPipetaDeFrasco ? TEXT("La pipeta") : TEXT("La probeta"));
	if (Receptor->VolumenML > (bTarroANavecilla ? 0.004f : 0.05f) && Receptor->ReactivoId != Origen->ReactivoId)
	{
		Avisar(FString::Printf(TEXT("%s ya contiene %s. Vacíala antes de usarla con otro reactivo."), NombreReceptor,
			*UMezclaComponent::NombreReactivo(Receptor->ReactivoId)));
		return false;
	}
	const float Hueco = Receptor->CapacidadML - Receptor->VolumenML;
	// Los tarros no llevan cuenta de su contenido: se dan por llenos.
	const float Disponible = Origen->Rol == ERolRecipiente::Tarro ? TNumericLimits<float>::Max() : Origen->VolumenML;
	if (Hueco <= 0.0f || Disponible <= 0.0f)
	{
		Avisar(Hueco <= 0.0f ? FString::Printf(TEXT("%s está llena."), NombreReceptor) : FString(TEXT("El frasco está vacío.")));
		return false;
	}
	FGesto& G = Gestos[ManoActiva];
	if (G.bPendiente)
	{
		return false;
	}
	// El brazo lleva lo que tiene en la mano sobre el otro recipiente; lo vuelca salvo que sea la pipeta,
	// que baja a la boca del frasco. Nada pasa hasta que la mano está en su sitio.
	const float Lado = ManoActiva == 0 ? 1.0f : -1.0f;
	G.bContinuoInclina = !bPipetaDeFrasco;
	G.Punto = bPipetaDeFrasco ? TopeDe(Otro) + FVector(0.0f, 0.0f, Llevado->AlturaAgarreCm - 4.0f)
		: TopeDe(Otro) + FVector(0.0f, 0.0f, 9.0f) + GetActorRightVector() * Lado * 9.0f;
	G.Continuo = 0.2f;
	if (G.Extension < 0.9f || (G.bContinuoInclina && G.Inclinacion < 0.7f))
	{
		return false;
	}
	const float Caudal = bTarroANavecilla ? CaudalGramosPorSegundo : (bPipetaDeFrasco ? CaudalPipetaMLPorSegundo : CaudalMLPorSegundo);
	const float Cantidad = FMath::Min3(Caudal * Segundos, Disponible, Hueco);
	Receptor->ReactivoId = Origen->ReactivoId;
	Receptor->FijarVolumen(Receptor->VolumenML + Cantidad);
	if (Origen->Rol != ERolRecipiente::Tarro)
	{
		Origen->FijarVolumen(Origen->VolumenML - Cantidad);
	}
	if (bFrascoAProbeta)
	{
		MostrarChorro(TopeDe(Llevado), TopeDe(Otro) - FVector(0.0f, 0.0f, 1.0f), 0.12f);
	}
	return true;
}

void AExperimentaPersonaje::MostrarChorro(const FVector& Desde, const FVector& Hasta, float Segundos)
{
	// Cilindro de 100 cm de alto y 100 de diámetro en la malla del motor: se escala a 4 mm de grosor
	// y al largo necesario, orientado de la boca del recipiente al destino.
	const FVector Eje = Hasta - Desde;
	const float Largo = Eje.Size();
	if (Largo < 0.5f)
	{
		return;
	}
	Chorro->SetWorldLocationAndRotation((Desde + Hasta) * 0.5f, FRotationMatrix::MakeFromZ(Eje).Rotator());
	Chorro->SetWorldScale3D(FVector(0.004f, 0.004f, Largo / 100.0f));
	Chorro->SetVisibility(true);
	ChorroRestante = Segundos;
}

bool AExperimentaPersonaje::AnadirSolido(ARecipienteActor* Navecilla, ARecipienteActor* Matraz)
{
	// La balanza lee centésimas de gramo.
	const float Gramos = FMath::RoundToFloat(Navecilla->VolumenML * 100.0f) / 100.0f;
	if (Gramos <= 0.0f)
	{
		Avisar(TEXT("La navecilla está vacía."));
		return false;
	}
	UMezclaComponent* Mezcla = Matraz->Mezcla();
	if (!Mezcla)
	{
		Avisar(TEXT("Este recipiente no admite mezclas."));
		return false;
	}
	FString Respuesta;
	if (!Mezcla->AnadirReactivo(Navecilla->ReactivoId, Gramos, Respuesta))
	{
		Avisar(Respuesta);
		return false;
	}
	UE_LOG(LogExperimentaPersonaje, Display, TEXT("SOLIDO %s g de %s en %s -> %s mL; pH %.2f; %.1f C; solido %s %.4f g; reglas [%s]"),
		*UMezclaComponent::FormatoEs(Gramos, 2), *UMezclaComponent::NombreReactivo(Navecilla->ReactivoId), *Matraz->NombreVisible,
		*UMezclaComponent::FormatoEs(Mezcla->VolumenML(), 1), Mezcla->PH(), Mezcla->TemperaturaC(), *Mezcla->SolidoPrincipal(),
		Mezcla->SolidosGramos(), *FString::Join(Mezcla->ReglasUltimaAdicion(), TEXT(", ")));
	Navecilla->FijarVolumen(0.0f);
	return true;
}

bool AExperimentaPersonaje::VerterProbetaEnMatraz(ARecipienteActor* Probeta, ARecipienteActor* Matraz)
{
	// La probeta entrega su lectura redondeada a 0,1 mL, como en la versión web.
	const float Cantidad = FMath::RoundToFloat(Probeta->VolumenML * 10.0f) / 10.0f;
	if (Cantidad <= 0.0f)
	{
		Avisar(TEXT("La probeta está vacía."));
		return false;
	}
	UMezclaComponent* Mezcla = Matraz->Mezcla();
	if (!Mezcla)
	{
		Avisar(TEXT("Este recipiente no admite mezclas."));
		return false;
	}
	if (Matraz->CapacidadML > 0.0f && Mezcla->VolumenML() + Cantidad > Matraz->CapacidadML)
	{
		Avisar(FString::Printf(TEXT("No cabe: se desbordaría (caben %s mL)."), *UMezclaComponent::FormatoEs(Matraz->CapacidadML, 0)));
		return false;
	}
	FString Respuesta;
	if (!Mezcla->AnadirReactivo(Probeta->ReactivoId, Cantidad, Respuesta))
	{
		// El modelo químico decide: fuera de rango, desborde… Se muestra su mensaje tal cual.
		Avisar(Respuesta);
		return false;
	}
	UE_LOG(LogExperimentaPersonaje, Display, TEXT("VERTIDO %s mL de %s en %s -> %s mL; pH %.2f; %.1f C; solido %s %.4f g; reglas [%s]"),
		*UMezclaComponent::FormatoEs(Cantidad, 1), *UMezclaComponent::NombreReactivo(Probeta->ReactivoId), *Matraz->NombreVisible,
		*UMezclaComponent::FormatoEs(Mezcla->VolumenML(), 1), Mezcla->PH(), Mezcla->TemperaturaC(), *Mezcla->SolidoPrincipal(),
		Mezcla->SolidosGramos(), *FString::Join(Mezcla->ReglasUltimaAdicion(), TEXT(", ")));
	if (Matraz->bDePractica)
	{
		Practica->RegistrarAdicion(Probeta->ReactivoId, Cantidad, Mezcla->ReglasUltimaAdicion());
		if (Practica->Completada())
		{
			Avisar(FString::Printf(TEXT("¡%s: experimento completado!"), *Practica->Titulo()));
		}
	}
	MostrarChorro(TopeDe(Probeta), TopeDe(Matraz) - FVector(0.0f, 0.0f, 1.0f), 0.5f);
	Probeta->FijarVolumen(0.0f);
	return true;
}

bool AExperimentaPersonaje::AnadirGota(ARecipienteActor* Gotero, ARecipienteActor* Matraz)
{
	UMezclaComponent* Mezcla = Matraz->Mezcla();
	if (!Mezcla)
	{
		Avisar(TEXT("Este recipiente no admite mezclas."));
		return false;
	}
	FString Respuesta;
	if (!Mezcla->AnadirReactivo(Gotero->ReactivoId, 1.0f, Respuesta))
	{
		Avisar(Respuesta);
		return false;
	}
	UE_LOG(LogExperimentaPersonaje, Display, TEXT("GOTA de %s en %s -> %s mL; pH %.2f; color %s intensidad %.2f"),
		*Gotero->NombreVisible, *Matraz->NombreVisible, *UMezclaComponent::FormatoEs(Mezcla->VolumenML(), 2), Mezcla->PH(),
		*Mezcla->ColorModeloHex(), Mezcla->IntensidadColor());
	return true;
}

bool AExperimentaPersonaje::Interactuar()
{
	ActualizarPunteria();
	const int32 Activa = ManoActiva;
	ARecipienteActor* Llevado = EnMano[Activa];

	if (PuertaApuntada)
	{
		APuertaActor* Puerta = PuertaApuntada;
		// La abre la mano libre, si la hay; con las dos ocupadas se empuja sin gesto.
		const int32 Libre = !EnMano[Activa] ? Activa : (!EnMano[1 - Activa] ? 1 - Activa : -1);
		UE_LOG(LogExperimentaPersonaje, Display, TEXT("PUERTA %s -> %s"), *Puerta->NombreVisible, Puerta->EstaAbierta() ? TEXT("cerrar") : TEXT("abrir"));
		if (Libre < 0 || !IniciarGesto(Libre, PuntoApuntado, false, 0.12f, [Puerta]() { Puerta->Alternar(); }))
		{
			Puerta->Alternar();
		}
		return true;
	}
	if (!Apuntado)
	{
		return false;
	}
	ARecipienteActor* Destino = Apuntado;
	const float Lado = Activa == 0 ? 1.0f : -1.0f;
	// Con algo en la mano seleccionada, E sobre otro recipiente es verter, no recoger.
	if (Llevado)
	{
		const FVector SobreDestino = TopeDe(Destino) + FVector(0.0f, 0.0f, 9.0f) + GetActorRightVector() * Lado * 9.0f;
		if (Llevado->Rol == ERolRecipiente::Navecilla && Destino->Rol == ERolRecipiente::Matraz)
		{
			return IniciarGesto(Activa, SobreDestino, true, 0.4f, [this, Llevado, Destino]() { AnadirSolido(Llevado, Destino); });
		}
		if ((Llevado->Rol == ERolRecipiente::Tarro && Destino->Rol == ERolRecipiente::Navecilla)
			|| (Llevado->Rol == ERolRecipiente::Pipeta && Destino->Rol == ERolRecipiente::Frasco))
		{
			return true;   // lo hace Verter() mientras se mantiene la tecla
		}
		if ((Llevado->Rol == ERolRecipiente::Probeta || Llevado->Rol == ERolRecipiente::Pipeta) && Destino->Rol == ERolRecipiente::Matraz)
		{
			return IniciarGesto(Activa, SobreDestino, true, 0.55f, [this, Llevado, Destino]() { VerterProbetaEnMatraz(Llevado, Destino); });
		}
		if (Llevado->Rol == ERolRecipiente::Gotero && Destino->Rol == ERolRecipiente::Matraz)
		{
			if (Llevado->bSinModelo)
			{
				Avisar(FString::Printf(TEXT("«%s» todavía no tiene modelo químico en el simulador."), *Llevado->NombreVisible));
				return false;
			}
			return IniciarGesto(Activa, SobreDestino, true, 0.3f, [this, Llevado, Destino]() { AnadirGota(Llevado, Destino); });
		}
		if (Llevado->Rol == ERolRecipiente::Frasco && Destino->Rol == ERolRecipiente::Probeta)
		{
			return true;   // lo hace Verter() mientras se mantiene la tecla
		}
		if (Llevado->Rol == ERolRecipiente::Frasco && Destino->Rol == ERolRecipiente::Matraz)
		{
			Avisar(TEXT("Mide primero el reactivo con la probeta."));
			return false;
		}
		if (Llevado->Rol == ERolRecipiente::Tarro && (Destino->Rol == ERolRecipiente::Matraz || Destino->Rol == ERolRecipiente::Probeta))
		{
			Avisar(TEXT("Pesa primero el sólido: échalo en la navecilla que está sobre la balanza."));
			return false;
		}
	}
	int32 Mano = Activa;
	if (EnMano[Mano])
	{
		Mano = 1 - Mano;
	}
	if (EnMano[Mano])
	{
		Avisar(TEXT("Las dos manos están ocupadas. Deja algo con Q."));
		return false;
	}
	// El brazo se estira hasta el objeto y lo recoge al llegar.
	const bool bEmpezado = IniciarGesto(Mano, Destino->GetActorLocation() + FVector(0.0f, 0.0f, Destino->AlturaAgarreCm), false, 0.0f,
		[this, Destino, Mano]()
		{
			if (EnMano[0] == Destino || EnMano[1] == Destino || EnMano[Mano])
			{
				return;
			}
			Destino->FijarColisionConjunta(false);
			EnMano[Mano] = Destino;
			UE_LOG(LogExperimentaPersonaje, Display, TEXT("RECOGIDO %s con la mano %s"), *Destino->NombreVisible,
				Mano == 0 ? TEXT("derecha") : TEXT("izquierda"));
		});
	if (bEmpezado)
	{
		ManoActiva = Mano;
	}
	return bEmpezado;
}

bool AExperimentaPersonaje::Dejar()
{
	const int32 Mano = ManoActiva;
	ARecipienteActor* Objeto = EnMano[Mano];
	if (!Objeto)
	{
		Avisar(TEXT("Esta mano está vacía."));
		return false;
	}
	ActualizarPunteria();
	if (!bSuperficieApuntada)
	{
		Avisar(TEXT("Apunta a una superficie libre para dejarlo."));
		return false;
	}
	const FVector Sitio = PuntoApuntado;
	const float Guinada = GetActorRotation().Yaw + 180.0f;
	// El brazo lleva el objeto hasta el sitio y lo suelta al llegar, de pie y con la etiqueta hacia el jugador.
	// No se comprueba si pisa otro objeto.
	return IniciarGesto(Mano, Sitio + FVector(0.0f, 0.0f, Objeto->AlturaAgarreCm), false, 0.0f, [this, Objeto, Mano, Sitio, Guinada]()
	{
		if (EnMano[Mano] != Objeto)
		{
			return;
		}
		EnMano[Mano] = nullptr;
		Objeto->SetActorLocationAndRotation(Sitio, FRotator(0.0f, Guinada, 0.0f));
		Objeto->FijarColisionConjunta(true);
		UE_LOG(LogExperimentaPersonaje, Display, TEXT("DEJADO %s en (%.1f, %.1f, %.1f)"), *Objeto->NombreVisible, Sitio.X, Sitio.Y, Sitio.Z);
	});
}

// ---------------------------------------------------------------------------------- Guía

AActor* AExperimentaPersonaje::ObjetivoGuia(FString& Etiqueta) const
{
	Etiqueta.Reset();
	const int32 Indice = Practica->PasoActual();
	if (Indice < 0 || !GetWorld())
	{
		return nullptr;
	}
	const FPasoPractica Paso = Practica->Pasos()[Indice];

	// Material de la práctica: se prefiere el marcado como «de práctica» (hay más frascos en la vitrina).
	ARecipienteActor* Probeta = nullptr;
	ARecipienteActor* Matraz = nullptr;
	ARecipienteActor* Frasco = nullptr;
	auto Mejor = [](ARecipienteActor*& Actual, ARecipienteActor* Candidato)
	{
		if (!Actual || (Candidato->bDePractica && !Actual->bDePractica))
		{
			Actual = Candidato;
		}
	};
	for (TActorIterator<ARecipienteActor> It(GetWorld()); It; ++It)
	{
		ARecipienteActor* Recipiente = *It;
		if (Recipiente->Rol == ERolRecipiente::Probeta)
		{
			Mejor(Probeta, Recipiente);
		}
		else if (Recipiente->Rol == ERolRecipiente::Matraz && Recipiente->Mezcla() && Recipiente->Mezcla()->DemoPasos.Num() == 0)
		{
			Mejor(Matraz, Recipiente);
		}
		else if (Recipiente->Rol == ERolRecipiente::Frasco && !Recipiente->bSinModelo && Recipiente->ReactivoId == Paso.ReactivoId)
		{
			Mejor(Frasco, Recipiente);
		}
	}
	if (Paso.Clave == TEXT("observe"))
	{
		Etiqueta = TEXT("Observa");
		return Matraz;
	}
	if (!Probeta || !Matraz || !Frasco)
	{
		return nullptr;
	}
	const bool bProbetaEnMano = EnMano[0] == Probeta || EnMano[1] == Probeta;
	const bool bFrascoEnMano = EnMano[0] == Frasco || EnMano[1] == Frasco;
	const FString Cantidad = UMezclaComponent::FormatoEs(Paso.Cantidad, 0);
	// 1) Ya está medido: a verterlo.
	if (Probeta->ReactivoId == Paso.ReactivoId && Probeta->VolumenML >= Paso.Cantidad * 0.9f)
	{
		if (bFrascoEnMano && !bProbetaEnMano)
		{
			Etiqueta = TEXT("Q · Deja el frasco");
			return Frasco;
		}
		Etiqueta = bProbetaEnMano ? TEXT("E · Verter en el matraz") : TEXT("E · Recoge la probeta");
		return bProbetaEnMano ? Matraz : Probeta;
	}
	// 2) La probeta tiene otro reactivo (en la web aquí se pide enjuagar; todavía no hay piseta funcional).
	if (Probeta->VolumenML > 0.05f && Probeta->ReactivoId != Paso.ReactivoId)
	{
		Etiqueta = TEXT("La probeta tiene otro reactivo");
		return Probeta;
	}
	// 3) Con el frasco en la mano: llenar la probeta, que debe estar en la mesa.
	if (bFrascoEnMano)
	{
		if (bProbetaEnMano)
		{
			Etiqueta = TEXT("Q · Deja la probeta en la mesa");
			return Probeta;
		}
		Etiqueta = Frasco->EstaTapado() ? TEXT("Q · Déjalo y destápalo con F") : FString::Printf(TEXT("Mantén E · Llena hasta %s mL"), *Cantidad);
		return Frasco->EstaTapado() ? Frasco : Probeta;
	}
	// 4) Ir a por el reactivo.
	Etiqueta = Frasco->EstaTapado() ? FString::Printf(TEXT("F · Destapa · %s"), *UMezclaComponent::NombreReactivo(Paso.ReactivoId))
		: FString::Printf(TEXT("E · Recoge · %s"), *UMezclaComponent::NombreReactivo(Paso.ReactivoId));
	return Frasco;
}

// ---------------------------------------------------------------------------------- Ciclo

void AExperimentaPersonaje::BeginPlay()
{
	Super::BeginPlay();
	// Se carga aquí y no en el constructor: una referencia fija impediría al guion del nivel regenerar el material.
	if (UMaterialInterface* MaterialChorro = LoadObject<UMaterialInterface>(nullptr, TEXT("/Game/Laboratorio/Materiales/M_Liquido_Incoloro.M_Liquido_Incoloro")))
	{
		Chorro->SetMaterial(0, MaterialChorro);
	}
	GetCharacterMovement()->MaxWalkSpeed = VelocidadCaminar;
	ManosBase = ManosRaiz->GetRelativeLocation();
	for (int32 Mano = 0; Mano < 2; ++Mano)
	{
		ManoBase[Mano] = ComponenteMano(Mano)->GetRelativeLocation();
		ManoRotacionBase[Mano] = ComponenteMano(Mano)->GetRelativeRotation();
	}
	GuinadaPrevia = GetActorRotation().Yaw;
	bPaseo = FParse::Param(FCommandLine::Get(), TEXT("ExperimentaPaseo"));
	UE_LOG(LogExperimentaPersonaje, Display, TEXT("PERSONAJE listo en (%.0f, %.0f, %.0f); manos %s/%s; jugador automatico %s"),
		GetActorLocation().X, GetActorLocation().Y, GetActorLocation().Z,
		ManoDerecha->GetStaticMesh() ? TEXT("derecha") : TEXT("SIN MALLA DERECHA"),
		ManoIzquierda->GetStaticMesh() ? TEXT("izquierda") : TEXT("SIN MALLA IZQUIERDA"), bPaseo ? TEXT("si") : TEXT("no"));
}

void AExperimentaPersonaje::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	if (bPaseo)
	{
		PaseoAutomatico(DeltaSeconds);
	}
	ActualizarGestos(DeltaSeconds);
	AnimarManos(DeltaSeconds);
	LlevarObjetos();
	ActualizarPunteria();
	MensajeRestante = FMath::Max(0.0f, MensajeRestante - DeltaSeconds);
	if (ChorroRestante > 0.0f)
	{
		ChorroRestante -= DeltaSeconds;
		if (ChorroRestante <= 0.0f)
		{
			Chorro->SetVisibility(false);
		}
	}
}

// ---------------------------------------------------------------------------------- Jugador automático de prueba

void AExperimentaPersonaje::IrFrenteA(const AActor* Actor, float Distancia, float AlturaMirada)
{
	// Solo para la prueba: se teletransporta delante del objeto, del lado del centro de la sala.
	FVector Centro, Extension;
	Actor->GetActorBounds(false, Centro, Extension);
	const FVector HaciaElCentro(-Centro.X, -Centro.Y, 0.0f);
	const FVector Direccion = FMath::Abs(HaciaElCentro.X) * 0.8f > FMath::Abs(HaciaElCentro.Y) + 0.0f && Extension.X < Extension.Y
		? FVector(FMath::Sign(HaciaElCentro.X), 0.0f, 0.0f)
		: (Extension.Y < Extension.X ? FVector(0.0f, FMath::Sign(HaciaElCentro.Y), 0.0f)
			: (FMath::Abs(HaciaElCentro.X) > FMath::Abs(HaciaElCentro.Y) ? FVector(FMath::Sign(HaciaElCentro.X), 0.0f, 0.0f) : FVector(0.0f, FMath::Sign(HaciaElCentro.Y), 0.0f)));
	FVector Sitio = Centro + Direccion * Distancia;
	Sitio.Z = GetActorLocation().Z;
	SetActorLocation(Sitio, false, nullptr, ETeleportType::TeleportPhysics);
	MirarHacia(FVector(Centro.X, Centro.Y, AlturaMirada > 0.0f ? AlturaMirada : Centro.Z));
}

void AExperimentaPersonaje::PasoDelBot(float DeltaSeconds)
{
	// Sigue la guía de la práctica con las mismas funciones que las teclas: lee la etiqueta del
	// objetivo y hace lo que pide. Así prueba a la vez la guía, los gestos y el procedimiento.
	FString Etiqueta;
	AActor* Objetivo = ObjetivoGuia(Etiqueta);
	if (!Objetivo)
	{
		return;
	}
	FVector Centro, Extension;
	Objetivo->GetActorBounds(false, Centro, Extension);
	ARecipienteActor* Recipiente = Cast<ARecipienteActor>(Objetivo);
	auto ManoCon = [this](const AActor* Algo) { return EnMano[0] == Algo ? 0 : (EnMano[1] == Algo ? 1 : -1); };
	auto ManoConRol = [this](ERolRecipiente Rol) { return (EnMano[0] && EnMano[0]->Rol == Rol) ? 0 : ((EnMano[1] && EnMano[1]->Rol == Rol) ? 1 : -1); };

	if (Etiqueta.StartsWith(TEXT("Mantén")))
	{
		SeleccionarMano(FMath::Max(0, ManoConRol(ERolRecipiente::Frasco)));
		MirarHacia(Centro);
		ActualizarPunteria();
		Verter(DeltaSeconds);
		return;
	}
	// Un jugador cuidadoso llena hasta la marca, no solo hasta el 90 % que acepta la práctica.
	const int32 Indice = Practica->PasoActual();
	if (Etiqueta == TEXT("Q · Deja el frasco") && Indice >= 0 && Apuntado && Apuntado->Rol == ERolRecipiente::Probeta
		&& Apuntado->VolumenML < Practica->Pasos()[Indice].Cantidad)
	{
		Verter(DeltaSeconds);
		return;
	}
	if (ManoOcupada(0) || ManoOcupada(1))
	{
		return;
	}
	EsperaBot -= DeltaSeconds;
	if (EsperaBot > 0.0f)
	{
		return;
	}
	EsperaBot = 0.5f;
	bool bHecho = false;
	if (Etiqueta.StartsWith(TEXT("F ")))
	{
		MirarHacia(Centro);
		bHecho = AlternarTapa();
	}
	else if (Etiqueta.StartsWith(TEXT("E · Recoge")))
	{
		MirarHacia(Centro);
		SeleccionarMano(!EnMano[0] ? 0 : 1);
		bHecho = Interactuar();
	}
	else if (Etiqueta.StartsWith(TEXT("Q")) && Recipiente)
	{
		const int32 Mano = ManoCon(Recipiente);
		if (Mano >= 0)
		{
			SeleccionarMano(Mano);
			MirarHacia(Recipiente->PosicionOrigen);
			bHecho = Dejar();
		}
	}
	else if (Etiqueta.StartsWith(TEXT("E · Verter")))
	{
		SeleccionarMano(FMath::Max(0, ManoConRol(ERolRecipiente::Probeta)));
		MirarHacia(Centro);
		bHecho = Interactuar();
	}
	else if (Etiqueta == TEXT("Observa"))
	{
		MirarHacia(Centro);
		bHecho = true;
	}
	if (Etiqueta != UltimaEtiquetaBot || !bHecho)
	{
		UltimaEtiquetaBot = Etiqueta;
		UE_LOG(LogExperimentaPersonaje, Display, TEXT("BOT t=%.1f paso %d «%s» sobre %s -> %s; rayo en %s; manos «%s» / «%s»"), TiempoPaseo,
			Practica->PasoActual() + 1, *Etiqueta, *Objetivo->GetActorNameOrLabel(), bHecho ? TEXT("hecho") : TEXT("NO HECHO"), *UltimoImpacto,
			*NombreEnMano(0), *NombreEnMano(1));
	}
}

ARecipienteActor* AExperimentaPersonaje::BuscarRecipiente(const FString& Nombre) const
{
	for (TActorIterator<ARecipienteActor> It(GetWorld()); It; ++It)
	{
		if (It->GetActorNameOrLabel() == Nombre)
		{
			return *It;
		}
	}
	return nullptr;
}

void AExperimentaPersonaje::OrdenesDelBot(float DeltaSeconds)
{
	const FOrdenBot& Orden = OrdenesBot[OrdenBot];
	ARecipienteActor* Objeto = BuscarRecipiente(Orden.Objeto);
	if (!Objeto)
	{
		UE_LOG(LogExperimentaPersonaje, Display, TEXT("BOT orden %d: no existe «%s» -> NO HECHO"), OrdenBot, *Orden.Objeto);
		OrdenBot = OrdenesBot.Num();
		return;
	}
	FVector Centro, Extension;
	Objeto->GetActorBounds(false, Centro, Extension);
	if (Orden.Tipo == 3)
	{
		// Mantener la acción (verter, echar, aspirar) hasta alcanzar la cantidad en quien recibe.
		if (!EnMano[0] && !EnMano[1])
		{
			return;   // la mano aún va de camino a recoger el objeto
		}
		const int32 Mano = EnMano[0] ? 0 : 1;
		const ARecipienteActor* Receptor = (EnMano[Mano] && EnMano[Mano]->Rol == ERolRecipiente::Pipeta) ? EnMano[Mano].Get() : Objeto;
		if (Receptor->VolumenML < Orden.Hasta)
		{
			SeleccionarMano(Mano);
			MirarHacia(Centro);
			ActualizarPunteria();
			Verter(DeltaSeconds);
			EsperaBot -= DeltaSeconds;
			if (EsperaBot < -12.0f)
			{
				UE_LOG(LogExperimentaPersonaje, Display, TEXT("BOT orden %d: mantener sobre «%s» sin llegar a %.1f -> NO HECHO; rayo en %s"), OrdenBot, *Orden.Objeto, Orden.Hasta, *UltimoImpacto);
				OrdenBot = OrdenesBot.Num();
			}
			return;
		}
		UE_LOG(LogExperimentaPersonaje, Display, TEXT("BOT orden %d: mantenido sobre «%s» hasta %s"), OrdenBot, *Orden.Objeto, *Receptor->DescripcionContenido());
		EsperaBot = 0.5f;
		++OrdenBot;
		return;
	}
	if (ManoOcupada(0) || ManoOcupada(1))
	{
		return;
	}
	EsperaBot -= DeltaSeconds;
	if (EsperaBot > 0.0f)
	{
		return;
	}
	EsperaBot = 0.5f;
	bool bHecho = false;
	switch (Orden.Tipo)
	{
	case 0:
		// Solo en la prueba: colocarse en el extremo de la mesa, como al llegar andando a la otra.
		SetActorLocation(FVector(64.0f, 110.0f, GetActorLocation().Z), false, nullptr, ETeleportType::TeleportPhysics);
		MirarHacia(Centro);
		bHecho = true;
		break;
	case 1:
		MirarHacia(Centro);
		SeleccionarMano(!EnMano[0] ? 0 : 1);
		bHecho = Interactuar();
		break;
	case 2:
		MirarHacia(Centro);
		bHecho = AlternarTapa();
		break;
	case 4:
		SeleccionarMano(EnMano[0] ? 0 : 1);
		MirarHacia(Centro);
		bHecho = Interactuar();
		break;
	case 5:
		SeleccionarMano(EnMano[0] == Objeto ? 0 : 1);
		MirarHacia(Objeto->PosicionOrigen);
		bHecho = Dejar();
		break;
	default:
		break;
	}
	UE_LOG(LogExperimentaPersonaje, Display, TEXT("BOT t=%.1f orden %d tipo %d sobre «%s» -> %s; rayo en %s; manos «%s» / «%s»"), TiempoPaseo, OrdenBot,
		Orden.Tipo, *Orden.Objeto, bHecho ? TEXT("hecho") : TEXT("NO HECHO"), *UltimoImpacto, *NombreEnMano(0), *NombreEnMano(1));
	++OrdenBot;
}

void AExperimentaPersonaje::PaseoAutomatico(float DeltaSeconds)
{
	TiempoPaseo += DeltaSeconds;
	const float T = TiempoPaseo;
	if (FaseBot == 0)
	{
		// Caminar hacia la mesa de la práctica hasta chocar con ella.
		if (T > 1.0f)
		{
			Mover(FVector2D(0.0f, 1.0f));
			TiempoQuieto = (T > 1.8f && GetVelocity().Size2D() < 5.0f) ? TiempoQuieto + DeltaSeconds : 0.0f;
			if (TiempoQuieto > 0.4f || T > 9.0f)
			{
				const FVector P = GetActorLocation();
				UE_LOG(LogExperimentaPersonaje, Display, TEXT("BOT t=%.1f llega a la mesa en (%.0f, %.0f, %.0f) tras caminar"), T, P.X, P.Y, P.Z);
				FaseBot = 1;
			}
		}
	}
	else if (FaseBot == 1)
	{
		PasoDelBot(DeltaSeconds);
		if (Practica->Completada() || T > 60.0f)
		{
			UE_LOG(LogExperimentaPersonaje, Display, TEXT("BOT t=%.1f practica %s"), T, Practica->Completada() ? TEXT("COMPLETADA") : TEXT("SIN COMPLETAR"));
			FaseBot = 2;
			// Segunda prueba, en la mesa 2: medir vinagre, pesar bicarbonato y añadir más vinagre con la pipeta.
			// Tipos: 0 ir delante de, 1 recoger, 2 destapar, 3 mantener hasta, 4 usar sobre, 5 dejar en su sitio.
			OrdenesBot = {
				{ 0, TEXT("Vaso_Mesa2"), 0.0f },
				{ 2, TEXT("Frasco_Vinagre"), 0.0f }, { 1, TEXT("Frasco_Vinagre"), 0.0f }, { 3, TEXT("Probeta_Mesa2"), 20.0f },
				{ 5, TEXT("Frasco_Vinagre"), 0.0f }, { 1, TEXT("Probeta_Mesa2"), 0.0f }, { 4, TEXT("Vaso_Mesa2"), 0.0f },
				{ 5, TEXT("Probeta_Mesa2"), 0.0f },
				{ 1, TEXT("Tarro_Bicarbonato"), 0.0f }, { 3, TEXT("Navecilla"), 2.0f }, { 5, TEXT("Tarro_Bicarbonato"), 0.0f },
				{ 1, TEXT("Navecilla"), 0.0f }, { 4, TEXT("Vaso_Mesa2"), 0.0f }, { 5, TEXT("Navecilla"), 0.0f },
				{ 1, TEXT("Pipeta_Mesa2"), 0.0f }, { 3, TEXT("Frasco_Vinagre"), 5.0f }, { 4, TEXT("Vaso_Mesa2"), 0.0f },
				{ 5, TEXT("Pipeta_Mesa2"), 0.0f },
			};
			OrdenBot = 0;
		}
	}
	else if (OrdenBot < OrdenesBot.Num() && T < 60.0f && !(OrdenBot == 0 && (EnMano[0] || EnMano[1])))
	{
		OrdenesDelBot(DeltaSeconds);
	}
	else if (!ManoOcupada(0) && !ManoOcupada(1) && (EnMano[0] || EnMano[1]) && T < 61.0f)
	{
		// Antes de cambiar de sitio, devuelve a su sitio lo que tenga en las manos.
		EsperaBot -= DeltaSeconds;
		if (EsperaBot <= 0.0f)
		{
			EsperaBot = 0.6f;
			const int32 Mano = EnMano[0] ? 0 : 1;
			SeleccionarMano(Mano);
			MirarHacia(EnMano[Mano]->PosicionOrigen);
			Dejar();
		}
	}
	else if (!ManoOcupada(0) && !ManoOcupada(1))
	{
		// Recorrido para las capturas: gabinete de vasos, vista general, vitrina y campana.
		const int32 Escena = T < 62.0f ? -1 : (T < 90.0f ? 0 : (T < 125.0f ? 1 : (T < 160.0f ? 2 : 3)));
		if (Escena != EscenaBot)
		{
			EscenaBot = Escena;
			const TCHAR* Buscado = Escena == 0 ? TEXT("vasos") : (Escena == 2 ? TEXT("Vitrina") : (Escena == 3 ? TEXT("campana") : nullptr));
			if (Escena == 1)
			{
				SetActorLocation(FVector(400.0f, 0.0f, GetActorLocation().Z), false, nullptr, ETeleportType::TeleportPhysics);
				MirarHacia(FVector(-400.0f, 0.0f, 120.0f));
				UE_LOG(LogExperimentaPersonaje, Display, TEXT("BOT t=%.1f vista general"), T);
			}
			else if (Buscado)
			{
				for (TActorIterator<APuertaActor> It(GetWorld()); It; ++It)
				{
					if (It->NombreVisible.Contains(Buscado))
					{
						IrFrenteA(*It, Escena == 3 ? 150.0f : (Escena == 2 ? 100.0f : 120.0f), 0.0f);
						ActualizarPunteria();
						const bool bAbierta = Interactuar();
						UE_LOG(LogExperimentaPersonaje, Display, TEXT("BOT t=%.1f frente a «%s»: %s; rayo en %s"), T, *It->NombreVisible,
							bAbierta ? TEXT("abre") : TEXT("NO ABRE"), *UltimoImpacto);
						break;
					}
				}
			}
		}
	}
}

AExperimentaGameMode::AExperimentaGameMode()
{
	DefaultPawnClass = AExperimentaPersonaje::StaticClass();
	HUDClass = AExperimentaHUD::StaticClass();
}
