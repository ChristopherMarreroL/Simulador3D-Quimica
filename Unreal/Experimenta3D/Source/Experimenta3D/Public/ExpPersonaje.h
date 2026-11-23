// Jugador en primera persona del juego de la campana.
// Entrada (Enhanced Input creada en código): WASD + ratón, Mayús correr, E o clic izquierdo usar (mantener para
// verter), Q dejar, 1/2 mano izquierda/derecha, N anotar, clic derecho mirar de cerca, Esc menú de pausa.
// Las funciones Do*() son las mismas que llaman las teclas: el recorrido automático (-ExpRecorrido) las usa.
#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"

#include "ExperimentaChem/Hood.h"

#include "ExpPersonaje.generated.h"

class AExpObjeto;
class UCameraComponent;
class UExpHud;
class UExpMenuPausa;
class UInputAction;
class UInputMappingContext;
class UMaterialInstanceDynamic;
class UMaterialInterface;
class UStaticMeshComponent;
struct FInputActionValue;

UCLASS()
class EXPERIMENTA3D_API AExpPersonaje : public ACharacter
{
	GENERATED_BODY()
public:
	AExpPersonaje();

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Experimenta") TObjectPtr<UCameraComponent> Camara;
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Experimenta") TObjectPtr<USceneComponent> Manos;
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Experimenta") TObjectPtr<UStaticMeshComponent> Chorro;

	/** Alcance de la mano, en cm desde los ojos (valor de diseño de la web: 270 cm de puntería). */
	UPROPERTY(EditAnywhere, Category = "Experimenta") float AlcanceCm = 230.0f;
	UPROPERTY(EditAnywhere, Category = "Experimenta") float VelocidadPaso = 220.0f;
	UPROPERTY(EditAnywhere, Category = "Experimenta") float VelocidadRapida = 350.0f;
	UPROPERTY(EditAnywhere, Category = "Experimenta") float Sensibilidad = 1.0f;

	/** Punto de agarre de cada mano (EHand::Left = 0, EHand::Right = 1): ahí se acopla el frasco. */
	USceneComponent* Agarre(ExperimentaChem::EHand Mano) const;
	AExpObjeto* Apuntado() const { return ObjetivoActual.Get(); }
	/** Texto del aviso junto al punto de mira (nombre y acciones posibles). */
	FString Aviso() const { return TextoAviso; }

	// Acciones (las llaman las teclas y el recorrido automático).
	void DoMover(FVector2D Eje);
	void DoMirar(FVector2D Eje);
	void DoUsar(bool bPulsado);
	void DoDejar();
	void DoMano(int32 Mano);
	void DoAnotar();
	void DoPausa();
	void DoCerca(bool bActivo);

	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;
	virtual void SetupPlayerInputComponent(UInputComponent* PlayerInputComponent) override;
	virtual void PawnClientRestart() override;

private:
	UPROPERTY() TObjectPtr<UStaticMeshComponent> Mano[2];
	UPROPERTY() TObjectPtr<UStaticMeshComponent> Manga[2];
	UPROPERTY() TObjectPtr<USceneComponent> Punto[2];
	UPROPERTY() TObjectPtr<UMaterialInterface> MaterialPiel;
	UPROPERTY() TObjectPtr<UMaterialInterface> MaterialGuante;
	UPROPERTY() TObjectPtr<UMaterialInterface> MaterialBata;
	UPROPERTY() TObjectPtr<UExpHud> Hud;
	UPROPERTY() TObjectPtr<UExpMenuPausa> Menu;
	UPROPERTY() TObjectPtr<UInputMappingContext> Contexto;
	UPROPERTY() TObjectPtr<UInputAction> AMover;
	UPROPERTY() TObjectPtr<UInputAction> AMirar;
	UPROPERTY() TObjectPtr<UInputAction> ARapido;
	UPROPERTY() TObjectPtr<UInputAction> AUsar;
	UPROPERTY() TObjectPtr<UInputAction> ADejar;
	UPROPERTY() TObjectPtr<UInputAction> AMano1;
	UPROPERTY() TObjectPtr<UInputAction> AMano2;
	UPROPERTY() TObjectPtr<UInputAction> AAnotar;
	UPROPERTY() TObjectPtr<UInputAction> APausa;
	UPROPERTY() TObjectPtr<UInputAction> ACerca;

	TWeakObjectPtr<AExpObjeto> ObjetivoActual;
	/** Actores del nivel (viven tanto como él) que la puntería atraviesa. */
	TArray<AActor*> Transparentes;
	FString TextoAviso;
	bool bGuantesPuestos = false;
	bool bCerca = false;
	float Inclinacion[2] = { 0.0f, 0.0f };
	float Alcance[2] = { 0.0f, 0.0f };
	float Tiempo = 0.0f;
	FVector BaseMano[2];
	FRotator BaseRotMano[2];

	void CrearEntrada();
	void Apuntar();
	void AnimarManos(float DeltaSeconds);
	void ActualizarChorro();
	FString ConstruirAviso(const AExpObjeto* Objeto) const;

	void AlMover(const FInputActionValue& V);
	void AlMirar(const FInputActionValue& V);
	void AlRapido(const FInputActionValue& V);
	void AlNormal(const FInputActionValue& V);
	void AlUsar(const FInputActionValue& V);
	void AlSoltar(const FInputActionValue& V);
	void AlDejar(const FInputActionValue& V);
	void AlMano1(const FInputActionValue& V);
	void AlMano2(const FInputActionValue& V);
	void AlAnotar(const FInputActionValue& V);
	void AlPausa(const FInputActionValue& V);
	void AlCerca(const FInputActionValue& V);
	void AlLejos(const FInputActionValue& V);

	// Recorrido automático de la práctica (línea de órdenes -ExpRecorrido): coloca al jugador delante de cada
	// objetivo, apunta con la cámara (el trazado real elige el objetivo) y pulsa las mismas acciones.
	bool bRecorrido = false;
	int32 PasoRecorrido = 0;
	float EsperaRecorrido = 0.0f;
	float TiempoRecorrido = 0.0f;
	int32 FotogramasMedidos = 0;
	double SegundosMedidos = 0.0;
	TArray<float> Tiempos;
	void Recorrido(float DeltaSeconds);
	bool MirarA(const FString& TargetId, float Distancia, float AlturaOjos);
	/** Objetivo al que el recorrido mantiene la mirada (se reajusta cada fotograma desde la cámara). */
	FString MiradaFija;
	/** El paso actual ya pidió su captura previa (se hace un fotograma antes de la acción). */
	bool bFotoPrevia = false;
};
