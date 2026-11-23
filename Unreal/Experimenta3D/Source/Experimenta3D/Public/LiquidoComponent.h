// Líquido de nivel variable dentro de un recipiente de revolución.
//
// El recipiente se describe con su PERFIL INTERIOR: puntos (radio, altura) en milímetros, con el
// origen en el centro de la base (los exporta art/blender/cristaleria_cloruros.py en
// art/export/perfiles_interiores.json). A partir de un volumen en mL el componente calcula la
// altura del nivel integrando ese perfil y genera la malla del líquido (pared, fondo y menisco).
//
// Solo representa: el volumen lo decide el modelo químico, nunca este componente.
#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "ProceduralMeshComponent.h"
#include "LiquidoComponent.generated.h"

class UMaterialInterface;

/** Geometría pura (sin UObject) para poder probarla. Radios y alturas en mm; volúmenes en mL. */
namespace ExperimentaLiquido
{
	/** Copia del perfil ordenada por altura y, a igual altura, por radio. */
	EXPERIMENTA3D_API TArray<FVector2D> OrdenarPerfil(const TArray<FVector2D>& Perfil);
	/** Radio interior a una altura (interpolación lineal). El perfil debe estar ordenado. */
	EXPERIMENTA3D_API double RadioEn(const TArray<FVector2D>& Perfil, double AlturaMM);
	/** Volumen entre el fondo y una altura, sumando troncos de cono exactos. */
	EXPERIMENTA3D_API double VolumenHastaML(const TArray<FVector2D>& Perfil, double AlturaMM);
	/** Altura a la que el volumen acumulado vale ML (se limita al fondo y al borde). */
	EXPERIMENTA3D_API double AlturaParaML(const TArray<FVector2D>& Perfil, double ML);
}

UCLASS(ClassGroup = (Experimenta), meta = (BlueprintSpawnableComponent))
class EXPERIMENTA3D_API ULiquidoComponent : public UProceduralMeshComponent
{
	GENERATED_BODY()

public:
	ULiquidoComponent(const FObjectInitializer& ObjectInitializer);

	/** Puntos (radio, altura) en mm de la pared interior del recipiente. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Liquido")
	TArray<FVector2D> PerfilInteriorMM;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Liquido", meta = (ClampMin = "0"))
	float VolumenML = 0.0f;

	/** Cuánto sube el líquido junto al vidrio (menisco cóncavo). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Liquido", meta = (ClampMin = "0"))
	float MeniscoMM = 0.8f;

	/** Separación con la pared para que las caras no coincidan. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Liquido", meta = (ClampMin = "0"))
	float HolguraMM = 0.1f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Liquido")
	TObjectPtr<UMaterialInterface> MaterialLiquido;

	/** Solo para demostraciones: si no es 0, el volumen oscila entre DemoMinML y DemoMaxML. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Liquido|Demo")
	float DemoMLPorSegundo = 0.0f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Liquido|Demo")
	float DemoMinML = 0.0f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Liquido|Demo")
	float DemoMaxML = 0.0f;

	/** Cambia el volumen y rehace la malla. Se limita a la capacidad del recipiente. */
	UFUNCTION(BlueprintCallable, Category = "Liquido")
	void FijarVolumenML(float NuevoVolumenML);

	/** Altura del nivel (centro del menisco) sobre la base del recipiente, en mm. */
	UFUNCTION(BlueprintPure, Category = "Liquido")
	float AlturaNivelMM() const;

	/** Volumen interior hasta el borde, en mL. */
	UFUNCTION(BlueprintPure, Category = "Liquido")
	float CapacidadML() const;

	/** Rehace la malla con las propiedades actuales (por ejemplo, tras cambiarlas desde Python). */
	UFUNCTION(BlueprintCallable, Category = "Liquido")
	void Reconstruir();

	virtual void OnRegister() override;
	virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

private:
	float DemoSentido = 1.0f;
};

/** Actor mínimo con un líquido como raíz; se coloca en el mismo origen que su recipiente. */
UCLASS()
class EXPERIMENTA3D_API ALiquidoActor : public AActor
{
	GENERATED_BODY()

public:
	ALiquidoActor();

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Liquido")
	TObjectPtr<ULiquidoComponent> Liquido;
};
