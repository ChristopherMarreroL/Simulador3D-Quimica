// Partida de la campana: une las acciones del jugador (apuntar a un objetivo, usar, mantener, dejar, cambiar de mano,
// anotar y el paso del tiempo) con la capa de estado validada (ExperimentaChem::FLabSession, 197/197 casos de
// golden/steps.json). Es C++ sin UObject para que la prueba Automation la recorra igual que el jugador, sin mundo.
//
// Reglas: aquí no hay química ni reglas de procedimiento propias. Solo se traduce, igual que src/world/Player.tsx:
//  - clic/E pulsado: si la mano activa sostiene un frasco y el objetivo es el matraz ('hood') o la probeta
//    ('hood-cylinder'), empieza el chorro (StartStream); si no, FLabSession::Interact().
//  - soltar: corta el chorro. El chorro también se corta si el objetivo deja de estar en el punto de mira.
//  - Q: FLabSession::Drop().
//  - El tablero de prácticas ('recipe-board') abre el panel «recipes»; con el panel abierto, usar elige la práctica.
#pragma once

#include "CoreMinimal.h"

#include "ExperimentaChem/Hood.h"

#include <optional>

struct EXPERIMENTA3D_API FExpPaso
{
	FString Clave, Titulo, Detalle;
	bool bHecho = false;
	TArray<FString> Objetivos;
};

class EXPERIMENTA3D_API FExpPartida
{
public:
	/** Práctica que ofrece el tablero en este corte (la única con escena completa). */
	static constexpr const char* PracticaId = "cloruro-plata";

	FExpPartida();

	/** Sesión guiada nueva (sin tutorial: este nivel no tiene las mesas del tutorial). */
	void Iniciar();

	void Apuntar(const FString& Objetivo);
	void PulsarUsar();
	void SoltarUsar();
	void Dejar();
	void Mano(ExperimentaChem::EHand Mano);
	/** N: guarda el registro de la observación (paso «Anótalo»). */
	void Anotar();
	/** Tiempo de juego en segundos: temporizadores de la capa de estado y caudal del chorro. */
	void Avanzar(double Segundos);

	const ExperimentaChem::FLabSession& Sesion() const { return Lab; }
	const ExperimentaChem::FHood& Campana() const { return Lab.Hood; }
	bool Vertiendo() const { return bChorro; }
	FString Mensaje() const;
	FString Objetivo() const;
	bool PanelPracticas() const { return Lab.Panel == "recipes"; }

	/** Pasos de la práctica elegida (vacío si no hay ninguna). */
	TArray<FExpPaso> Pasos() const;
	bool PracticaElegida() const { return Lab.Hood.Recipe.has_value() && Lab.Hood.Recipe->Recipe >= 0; }
	bool PracticaCompleta() const;
	FString TituloPractica() const;
	FString EcuacionPractica() const;

	/** Último análisis con líquido en el matraz (sirve para el resultado después de desechar). */
	const std::optional<ExperimentaChem::FAnalysis>& UltimoAnalisis() const { return Ultimo; }
	/** Gramos del último precipitado observado y su especie («AgCl»), para el resultado. */
	double PrecipitadoGramos() const;
	FString PrecipitadoNombre() const;
	/** Identificadores de reglas del motor que se dispararon en la sesión («ksp-AgCl»…). */
	TArray<FString> ReglasDisparadas() const;

	/** Progreso 0..1 de la transferencia en curso (verter la probeta, enjuagar, desechar), o -1. */
	double ProgresoTransferencia() const;

	static FString Texto(const std::string& Utf8);
	static std::string Utf8(const FString& Texto);

private:
	ExperimentaChem::FLabSession Lab;
	bool bChorro = false;
	std::string ChorroDesde;
	std::optional<ExperimentaChem::FAnalysis> Ultimo;
	TArray<FString> Reglas;
	size_t LogVisto = 0;
	void Observar();
};
