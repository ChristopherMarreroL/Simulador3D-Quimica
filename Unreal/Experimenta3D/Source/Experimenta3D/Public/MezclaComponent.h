// Puente entre el motor químico (ExperimentaChem) y lo que se ve en el recipiente.
//
// El componente guarda una mezcla del modelo químico. Cada adición pasa por
// ExperimentaChem::AddReagent, que decide volumen, sólidos, pH y temperatura; después se
// actualiza el líquido (ULiquidoComponent) con el volumen y el aspecto que dicta el modelo.
// Aquí no hay química propia: si el modelo rechaza una adición, no cambia nada.
#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "LiquidoComponent.h"
#include "Templates/PimplPtr.h"
#include "MezclaComponent.generated.h"

namespace ExperimentaChem { struct FMixture; }

class UMaterialInterface;

/** Una adición del guion de demostración. */
USTRUCT(BlueprintType)
struct FPasoDemoMezcla
{
	GENERATED_BODY()

	/** Segundos desde el inicio del ciclo. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Mezcla|Demo")
	float Segundo = 0.0f;

	/** Identificador del reactivo en el modelo («hcl», «universal»…). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Mezcla|Demo")
	FString Reactivo;

	/** En la unidad del reactivo: mL, g o gotas. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Mezcla|Demo")
	float Cantidad = 0.0f;
};

UCLASS(ClassGroup = (Experimenta), meta = (BlueprintSpawnableComponent))
class EXPERIMENTA3D_API UMezclaComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	UMezclaComponent();

	/** Líquido que representa esta mezcla. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Mezcla")
	TObjectPtr<ULiquidoComponent> Liquido;

	/** Aspecto cuando el modelo no da ningún sólido. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Mezcla")
	TObjectPtr<UMaterialInterface> MaterialIncoloro;

	/** Aspecto cuando hay precipitado. Su parámetro vectorial «Color» recibe el color de la especie sólida. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Mezcla")
	TObjectPtr<UMaterialInterface> MaterialPrecipitado;

	/**
	 * Aspecto del líquido con color o con precipitado en suspensión. Recibe los parámetros
	 * «ColorDisolucion» y «Color» (vectores: disolución y sólido) e «Intensidad», «Turbidez» y
	 * «Heterogeneidad» (escalares, 0–1). Si falta, se usa MaterialPrecipitado (opaco, sin nube).
	 */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Mezcla")
	TObjectPtr<UMaterialInterface> MaterialSuspension;

	/** Capa de sólido depositado en el fondo (otro cuerpo con el mismo perfil interior). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Mezcla")
	TObjectPtr<ULiquidoComponent> Sedimento;

	// --- Parámetros SOLO VISUALES (no son del modelo químico ni están medidos) ---

	/** Segundos que tarda la nube recién formada en repartirse por todo el líquido. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Mezcla|Aspecto", meta = (ClampMin = "0.1"))
	float SegundosMezcla = 4.0f;

	/** Constante de tiempo (s) con la que el sólido en suspensión se deposita. Tiempo comprimido. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Mezcla|Aspecto", meta = (ClampMin = "0.1"))
	float SegundosSedimentacion = 10.0f;

	/** Gramos de sólido por mL de capa depositada (precipitado suelto, no el cristal compacto). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Mezcla|Aspecto", meta = (ClampMin = "0.001"))
	float DensidadAparenteSedimento = 0.1f;

	/** Opacidad = 1 - exp(-k * g/mL en suspensión); este es k, en mL/g. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Mezcla|Aspecto", meta = (ClampMin = "0"))
	float OpacidadPorConcentracion = 250.0f;

	/** Solo para demostraciones: adiciones que se repiten en bucle. Vacío = sin demostración. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Mezcla|Demo")
	TArray<FPasoDemoMezcla> DemoPasos;

	/** Duración del ciclo de la demostración; al terminar se vacía y se repite. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Mezcla|Demo", meta = (ClampMin = "1"))
	float DemoCicloSegundos = 46.0f;

	/**
	 * Añade un reactivo por su identificador del modelo («agno3», «nacl»…) en su unidad (mL, g o gotas).
	 * Devuelve false, con el mensaje del modelo, si el reactivo no existe, la cantidad está fuera de
	 * rango o el recipiente se desbordaría; en ese caso la mezcla no cambia.
	 */
	UFUNCTION(BlueprintCallable, Category = "Mezcla")
	bool AnadirReactivo(const FString& IdReactivo, float Cantidad, FString& Mensaje);

	UFUNCTION(BlueprintCallable, Category = "Mezcla")
	void Vaciar();

	/**
	 * Sustituye la mezcla por otra calculada fuera (la de la capa de estado de la campana, FHood::Mixture), para
	 * que la escena muestre esa y no una copia propia. Lo nuevo que precipite entra como nube, igual que al añadir.
	 */
	void FijarMezcla(const ExperimentaChem::FMixture& Mezcla);

	UFUNCTION(BlueprintPure, Category = "Mezcla")
	float VolumenML() const;

	/** False si no hay líquido (el modelo no da pH). */
	UFUNCTION(BlueprintPure, Category = "Mezcla")
	bool TienePH() const;

	UFUNCTION(BlueprintPure, Category = "Mezcla")
	float PH() const;

	UFUNCTION(BlueprintPure, Category = "Mezcla")
	float TemperaturaC() const;

	/** Gramos de todos los sólidos presentes. */
	UFUNCTION(BlueprintPure, Category = "Mezcla")
	float SolidosGramos() const;

	/** Identificador de la especie sólida más abundante («AgCl»), o vacío. */
	UFUNCTION(BlueprintPure, Category = "Mezcla")
	FString SolidoPrincipal() const;

	/** Color de la disolución según el modelo (iones coloreados, yodo-almidón e indicadores). */
	UFUNCTION(BlueprintPure, Category = "Mezcla")
	FLinearColor ColorDisolucion() const;

	/** El mismo color tal como lo da el modelo, «#rrggbb». */
	UFUNCTION(BlueprintPure, Category = "Mezcla")
	FString ColorModeloHex() const;

	/**
	 * Cuánto color tiene la disolución, de 0 (incolora) a 1. Es la opacidad del modelo sin su
	 * suelo de 0,2: (opacidad - 0,2) / 0,72. Sin especies coloreadas ni indicador activo vale 0.
	 */
	UFUNCTION(BlueprintPure, Category = "Mezcla")
	float IntensidadColor() const;

	/** Gramos de sólido todavía en suspensión (estado visual; suspensión + sedimento = SolidosGramos). */
	UFUNCTION(BlueprintPure, Category = "Mezcla|Aspecto")
	float SuspendidoGramos() const;

	/** Gramos de sólido ya depositados (estado visual). */
	UFUNCTION(BlueprintPure, Category = "Mezcla|Aspecto")
	float SedimentoGramos() const;

	/** Opacidad de la suspensión, de 0 a 1. */
	UFUNCTION(BlueprintPure, Category = "Mezcla|Aspecto")
	float Turbidez() const;

	/** Avanza la mezcla de la nube y la sedimentación. Lo llama Tick; público para las pruebas. */
	UFUNCTION(BlueprintCallable, Category = "Mezcla|Aspecto")
	void AvanzarAspecto(float Segundos);

	/** Identificadores de las reglas que dispararon en la última adición («ksp-AgCl»…). */
	UFUNCTION(BlueprintPure, Category = "Mezcla")
	TArray<FString> ReglasUltimaAdicion() const;

	/** Nombre en español de un reactivo del modelo («Nitrato de plata»), o el propio identificador si no existe. */
	UFUNCTION(BlueprintPure, Category = "Mezcla")
	static FString NombreReactivo(const FString& IdReactivo);

	/** Número con coma decimal, con el formato del modelo (FormatEs). */
	UFUNCTION(BlueprintPure, Category = "Mezcla")
	static FString FormatoEs(float Valor, int32 Decimales);

	virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

private:
	struct FEstado;
	TPimplPtr<FEstado> Estado;

	void Actualizar();
	void AplicarAspecto();

	UPROPERTY(Transient)
	TObjectPtr<class UMaterialInstanceDynamic> InstanciaSuspension;

	UPROPERTY(Transient)
	TObjectPtr<class UMaterialInstanceDynamic> InstanciaSedimento;

	float SuspendidoG = 0.0f;
	float SolidoPrevioG = 0.0f;
	float Heterogeneidad = 0.0f;
	float SedimentoMLAplicado = -1.0f;

	float DemoTiempo = 0.0f;
	int32 DemoPaso = 0;
};

/** Recipiente con líquido gobernado por el modelo químico. */
UCLASS()
class EXPERIMENTA3D_API AMezclaActor : public ALiquidoActor
{
	GENERATED_BODY()

public:
	AMezclaActor();

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Mezcla")
	TObjectPtr<UMezclaComponent> Mezcla;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Mezcla")
	TObjectPtr<ULiquidoComponent> Sedimento;
};
