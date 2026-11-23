// Personaje en primera persona: camina con WASD, mira con el ratón y lleva dos manos enguantadas
// delante de la cámara. Decisiones heredadas de la versión web: la cámara NO oscila al caminar
// (el movimiento natural lo ponen las manos), no se salta y Mayús acelera el paso.
//
// Las manos son mallas estáticas (sin dedos articulados). Sus gestos son procedurales: el brazo
// se estira hasta el objeto para recogerlo o dejarlo, y se acerca e inclina el recipiente al
// verter. La acción ocurre cuando la mano llega, no al pulsar la tecla.
#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "GameFramework/GameModeBase.h"
#include "ExperimentaPersonaje.generated.h"

class APuertaActor;
class ARecipienteActor;
class UCameraComponent;
class UInputAction;
class UInputMappingContext;
class UPracticaGuiadaComponent;
class UStaticMeshComponent;
struct FInputActionValue;

UCLASS()
class EXPERIMENTA3D_API AExperimentaPersonaje : public ACharacter
{
	GENERATED_BODY()

public:
	AExperimentaPersonaje();

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Personaje")
	TObjectPtr<UCameraComponent> Camara;

	/** Punto del que cuelgan las dos manos; se mueve un poco al caminar, al girar y al respirar. */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Personaje")
	TObjectPtr<USceneComponent> ManosRaiz;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Personaje")
	TObjectPtr<UStaticMeshComponent> ManoDerecha;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Personaje")
	TObjectPtr<UStaticMeshComponent> ManoIzquierda;

	/** Práctica guiada en curso (por ahora, siempre «Prueba de cloruros»). */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Personaje")
	TObjectPtr<UPracticaGuiadaComponent> Practica;

	/** cm/s. Paso tranquilo de laboratorio. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Personaje")
	float VelocidadCaminar = 150.0f;

	/** cm/s con Mayús. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Personaje")
	float VelocidadRapida = 280.0f;

	/** Multiplicador de la sensibilidad del ratón (1 = 0,175 grados por unidad de ratón). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Personaje")
	float SensibilidadRaton = 1.0f;

	/** Distancia máxima, en cm desde los ojos, a la que se puede usar algo. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Personaje|Manos")
	float AlcanceCm = 190.0f;

	/** mL por segundo al verter de un frasco a la probeta manteniendo E o el clic. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Personaje|Manos")
	float CaudalMLPorSegundo = 15.0f;

	/** Gramos por segundo al echar un sólido del tarro a la navecilla. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Personaje|Manos")
	float CaudalGramosPorSegundo = 1.0f;

	/** mL por segundo al aspirar con la pipeta. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Personaje|Manos")
	float CaudalPipetaMLPorSegundo = 2.0f;

	/** Chorro que se ve entre el recipiente volcado y el destino mientras pasa líquido. */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Personaje|Manos")
	TObjectPtr<UStaticMeshComponent> Chorro;

	/** Segundos que tarda el brazo en estirarse del todo (y en volver). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Personaje|Manos", meta = (ClampMin = "0.05"))
	float SegundosEstirar = 0.32f;

	/** Segundos que tarda la muñeca en inclinar el recipiente para verter. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Personaje|Manos", meta = (ClampMin = "0.05"))
	float SegundosInclinar = 0.45f;

	/** Eje.X = derecha (+) o izquierda (-); Eje.Y = adelante (+) o atrás (-). Valores de -1 a 1. */
	UFUNCTION(BlueprintCallable, Category = "Personaje")
	void Mover(FVector2D Eje);

	/** Eje en unidades de ratón: X gira a la derecha (+); Y positivo mira hacia arriba. */
	UFUNCTION(BlueprintCallable, Category = "Personaje")
	void Mirar(FVector2D Eje);

	UFUNCTION(BlueprintCallable, Category = "Personaje")
	void FijarPasoRapido(bool bRapido);

	/**
	 * Acción principal (E o clic). Según lo apuntado y lo que lleve la mano seleccionada: abre o cierra
	 * una puerta, vierte la probeta o el cuentagotas en un matraz o vaso, o recoge el objeto.
	 * Devuelve true si ha empezado el gesto; la acción se completa cuando la mano llega.
	 */
	UFUNCTION(BlueprintCallable, Category = "Personaje|Manos")
	bool Interactuar();

	/**
	 * Mientras se mantiene E o el clic, con el objeto de la mano seleccionada sobre lo apuntado:
	 * frasco -> probeta (verter), tarro -> navecilla (echar sólido) o pipeta -> frasco (aspirar).
	 */
	UFUNCTION(BlueprintCallable, Category = "Personaje|Manos")
	bool Verter(float Segundos);

	/** Quita o pone la tapa del frasco apuntado (F). */
	UFUNCTION(BlueprintCallable, Category = "Personaje|Manos")
	bool AlternarTapa();

	/** Deja el objeto de la mano seleccionada sobre la superficie apuntada (Q). */
	UFUNCTION(BlueprintCallable, Category = "Personaje|Manos")
	bool Dejar();

	/** 0 = mano derecha (tecla 1), 1 = mano izquierda (tecla 2). */
	UFUNCTION(BlueprintCallable, Category = "Personaje|Manos")
	void SeleccionarMano(int32 Mano);

	UFUNCTION(BlueprintPure, Category = "Personaje|Manos")
	int32 ManoSeleccionada() const { return ManoActiva; }

	/** True mientras esa mano hace un gesto (estirarse, verter, volver). */
	UFUNCTION(BlueprintPure, Category = "Personaje|Manos")
	bool ManoOcupada(int32 Mano) const;

	/** Nombre del objeto que lleva esa mano, o vacío. */
	UFUNCTION(BlueprintPure, Category = "Personaje|Manos")
	FString NombreEnMano(int32 Mano) const;

	/** Texto para mostrar junto al punto de mira según lo que se apunta, o vacío. */
	UFUNCTION(BlueprintPure, Category = "Personaje|Manos")
	FString AvisoContextual() const;

	/** Mensaje temporal (por ejemplo, «Las dos manos están ocupadas»), o vacío. */
	UFUNCTION(BlueprintPure, Category = "Personaje|Manos")
	FString MensajeActual() const;

	/**
	 * Objeto que pide el paso actual de la práctica y la etiqueta que lo acompaña («F · Destapa»,
	 * «Llena hasta 20 mL»…), con la misma prioridad que la web. Devuelve nullptr si no hay ninguno.
	 */
	UFUNCTION(BlueprintPure, Category = "Personaje")
	AActor* ObjetivoGuia(FString& Etiqueta) const;

	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;
	virtual void SetupPlayerInputComponent(UInputComponent* PlayerInputComponent) override;
	virtual void PawnClientRestart() override;

private:
	// --- Entrada ---
	UPROPERTY()
	TObjectPtr<UInputAction> AccionMover;
	UPROPERTY()
	TObjectPtr<UInputAction> AccionMirar;
	UPROPERTY()
	TObjectPtr<UInputAction> AccionRapido;
	UPROPERTY()
	TObjectPtr<UInputAction> AccionInteractuar;
	UPROPERTY()
	TObjectPtr<UInputAction> AccionDejar;
	UPROPERTY()
	TObjectPtr<UInputAction> AccionMano1;
	UPROPERTY()
	TObjectPtr<UInputAction> AccionMano2;
	UPROPERTY()
	TObjectPtr<UInputAction> AccionTapa;
	UPROPERTY()
	TObjectPtr<UInputMappingContext> Contexto;

	void CrearEntrada();
	void AlMover(const FInputActionValue& Valor);
	void AlMirar(const FInputActionValue& Valor);
	void AlEmpezarRapido(const FInputActionValue& Valor);
	void AlTerminarRapido(const FInputActionValue& Valor);
	void AlInteractuar(const FInputActionValue& Valor);
	void AlMantener(const FInputActionValue& Valor);
	void AlDejar(const FInputActionValue& Valor);
	void AlMano1(const FInputActionValue& Valor);
	void AlMano2(const FInputActionValue& Valor);
	void AlTapa(const FInputActionValue& Valor);

	// --- Puntería y objetos ---
	/** Lo que lleva cada mano: [0] derecha, [1] izquierda. */
	UPROPERTY()
	TObjectPtr<ARecipienteActor> EnMano[2];

	/** Recipiente bajo el punto de mira y al alcance, si lo hay. */
	UPROPERTY()
	TObjectPtr<ARecipienteActor> Apuntado;

	UPROPERTY()
	TObjectPtr<APuertaActor> PuertaApuntada;

	bool bSuperficieApuntada = false;
	FVector PuntoApuntado = FVector::ZeroVector;
	FString UltimoImpacto;
	int32 ManoActiva = 0;
	FString Mensaje;
	float MensajeRestante = 0.0f;

	void ActualizarPunteria();
	void LlevarObjetos();
	void Avisar(const FString& Texto);
	void MirarHacia(const FVector& Punto);
	bool VerterProbetaEnMatraz(ARecipienteActor* Probeta, ARecipienteActor* Matraz);
	bool AnadirGota(ARecipienteActor* Gotero, ARecipienteActor* Matraz);
	bool AnadirSolido(ARecipienteActor* Navecilla, ARecipienteActor* Matraz);
	void MostrarChorro(const FVector& Desde, const FVector& Hasta, float Segundos);
	float ChorroRestante = 0.0f;
	UStaticMeshComponent* ComponenteMano(int32 Mano) const;
	static FVector TopeDe(const AActor* Actor);

	// --- Gestos de las manos ---
	struct FGesto
	{
		FVector Punto = FVector::ZeroVector;   // adónde va la mano, en el mundo
		float Extension = 0.0f;                // 0 = en reposo, 1 = en el punto
		float Inclinacion = 0.0f;              // 0 = recipiente de pie, 1 = volcado para verter
		float ExtensionDeseada = 0.0f;
		float InclinacionDeseada = 0.0f;
		bool bPendiente = false;               // falta ejecutar la acción al llegar
		float Espera = 0.0f;                   // tiempo que se queda en el punto tras la acción
		float Continuo = 0.0f;                 // > 0 mientras se mantiene la tecla de verter
		bool bContinuoInclina = true;          // la pipeta se acerca pero no se vuelca
		TFunction<void()> AlLlegar;
	};
	FGesto Gestos[2];
	FVector ManoBase[2];
	FRotator ManoRotacionBase[2];

	bool IniciarGesto(int32 Mano, const FVector& Punto, bool bInclinar, float Espera, TFunction<void()> AlLlegar);
	void ActualizarGestos(float DeltaSeconds);
	void AnimarManos(float DeltaSeconds);

	FVector ManosBase = FVector::ZeroVector;
	float TiempoManos = 0.0f;
	float FasePaso = 0.0f;
	float GuinadaPrevia = 0.0f;
	float InerciaGiro = 0.0f;

	// --- Jugador automático de prueba (-ExperimentaPaseo): no es parte del juego ---
	void PaseoAutomatico(float DeltaSeconds);
	void PasoDelBot(float DeltaSeconds);
	void IrFrenteA(const AActor* Actor, float Distancia, float AlturaMirada);
	bool bPaseo = false;
	float TiempoPaseo = 0.0f;
	float TiempoQuieto = 0.0f;
	float EsperaBot = 0.0f;
	struct FOrdenBot { int32 Tipo; FString Objeto; float Hasta; };
	TArray<FOrdenBot> OrdenesBot;
	int32 OrdenBot = 0;
	ARecipienteActor* BuscarRecipiente(const FString& Nombre) const;
	void OrdenesDelBot(float DeltaSeconds);
	int32 FaseBot = 0;
	int32 EscenaBot = -1;
	FString UltimaEtiquetaBot;
};

/** Modo de juego del simulador: usa AExperimentaPersonaje como jugador. */
UCLASS()
class EXPERIMENTA3D_API AExperimentaGameMode : public AGameModeBase
{
	GENERATED_BODY()

public:
	AExperimentaGameMode();
};
