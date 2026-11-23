// Objeto de laboratorio que el jugador puede recoger y dejar (matraz, probeta, frasco, tapa…).
// Es una malla estática móvil con un nombre para la interfaz y la altura a la que se sujeta.
// Los líquidos y las tapas van como actores unidos (attach) y se mueven con él.
//
// Según su papel puede contener líquido:
//  - Frasco: un reactivo del modelo químico; hay que destaparlo para verter.
//  - Probeta: lo que se ha medido de un solo reactivo, para pasarlo al matraz.
//  - Matraz: una mezcla gobernada por el modelo químico (UMezclaComponent).
#pragma once

#include "CoreMinimal.h"
#include "Engine/StaticMeshActor.h"
#include "RecipienteActor.generated.h"

class ULiquidoComponent;
class UTextRenderComponent;
class UMezclaComponent;

UENUM(BlueprintType)
enum class ERolRecipiente : uint8
{
	Ninguno,
	Frasco,
	Probeta,
	/** Matraz o vaso de precipitados: admite mezclas. */
	Matraz,
	/** Frasco cuentagotas (indicadores): se añade gota a gota. */
	Gotero,
	/** Tarro de sólido: se echa en la navecilla para pesarlo. */
	Tarro,
	/** Pipeta: aspira de un frasco hasta su capacidad y lo descarga en un matraz o vaso. */
	Pipeta,
	/** Navecilla de pesar: su «volumen» son gramos de sólido. */
	Navecilla,
};

UCLASS()
class EXPERIMENTA3D_API ARecipienteActor : public AStaticMeshActor
{
	GENERATED_BODY()

public:
	ARecipienteActor();

	/** Nombre que se muestra junto al punto de mira («Probeta de 100 mL»). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Recipiente")
	FString NombreVisible;

	/** Altura sobre la base, en cm, del punto por el que se sujeta. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Recipiente", meta = (ClampMin = "0"))
	float AlturaAgarreCm = 8.0f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Recipiente|Contenido")
	ERolRecipiente Rol = ERolRecipiente::Ninguno;

	/** Identificador del reactivo en el modelo («agno3», «nacl»…). En la probeta, lo último que se midió. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Recipiente|Contenido")
	FString ReactivoId;

	/** Líquido que contiene (frasco y probeta). El del matraz lo lleva su mezcla. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Recipiente|Contenido", meta = (ClampMin = "0"))
	float VolumenML = 0.0f;

	/** Volumen máximo utilizable (probeta: su última marca). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Recipiente|Contenido", meta = (ClampMin = "0"))
	float CapacidadML = 0.0f;

	/** Reactivo de exposición: tiene nombre y etiqueta, pero el modelo químico no lo conoce. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Recipiente|Contenido")
	bool bSinModelo = false;

	/** Forma parte del material preparado para la práctica guiada (la guía lo prefiere). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Recipiente")
	bool bDePractica = false;

	/** Texto de la etiqueta pegada al frente (+X) del recipiente; vacío = sin etiqueta. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Recipiente|Etiqueta")
	FString EtiquetaTexto;

	/** Distancia del eje a la etiqueta, altura de su centro y tamaño, en cm. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Recipiente|Etiqueta")
	float EtiquetaRadioCm = 4.4f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Recipiente|Etiqueta")
	float EtiquetaAlturaCm = 6.5f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Recipiente|Etiqueta")
	FVector2D EtiquetaTamanoCm = FVector2D(6.4, 3.6);

	/** Altura de la letra de la etiqueta, en cm. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Recipiente|Etiqueta")
	float EtiquetaLetraCm = 0.8f;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Recipiente|Etiqueta")
	TObjectPtr<UStaticMeshComponent> Placa;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Recipiente|Etiqueta")
	TObjectPtr<UTextRenderComponent> Rotulo;

	/** Dónde estaba al empezar: sirve para devolverlo a su sitio. */
	FVector PosicionOrigen = FVector::ZeroVector;
	FRotator RotacionOrigen = FRotator::ZeroRotator;

	virtual void OnConstruction(const FTransform& Transform) override;
	virtual void BeginPlay() override;

	/** Activa o desactiva la colisión del objeto y de todo lo unido a él (líquido, tapa). */
	void FijarColisionConjunta(bool bActiva);

	/** Si este objeto está unido a otro recipiente (una tapa puesta), devuelve ese; si no, él mismo. */
	ARecipienteActor* RecipienteRaiz();

	/** Cambia el volumen (frasco o probeta) y actualiza el líquido que se ve. */
	void FijarVolumen(float NuevoML);

	bool EstaTapado() const { return bTapado; }
	bool TieneTapa() const { return Tapa != nullptr; }

	/**
	 * Quita la tapa y la deja al lado (en la dirección dada), o la vuelve a poner.
	 * Devuelve false si no tiene tapa.
	 */
	bool AlternarTapa(const FVector& HaciaElLado);

	/** Mezcla del matraz, o nullptr. */
	UMezclaComponent* Mezcla() const { return MezclaComp; }

	/** «20,0 mL de Nitrato de plata», «vacía»… para la interfaz. Vacío si no contiene líquido. */
	FString DescripcionContenido() const;

private:
	void ActualizarEtiqueta();

	UPROPERTY()
	TObjectPtr<ULiquidoComponent> LiquidoComp;

	UPROPERTY()
	TObjectPtr<UMezclaComponent> MezclaComp;

	UPROPERTY()
	TObjectPtr<ARecipienteActor> Tapa;

	bool bTapado = false;
	FVector TapaRelativa = FVector::ZeroVector;
};
