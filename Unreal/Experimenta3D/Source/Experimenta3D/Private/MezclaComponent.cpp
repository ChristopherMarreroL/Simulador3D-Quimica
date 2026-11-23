#include "MezclaComponent.h"

#include "Materials/MaterialInstanceDynamic.h"
#include "Materials/MaterialInterface.h"

#include "ExperimentaChem/Chem.h"

#include <string>

DEFINE_LOG_CATEGORY_STATIC(LogExperimentaMezcla, Log, All);

namespace
{
	FString DesdeUtf8(const std::string& Texto)
	{
		const FUTF8ToTCHAR Convertido(Texto.data(), static_cast<int32>(Texto.size()));
		return FString::ConstructFromPtrSize(Convertido.Get(), Convertido.Length());
	}
}

struct UMezclaComponent::FEstado
{
	ExperimentaChem::FMixture Mezcla = ExperimentaChem::EmptyMixture();
	ExperimentaChem::FAnalysis Analisis = ExperimentaChem::AnalyzeMixture(Mezcla);
	TArray<FString> Reglas;
};

UMezclaComponent::UMezclaComponent()
	: Estado(MakePimpl<FEstado>())
{
	PrimaryComponentTick.bCanEverTick = true;
	PrimaryComponentTick.bStartWithTickEnabled = true;
}

bool UMezclaComponent::AnadirReactivo(const FString& IdReactivo, float Cantidad, FString& Mensaje)
{
	const FTCHARToUTF8 Id(*IdReactivo);
	const auto Resultado = ExperimentaChem::AddReagent(Estado->Mezcla,
		std::string_view(Id.Get(), static_cast<size_t>(Id.Length())), static_cast<double>(Cantidad));
	if (!Resultado.bOk)
	{
		Mensaje = DesdeUtf8(Resultado.Message);
		return false;
	}
	Estado->Mezcla = Resultado.Value.Mixture;
	Estado->Reglas.Reset();
	const auto& Reglas = ExperimentaChem::GetRules();
	for (const ExperimentaChem::FEvent& Evento : Resultado.Value.Events)
	{
		Estado->Reglas.Add(DesdeUtf8(Reglas[Evento.Rule].Id));
	}
	Mensaje = DesdeUtf8(Resultado.Value.Note);
	Actualizar();
	return true;
}

void UMezclaComponent::Vaciar()
{
	Estado->Mezcla = ExperimentaChem::EmptyMixture();
	Estado->Reglas.Reset();
	SuspendidoG = 0.0f;
	SolidoPrevioG = 0.0f;
	Heterogeneidad = 0.0f;
	Actualizar();
}

void UMezclaComponent::FijarMezcla(const ExperimentaChem::FMixture& Mezcla)
{
	Estado->Mezcla = Mezcla;
	Actualizar();
}

void UMezclaComponent::Actualizar()
{
	Estado->Analisis = ExperimentaChem::AnalyzeMixture(Estado->Mezcla);
	if (!Liquido)
	{
		return;
	}
	// Lo que el modelo acaba de precipitar entra como nube concentrada; lo que se disuelve sale
	// primero de la suspensión. Suspensión + sedimento es siempre el sólido del modelo.
	const float Solido = SolidosGramos();
	if (Solido > SolidoPrevioG + 1.0e-7f)
	{
		SuspendidoG += Solido - SolidoPrevioG;
		Heterogeneidad = 1.0f;
	}
	SuspendidoG = FMath::Clamp(SuspendidoG, 0.0f, Solido);
	SolidoPrevioG = Solido;
	Liquido->FijarVolumenML(VolumenML());
	AplicarAspecto();
}

FLinearColor UMezclaComponent::ColorDisolucion() const
{
	return FLinearColor(FColor::FromHex(DesdeUtf8(Estado->Analisis.Color.Color)));
}

FString UMezclaComponent::ColorModeloHex() const
{
	return DesdeUtf8(Estado->Analisis.Color.Color);
}

float UMezclaComponent::IntensidadColor() const
{
	const ExperimentaChem::FSolutionColor& Color = Estado->Analisis.Color;
	// El modelo señala «ninguna especie coloreada» con #cfe6ee y opacidad 0,3 (convención de la web).
	if (VolumenML() <= 0.0f || Color.Color == "#cfe6ee")
	{
		return 0.0f;
	}
	return FMath::Clamp(static_cast<float>((Color.Opacity - 0.2) / 0.72), 0.0f, 1.0f);
}

float UMezclaComponent::SuspendidoGramos() const
{
	return SuspendidoG;
}

float UMezclaComponent::SedimentoGramos() const
{
	return FMath::Max(0.0f, SolidosGramos() - SuspendidoG);
}

float UMezclaComponent::Turbidez() const
{
	const float Volumen = VolumenML();
	return Volumen > 0.0f ? 1.0f - FMath::Exp(-OpacidadPorConcentracion * SuspendidoG / Volumen) : 0.0f;
}

void UMezclaComponent::AvanzarAspecto(float Segundos)
{
	if (Segundos <= 0.0f || (SuspendidoG <= 0.0f && Heterogeneidad <= 0.0f))
	{
		return;
	}
	Heterogeneidad = FMath::Max(0.0f, Heterogeneidad - Segundos / SegundosMezcla);
	SuspendidoG *= FMath::Exp(-Segundos / SegundosSedimentacion);
	if (SuspendidoG < 1.0e-5f)
	{
		SuspendidoG = 0.0f;
	}
	AplicarAspecto();
}

void UMezclaComponent::AplicarAspecto()
{
	if (!Liquido)
	{
		return;
	}
	const float Solido = SolidosGramos();
	// El color sale de la tabla de especies del modelo; si la especie no tiene, blanco.
	FLinearColor Color(0.82f, 0.82f, 0.80f);
	if (Solido > 1.0e-6f)
	{
		const ExperimentaChem::FSpecies& Especie = ExperimentaChem::GetSpecies()[Estado->Analisis.Solids[0].Species];
		if (Especie.Color)
		{
			Color = FLinearColor(FColor::FromHex(DesdeUtf8(Especie.Color)));
		}
	}

	UMaterialInterface* Material = MaterialIncoloro;
	if ((Solido > 1.0e-6f || IntensidadColor() > 0.01f) && MaterialSuspension)
	{
		if (!InstanciaSuspension || InstanciaSuspension->Parent != MaterialSuspension)
		{
			InstanciaSuspension = UMaterialInstanceDynamic::Create(MaterialSuspension, this);
		}
		InstanciaSuspension->SetVectorParameterValue(TEXT("Color"), Color);
		InstanciaSuspension->SetVectorParameterValue(TEXT("ColorDisolucion"), ColorDisolucion());
		InstanciaSuspension->SetScalarParameterValue(TEXT("Intensidad"), IntensidadColor());
		InstanciaSuspension->SetScalarParameterValue(TEXT("Turbidez"), Turbidez());
		InstanciaSuspension->SetScalarParameterValue(TEXT("Heterogeneidad"), Heterogeneidad);
		Material = InstanciaSuspension;
	}
	else if (Solido > 1.0e-6f && MaterialPrecipitado)
	{
		Material = MaterialPrecipitado;
	}
	if (Material && Liquido->MaterialLiquido != Material)
	{
		Liquido->MaterialLiquido = Material;
		Liquido->SetMaterial(0, Material);
	}

	if (Sedimento)
	{
		const float SedimentoML = SedimentoGramos() / DensidadAparenteSedimento;
		// La malla solo se rehace cuando la capa cambia de forma apreciable.
		if (FMath::Abs(SedimentoML - SedimentoMLAplicado) > 0.02f || (SedimentoML <= 0.0f && SedimentoMLAplicado > 0.0f))
		{
			if (MaterialPrecipitado)
			{
				if (!InstanciaSedimento || InstanciaSedimento->Parent != MaterialPrecipitado)
				{
					InstanciaSedimento = UMaterialInstanceDynamic::Create(MaterialPrecipitado, this);
				}
				InstanciaSedimento->SetVectorParameterValue(TEXT("Color"), Color);
				Sedimento->MaterialLiquido = InstanciaSedimento;
			}
			Sedimento->FijarVolumenML(FMath::Min(SedimentoML, VolumenML()));
			SedimentoMLAplicado = SedimentoML;
		}
	}
}

FString UMezclaComponent::NombreReactivo(const FString& IdReactivo)
{
	const FTCHARToUTF8 Id(*IdReactivo);
	const int Indice = ExperimentaChem::FindReagent(std::string_view(Id.Get(), static_cast<size_t>(Id.Length())));
	return Indice >= 0 ? DesdeUtf8(ExperimentaChem::GetReagents()[Indice].Name) : IdReactivo;
}

FString UMezclaComponent::FormatoEs(float Valor, int32 Decimales)
{
	// Se redondea antes a los decimales pedidos para que 20,04999 no salga como 20,04.
	const double Escala = FMath::Pow(10.0, static_cast<double>(Decimales));
	FString Texto = DesdeUtf8(ExperimentaChem::FormatEs(FMath::RoundToDouble(static_cast<double>(Valor) * Escala) / Escala, Decimales));
	// FormatEs quita los ceros finales; en una lectura de volumen se quieren los decimales fijos.
	if (Decimales > 0)
	{
		int32 Coma = INDEX_NONE;
		if (!Texto.FindChar(TEXT(','), Coma))
		{
			Texto += TEXT(",");
			Coma = Texto.Len() - 1;
		}
		while (Texto.Len() - Coma - 1 < Decimales)
		{
			Texto += TEXT("0");
		}
	}
	return Texto;
}

float UMezclaComponent::VolumenML() const
{
	return static_cast<float>(Estado->Analisis.VolumeMl);
}

bool UMezclaComponent::TienePH() const
{
	return Estado->Analisis.PH.has_value();
}

float UMezclaComponent::PH() const
{
	return Estado->Analisis.PH.has_value() ? static_cast<float>(*Estado->Analisis.PH) : 0.0f;
}

float UMezclaComponent::TemperaturaC() const
{
	return static_cast<float>(Estado->Analisis.TemperatureC);
}

float UMezclaComponent::SolidosGramos() const
{
	double Gramos = 0.0;
	for (const ExperimentaChem::FSolidInfo& Solido : Estado->Analisis.Solids)
	{
		Gramos += Solido.Grams;
	}
	return static_cast<float>(Gramos);
}

FString UMezclaComponent::SolidoPrincipal() const
{
	if (Estado->Analisis.Solids.empty())
	{
		return FString();
	}
	return DesdeUtf8(ExperimentaChem::GetSpecies()[Estado->Analisis.Solids[0].Species].Id);
}

TArray<FString> UMezclaComponent::ReglasUltimaAdicion() const
{
	return Estado->Reglas;
}

void UMezclaComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
	Super::TickComponent(DeltaTime, TickType, ThisTickFunction);
	AvanzarAspecto(DeltaTime);
	if (DemoPasos.Num() == 0)
	{
		return;
	}
	// Guion de demostración: no es lógica de juego.
	const FString Nombre = GetOwner() ? GetOwner()->GetActorNameOrLabel() : GetName();
	DemoTiempo += DeltaTime;
	while (DemoPaso < DemoPasos.Num() && DemoTiempo >= DemoPasos[DemoPaso].Segundo)
	{
		const FPasoDemoMezcla& Paso = DemoPasos[DemoPaso];
		FString Mensaje;
		const bool bHecho = AnadirReactivo(Paso.Reactivo, Paso.Cantidad, Mensaje);
		UE_LOG(LogExperimentaMezcla, Display, TEXT("DEMO %s +%.0f %s -> %s; %.2f mL; pH %.2f; %.1f C; color %s intensidad %.2f; solido %s %.4f g (suspension %.4f, turbidez %.2f); reglas [%s]"),
			*Nombre, Paso.Cantidad, *Paso.Reactivo, bHecho ? TEXT("aceptado") : *Mensaje, VolumenML(), PH(), TemperaturaC(),
			*ColorModeloHex(), IntensidadColor(), *SolidoPrincipal(), SolidosGramos(), SuspendidoGramos(), Turbidez(),
			*FString::Join(ReglasUltimaAdicion(), TEXT(", ")));
		++DemoPaso;
	}
	// Una línea cada 5 s durante el reposo, para ver la sedimentación en el registro.
	if (DemoPaso >= DemoPasos.Num() && SolidosGramos() > 0.0f
		&& FMath::FloorToInt(DemoTiempo / 5.0f) != FMath::FloorToInt((DemoTiempo - DeltaTime) / 5.0f))
	{
		UE_LOG(LogExperimentaMezcla, Display, TEXT("DEMO_REPOSO %s t=%.0f s; suspension %.4f g; sedimento %.4f g; turbidez %.2f; capa %.2f mL"),
			*Nombre, DemoTiempo, SuspendidoGramos(), SedimentoGramos(), Turbidez(), Sedimento ? Sedimento->VolumenML : 0.0f);
	}
	if (DemoTiempo >= DemoCicloSegundos)
	{
		Vaciar();
		DemoTiempo = 0.0f;
		DemoPaso = 0;
	}
}

AMezclaActor::AMezclaActor()
{
	Mezcla = CreateDefaultSubobject<UMezclaComponent>(TEXT("Mezcla"));
	Mezcla->Liquido = Liquido;
	Sedimento = CreateDefaultSubobject<ULiquidoComponent>(TEXT("Sedimento"));
	Sedimento->SetupAttachment(Liquido);
	Sedimento->MeniscoMM = 0.0f;
	Sedimento->TranslucencySortPriority = 0;
	Mezcla->Sedimento = Sedimento;
}
