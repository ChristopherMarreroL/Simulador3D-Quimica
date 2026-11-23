// Práctica guiada: lleva la cuenta de lo que el jugador ha añadido al matraz y deriva de ello la
// lista de pasos, igual que recipeSteps() de la versión web (src/state/hood.ts):
//  - un paso de adición está hecho cuando lo añadido llega al 90 % de la cantidad (inclusive);
//  - «Observa el resultado» queda hecho cuando han disparado todas las reglas esperadas;
//  - el paso actual es el primero sin hacer; el orden no se impone.
//
// Por ahora solo existe «Prueba de cloruros» (id «cloruro-plata» en src/experiments/hoodRecipes.ts).
// De los pasos de la web faltan los que dependen de cosas que Unreal aún no tiene: protección,
// reunir reactivos de la estantería, cuaderno y residuos.
#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "PracticaGuiada.generated.h"

USTRUCT(BlueprintType)
struct FPasoPractica
{
	GENERATED_BODY()

	/** «add-0», «add-1», «observe»: las mismas claves que la web. */
	UPROPERTY(BlueprintReadOnly, Category = "Practica")
	FString Clave;

	UPROPERTY(BlueprintReadOnly, Category = "Practica")
	FString Titulo;

	UPROPERTY(BlueprintReadOnly, Category = "Practica")
	FString Detalle;

	UPROPERTY(BlueprintReadOnly, Category = "Practica")
	bool bHecho = false;

	/** Solo en los pasos de adición: reactivo y cantidad pedida (mL). */
	UPROPERTY(BlueprintReadOnly, Category = "Practica")
	FString ReactivoId;

	UPROPERTY(BlueprintReadOnly, Category = "Practica")
	float Cantidad = 0.0f;
};

UCLASS(ClassGroup = (Experimenta), meta = (BlueprintSpawnableComponent))
class EXPERIMENTA3D_API UPracticaGuiadaComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	UPracticaGuiadaComponent();

	UFUNCTION(BlueprintPure, Category = "Practica")
	FString Titulo() const { return TEXT("Prueba de cloruros"); }

	UFUNCTION(BlueprintPure, Category = "Practica")
	FString Ecuacion() const { return TEXT("AgNO₃ + NaCl → AgCl ↓ + NaNO₃"); }

	UFUNCTION(BlueprintPure, Category = "Practica")
	FString Objetivo() const { return TEXT("Detectar iones cloruro con nitrato de plata."); }

	UFUNCTION(BlueprintPure, Category = "Practica")
	FString Seguridad() const { return TEXT("El nitrato de plata mancha la piel."); }

	/** Anota una adición que ha llegado al matraz y las reglas que disparó en el modelo químico. */
	UFUNCTION(BlueprintCallable, Category = "Practica")
	void RegistrarAdicion(const FString& ReactivoId, float Cantidad, const TArray<FString>& Reglas);

	/** Vuelve a empezar la práctica. */
	UFUNCTION(BlueprintCallable, Category = "Practica")
	void Reiniciar();

	/** Pasos derivados del estado actual. */
	UFUNCTION(BlueprintPure, Category = "Practica")
	TArray<FPasoPractica> Pasos() const;

	/** Índice del primer paso sin hacer, o -1 si están todos hechos. */
	UFUNCTION(BlueprintPure, Category = "Practica")
	int32 PasoActual() const;

	UFUNCTION(BlueprintPure, Category = "Practica")
	bool Completada() const { return PasoActual() < 0; }

	/** Mililitros de ese reactivo añadidos al matraz en esta práctica. */
	UFUNCTION(BlueprintPure, Category = "Practica")
	float Anadido(const FString& ReactivoId) const;

private:
	TMap<FString, float> Anadidos;
	TSet<FString> ReglasVistas;
	int32 PasoAnunciado = 0;
};
