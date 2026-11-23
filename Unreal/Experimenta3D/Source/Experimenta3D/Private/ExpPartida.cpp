#include "ExpPartida.h"

using namespace ExperimentaChem;

FString FExpPartida::Texto(const std::string& Utf8Texto)
{
	const FUTF8ToTCHAR Convertido(Utf8Texto.data(), static_cast<int32>(Utf8Texto.size()));
	return FString::ConstructFromPtrSize(Convertido.Get(), Convertido.Length());
}

std::string FExpPartida::Utf8(const FString& Cadena)
{
	const FTCHARToUTF8 Convertido(*Cadena);
	return std::string(Convertido.Get(), static_cast<size_t>(Convertido.Length()));
}

FExpPartida::FExpPartida()
{
	Iniciar();
}

void FExpPartida::Iniciar()
{
	// Start() manda al tutorial si no se ha hecho; las mesas del tutorial no están en este nivel.
	Lab.bTutorialDone = true;
	Lab.Start(ELabMode::Guided);
	Lab.bLocked = true;
	bChorro = false;
	ChorroDesde.clear();
	Ultimo.reset();
	Reglas.Reset();
	LogVisto = 0;
	Lab.Message = "Elige la pr\303\241ctica en el tablero junto a la campana (E).";
}

void FExpPartida::Apuntar(const FString& NuevoObjetivo)
{
	const std::string Id = Utf8(NuevoObjetivo);
	if (Id != Lab.Target)
	{
		Lab.SetTarget(Id);
	}
}

void FExpPartida::PulsarUsar()
{
	// Panel de prácticas abierto (tras usar el tablero): usar elige la práctica de este corte.
	if (PanelPracticas())
	{
		Lab.Hood.SelectRecipe(PracticaId);
		Lab.Open("");
		Lab.bLocked = true;
		Lab.Message = "Pr\303\241ctica elegida: " + std::string(GetHoodRecipes()[static_cast<size_t>(FindHoodRecipe(PracticaId))].Title)
			+ ". Sigue los pasos del panel.";
		return;
	}
	const std::string T = Lab.Target;
	const int Sostenido = Lab.Hood.HeldIn(Lab.Hand);
	std::optional<EStreamTarget> Destino;
	if (T == "hood") { Destino = EStreamTarget::Flask; }
	else if (T == "hood-cylinder") { Destino = EStreamTarget::Cylinder; }
	if (Sostenido >= 0 && Destino.has_value())
	{
		ChorroDesde = T;
		if (Lab.Hood.StartStream(Sostenido, *Destino)) { bChorro = true; }
		else if (!Lab.Hood.Error.empty()) { Lab.Message = Lab.Hood.Error; }
		return;
	}
	Lab.Interact();
	if (Lab.Panel == "hood")
	{
		// La web abre aquí el panel de la campana, cuyo botón «Guardar en el cuaderno» llama a save().
		Lab.Open("");
		Lab.bLocked = true;
		if (!Lab.Hood.Mixture.Additions.empty())
		{
			Lab.Hood.Save();
			Lab.Message = "Observaci\303\263n guardada en el cuaderno.";
		}
		else
		{
			Lab.Message = "El matraz est\303\241 vac\303\255o. Con un frasco en la mano, mant\303\251n el clic sobre la probeta para medir.";
		}
	}
	else if (Lab.Panel == "recipes")
	{
		Lab.Message = "Tablero de pr\303\241cticas: pulsa E para empezar \302\253Prueba de cloruros\302\273.";
	}
	Observar();
}

void FExpPartida::SoltarUsar()
{
	if (bChorro)
	{
		bChorro = false;
		Lab.Hood.StopStream();
		Observar();
	}
}

void FExpPartida::Dejar()
{
	SoltarUsar();
	Lab.Drop();
}

void FExpPartida::Mano(EHand NuevaMano)
{
	SoltarUsar();
	Lab.SelectHand(NuevaMano);
}

void FExpPartida::Anotar()
{
	if (Lab.Hood.Mixture.Additions.empty())
	{
		Lab.Message = "No hay nada que anotar: el matraz est\303\241 vac\303\255o.";
		return;
	}
	Lab.Hood.Save();
	Lab.Message = "Observaci\303\263n guardada en el cuaderno.";
}

void FExpPartida::Avanzar(double Segundos)
{
	if (Segundos <= 0.0)
	{
		return;
	}
	Lab.Hood.Advance(Segundos * 1000.0);
	if (bChorro)
	{
		// Como Player.tsx: el chorro sigue solo mientras el destino siga en el punto de mira.
		if (Lab.Target != ChorroDesde || !Lab.Hood.Pouring.has_value()) { SoltarUsar(); }
		else { Lab.Hood.StreamTick(FMath::Min(Segundos, 0.1)); }
	}
	Observar();
}

void FExpPartida::Observar()
{
	if (!Lab.Hood.Mixture.Additions.empty())
	{
		Ultimo = AnalyzeMixture(Lab.Hood.Mixture);
	}
	for (const FHoodLogEntry& Entrada : Lab.Hood.Log)
	{
		if (static_cast<size_t>(Entrada.Id) <= LogVisto) { continue; }
		LogVisto = static_cast<size_t>(Entrada.Id);
		for (const ExperimentaChem::FEvent& Evento : Entrada.Events)
		{
			const FString Id = Texto(GetRules()[static_cast<size_t>(Evento.Rule)].Id);
			Reglas.AddUnique(Id);
		}
	}
	// Un chorro que se funde con la entrada anterior no crea entrada nueva: se revisa también la última.
	if (!Lab.Hood.Log.empty())
	{
		for (const ExperimentaChem::FEvent& Evento : Lab.Hood.Log.back().Events)
		{
			Reglas.AddUnique(Texto(GetRules()[static_cast<size_t>(Evento.Rule)].Id));
		}
	}
}

FString FExpPartida::Mensaje() const { return Texto(Lab.Message); }
FString FExpPartida::Objetivo() const { return Texto(Lab.Target); }

TArray<FExpPaso> FExpPartida::Pasos() const
{
	TArray<FExpPaso> Salida;
	if (!PracticaElegida())
	{
		return Salida;
	}
	const FHoodRecipe& Def = GetHoodRecipes()[static_cast<size_t>(Lab.Hood.Recipe->Recipe)];
	for (const FRecipeStep& Paso : RecipeSteps(Def, *Lab.Hood.Recipe, Lab.Hood, Lab.Ppe))
	{
		FExpPaso P;
		P.Clave = Texto(Paso.Key); P.Titulo = Texto(Paso.Title); P.Detalle = Texto(Paso.Detail); P.bHecho = Paso.bDone;
		for (const FRecipeTarget& Objetivo : Paso.Targets) { P.Objetivos.Add(Texto(Objetivo.Id)); }
		Salida.Add(MoveTemp(P));
	}
	return Salida;
}

bool FExpPartida::PracticaCompleta() const
{
	const TArray<FExpPaso> Lista = Pasos();
	if (Lista.Num() == 0) { return false; }
	for (const FExpPaso& Paso : Lista) { if (!Paso.bHecho) { return false; } }
	return true;
}

FString FExpPartida::TituloPractica() const
{
	return PracticaElegida() ? Texto(GetHoodRecipes()[static_cast<size_t>(Lab.Hood.Recipe->Recipe)].Title) : FString();
}

FString FExpPartida::EcuacionPractica() const
{
	return PracticaElegida() ? Texto(GetHoodRecipes()[static_cast<size_t>(Lab.Hood.Recipe->Recipe)].Equation) : FString();
}

double FExpPartida::PrecipitadoGramos() const
{
	return Ultimo.has_value() && !Ultimo->Solids.empty() ? Ultimo->Solids[0].Grams : 0.0;
}

FString FExpPartida::PrecipitadoNombre() const
{
	if (!Ultimo.has_value() || Ultimo->Solids.empty()) { return FString(); }
	const FSpecies& Especie = GetSpecies()[static_cast<size_t>(Ultimo->Solids[0].Species)];
	return Texto(Especie.Label);
}

TArray<FString> FExpPartida::ReglasDisparadas() const { return Reglas; }

double FExpPartida::ProgresoTransferencia() const
{
	if (!Lab.Hood.Transfer.has_value()) { return -1.0; }
	const double Duracion = Lab.Hood.Transfer->Kind == ETransfer::Rinse ? RinseMs : PourMs;
	return FMath::Clamp((Lab.Hood.NowMs() - Lab.Hood.Transfer->StartedAt) / Duracion, 0.0, 1.0);
}
