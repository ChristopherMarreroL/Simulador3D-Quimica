// Balanza: muestra en su pantalla los gramos de la navecilla que tiene sobre el platillo.
// No pesa por física: lee el contenido que lleva anotado la navecilla (ARecipienteActor de rol
// Navecilla), que es lo que se ha echado en ella desde un tarro.
#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "BalanzaActor.generated.h"

class UTextRenderComponent;

UCLASS()
class EXPERIMENTA3D_API ABalanzaActor : public AActor
{
	GENERATED_BODY()

public:
	ABalanzaActor();

	/** El origen del actor es el centro del platillo. */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Balanza")
	TObjectPtr<USceneComponent> Platillo;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Balanza")
	TObjectPtr<UTextRenderComponent> Pantalla;

	/** Posición de la pantalla respecto al platillo, en cm. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Balanza")
	FVector PosicionPantalla = FVector(13.0f, 0.0f, -3.0f);

	/** Radio, en cm, dentro del cual una navecilla se considera sobre el platillo. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Balanza")
	float RadioPlatilloCm = 9.0f;

	/** Gramos que marca ahora mismo. */
	UFUNCTION(BlueprintPure, Category = "Balanza")
	float LecturaGramos() const { return Lectura; }

	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;

private:
	float Lectura = 0.0f;
	float Mostrado = -1.0f;
};
