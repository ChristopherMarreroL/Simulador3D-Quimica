// Juego de la campana (corte vertical «Prueba de cloruros», 18 de noviembre de 2026).
//
// UExpSubsistema: dueño de la partida (FExpPartida → FLabSession validada). Es lo único que guarda estado de
//   procedimiento; los actores solo lo leen cada fotograma y se recolocan o redibujan.
// AExpObjeto: todo lo que se puede apuntar. Su TargetId es el mismo identificador de objetivo que usa la web
//   ('reagent:agno3', 'hood', 'hood-cylinder', 'hood-washbottle', 'hood-waste', 'ppe-goggles', 'recipe-board'…).
// AExpGameMode: personaje en primera persona del juego.
#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "GameFramework/GameModeBase.h"
#include "Subsystems/WorldSubsystem.h"

#include "ExpPartida.h"

#include "ExpJuego.generated.h"

class AExpObjeto;
class AExpPersonaje;
class UBoxComponent;
class ULiquidoComponent;
class UMaterialInterface;
class UMezclaComponent;
class UStaticMeshComponent;
class UTextRenderComponent;

UCLASS()
class EXPERIMENTA3D_API UExpSubsistema : public UTickableWorldSubsystem
{
	GENERATED_BODY()
public:
	virtual bool DoesSupportWorldType(const EWorldType::Type Tipo) const override { return Tipo == EWorldType::Game || Tipo == EWorldType::PIE; }
	virtual void Tick(float DeltaTime) override;
	virtual TStatId GetStatId() const override { RETURN_QUICK_DECLARE_CYCLE_STAT(UExpSubsistema, STATGROUP_Tickables); }

	FExpPartida& Partida() { return Juego; }
	const FExpPartida& Partida() const { return Juego; }

	void Registrar(AExpObjeto* Objeto);
	AExpObjeto* Buscar(const FString& TargetId) const;
	/** Primer objeto de un tipo (la bandeja de la campana, el matraz…). */
	AExpObjeto* PrimeroDeTipo(uint8 Tipo) const;
	const TArray<TWeakObjectPtr<AExpObjeto>>& Objetos() const { return Lista; }

	TWeakObjectPtr<AExpPersonaje> Jugador;

	/** Objetivos del primer paso sin hacer (para la marca de guía). */
	const TArray<FString>& ObjetivosGuia() const { return Guia; }
	const TArray<FExpPaso>& PasosCache() const { return Pasos; }

private:
	FExpPartida Juego;
	TArray<TWeakObjectPtr<AExpObjeto>> Lista;
	TArray<FString> Guia;
	TArray<FExpPaso> Pasos;
};

UENUM(BlueprintType)
enum class EExpTipo : uint8
{
	Frasco, Proteccion, Matraz, Probeta, Piseta, Residuos, Tablero, Estanteria, Bandeja,
};

UCLASS()
class EXPERIMENTA3D_API AExpObjeto : public AActor
{
	GENERATED_BODY()
public:
	AExpObjeto();

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Experimenta")
	EExpTipo Tipo = EExpTipo::Frasco;

	/** Identificador de objetivo de la capa de estado (mismo texto que en la web). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Experimenta")
	FString TargetId;

	/** Nombre que se ve junto al punto de mira. En los frascos se toma del modelo si está vacío. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Experimenta")
	FString Nombre;

	/** Id del reactivo en el modelo (solo frascos). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Experimenta")
	FString ReactivoId;

	/** Medio tamaño de la zona de puntería, en cm (centrada en ZonaCentro). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Experimenta")
	FVector ZonaExtension = FVector(6.0, 6.0, 10.0);
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Experimenta")
	FVector ZonaCentro = FVector(0.0, 0.0, 10.0);

	/** Altura de la boca (frasco, probeta, matraz) sobre el origen, para el chorro. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Experimenta")
	float BocaCm = 20.0f;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Experimenta") TObjectPtr<USceneComponent> Raiz;
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Experimenta") TObjectPtr<USceneComponent> Pivote;
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Experimenta") TObjectPtr<UStaticMeshComponent> Cuerpo;
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Experimenta") TObjectPtr<UStaticMeshComponent> Extra;
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Experimenta") TObjectPtr<UStaticMeshComponent> Tapa;
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Experimenta") TObjectPtr<ULiquidoComponent> Liquido;
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Experimenta") TObjectPtr<ULiquidoComponent> Sedimento;
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Experimenta") TObjectPtr<UMezclaComponent> Mezcla;
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Experimenta") TObjectPtr<UTextRenderComponent> Rotulo;
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Experimenta") TObjectPtr<UTextRenderComponent> Marca;
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Experimenta") TObjectPtr<UBoxComponent> Zona;

	/** Contorno dorado del objeto apuntado (material de superposición). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Experimenta")
	TObjectPtr<UMaterialInterface> MaterialContorno;

	virtual void OnConstruction(const FTransform& Transform) override;
	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;

	void FijarApuntado(bool bApuntado);
	int32 IndiceReactivo() const;
	/** Punto del mundo de la boca (para el chorro). */
	FVector Boca() const;
	/** Lugar de un hueco de la bandeja, en el mundo (solo la bandeja). */
	FTransform Hueco(int32 Indice) const;

private:
	FTransform Origen;
	bool bApuntado = false;
	double FirmaMezcla = -1.0;
	float Reloj = 0.0f;
	void Recolocar(UExpSubsistema& S, float DeltaSeconds);
	void Configurar();
};

UCLASS()
class EXPERIMENTA3D_API AExpGameMode : public AGameModeBase
{
	GENERATED_BODY()
public:
	AExpGameMode();
};
