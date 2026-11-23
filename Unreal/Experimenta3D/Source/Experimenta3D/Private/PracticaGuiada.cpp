#include "PracticaGuiada.h"

#include "MezclaComponent.h"

DEFINE_LOG_CATEGORY_STATIC(LogExperimentaPractica, Log, All);

namespace
{
	// Receta «cloruro-plata» de src/experiments/hoodRecipes.ts: adiciones con la probeta y regla esperada.
	struct FAdicionReceta { const TCHAR* Reactivo; float Cantidad; };
	const FAdicionReceta AdicionesCloruros[] = { { TEXT("agno3"), 20.0f }, { TEXT("nacl"), 5.0f } };
	const TCHAR* ReglasEsperadasCloruros[] = { TEXT("ksp-AgCl") };
	const TCHAR* ObservacionCloruros = TEXT("Precipitado blanco lechoso de AgCl.");
}

UPracticaGuiadaComponent::UPracticaGuiadaComponent()
{
	PrimaryComponentTick.bCanEverTick = false;
}

void UPracticaGuiadaComponent::Reiniciar()
{
	Anadidos.Reset();
	ReglasVistas.Reset();
	PasoAnunciado = 0;
}

float UPracticaGuiadaComponent::Anadido(const FString& ReactivoId) const
{
	const float* Valor = Anadidos.Find(ReactivoId);
	return Valor ? *Valor : 0.0f;
}

void UPracticaGuiadaComponent::RegistrarAdicion(const FString& ReactivoId, float Cantidad, const TArray<FString>& Reglas)
{
	// Como en la web: cuenta cualquier reactivo, también los que la receta no usa.
	Anadidos.FindOrAdd(ReactivoId) += Cantidad;
	for (const FString& Regla : Reglas)
	{
		ReglasVistas.Add(Regla);
	}
	const int32 Actual = PasoActual();
	if (Actual != PasoAnunciado)
	{
		PasoAnunciado = Actual;
		const TArray<FPasoPractica> Lista = Pasos();
		if (Actual < 0)
		{
			UE_LOG(LogExperimentaPractica, Display, TEXT("PRACTICA ¡%s: experimento completado!"), *Titulo());
		}
		else
		{
			UE_LOG(LogExperimentaPractica, Display, TEXT("PRACTICA Paso %d de %d: %s"), Actual + 1, Lista.Num(), *Lista[Actual].Titulo);
		}
	}
}

TArray<FPasoPractica> UPracticaGuiadaComponent::Pasos() const
{
	TArray<FPasoPractica> Lista;
	int32 Indice = 0;
	for (const FAdicionReceta& Adicion : AdicionesCloruros)
	{
		FPasoPractica Paso;
		Paso.Clave = FString::Printf(TEXT("add-%d"), Indice++);
		Paso.ReactivoId = Adicion.Reactivo;
		Paso.Cantidad = Adicion.Cantidad;
		Paso.Titulo = FString::Printf(TEXT("Mide %s mL de %s en la probeta y viértelos en el matraz"),
			*UMezclaComponent::FormatoEs(Adicion.Cantidad, 0), *UMezclaComponent::NombreReactivo(Adicion.Reactivo));
		Paso.Detalle = TEXT("Mantén el clic sobre la probeta y lee la marca.");
		// Regla del 90 %, inclusive y sin límite superior.
		Paso.bHecho = Anadido(Adicion.Reactivo) >= Adicion.Cantidad * 0.9f;
		Lista.Add(Paso);
	}
	FPasoPractica Observar;
	Observar.Clave = TEXT("observe");
	Observar.Titulo = TEXT("Observa el resultado");
	Observar.Detalle = ObservacionCloruros;
	Observar.bHecho = true;
	for (const TCHAR* Regla : ReglasEsperadasCloruros)
	{
		Observar.bHecho = Observar.bHecho && ReglasVistas.Contains(Regla);
	}
	Lista.Add(Observar);
	return Lista;
}

int32 UPracticaGuiadaComponent::PasoActual() const
{
	const TArray<FPasoPractica> Lista = Pasos();
	for (int32 i = 0; i < Lista.Num(); ++i)
	{
		if (!Lista[i].bHecho)
		{
			return i;
		}
	}
	return -1;
}
