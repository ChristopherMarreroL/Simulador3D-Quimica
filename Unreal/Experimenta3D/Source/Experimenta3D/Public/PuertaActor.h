// Puerta de gabinete o de vitrina (gira sobre una bisagra) o ventana de guillotina de la campana
// (se desliza). Se abre y se cierra con la acción principal del jugador.
#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "PuertaActor.generated.h"

class UStaticMeshComponent;
class UTextRenderComponent;

UCLASS()
class EXPERIMENTA3D_API APuertaActor : public AActor
{
	GENERATED_BODY()

public:
	APuertaActor();

	/** Bisagra: el origen del actor. La hoja cuelga de aquí. */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Puerta")
	TObjectPtr<USceneComponent> Bisagra;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Puerta")
	TObjectPtr<UStaticMeshComponent> Hoja;

	/** Rótulo sobre la hoja con lo que guarda el gabinete. */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Puerta")
	TObjectPtr<UTextRenderComponent> Rotulo;

	/** Nombre para el aviso junto al punto de mira («Gabinete: vasos de precipitados»). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Puerta")
	FString NombreVisible;

	/** Texto del rótulo; vacío = sin rótulo. Admite saltos de línea. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Puerta")
	FString TextoRotulo;

	/** Posición del rótulo respecto a la bisagra, en cm. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Puerta")
	FVector PosicionRotulo = FVector::ZeroVector;

	/** Si es true se desliza `Desplazamiento`; si no, gira `AnguloAbierta` grados sobre el eje vertical. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Puerta")
	bool bDeslizante = false;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Puerta")
	float AnguloAbierta = 105.0f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Puerta")
	FVector Desplazamiento = FVector(0.0f, 0.0f, 40.0f);

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Puerta", meta = (ClampMin = "0.05"))
	float SegundosEnAbrir = 0.45f;

	UFUNCTION(BlueprintCallable, Category = "Puerta")
	void Alternar();

	UFUNCTION(BlueprintPure, Category = "Puerta")
	bool EstaAbierta() const { return bAbierta; }

	virtual void OnConstruction(const FTransform& Transform) override;
	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;

private:
	void ActualizarRotulo();

	bool bAbierta = false;
	float Apertura = 0.0f;
	FRotator RotacionCerrada = FRotator::ZeroRotator;
	FVector PosicionCerrada = FVector::ZeroVector;
};
