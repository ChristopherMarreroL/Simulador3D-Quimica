// Capa de estado de la campana de Experimenta 3D: porte a C++ estándar de src/state/hood.ts, de las ramas de
// src/state/lab.ts que tocan la campana y de src/experiments/hoodRecipes.ts (TypeScript).
//
// Mismas reglas que Chem.h:
// - Solo C++17 y la biblioteca estándar: ningún tipo de Unreal, sin excepciones, sin RTTI, sin E/S.
// - Reproduce el comportamiento del TypeScript tal cual, con sus rarezas (golden/README.md, «Comportamientos
//   congelados de la capa de estado»). La paridad se comprueba con golden/steps.json (RunStepsGolden).
// - Coma flotante estricta: Hood.cpp lleva #pragma float_control(precise) y fp_contract(off) además de
//   FPSemanticsMode.Precise del módulo. «ml + caudal · segundos» no debe fundirse en una FMA.
// - El tiempo es una entrada: el almacén no lee ningún reloj. NowMs avanza solo con Advance(), que ejecuta el
//   temporizador vencido con el reloj puesto en su instante exacto (como el reloj del arnés de golden/steps).
// - Todo el texto es UTF-8.
//
// Los reactivos se identifican por su índice en GetReagents() (Chem.h). El «orden del estante» de reagents.ts
// (reagentIds) es otro: lo da GetShelfOrder() y decide qué frasco «sostiene» una mano y el orden de los listados.
#pragma once

#include <array>
#include <optional>
#include <string>
#include <string_view>
#include <vector>

#include "ExperimentaChem/Chem.h"

// C4251: las clases exportadas guardan tipos de la biblioteca estándar. El módulo y quien lo usa se compilan con el
// mismo compilador y la misma biblioteca, así que no hay incompatibilidad de interfaz.
#if defined(_MSC_VER)
#pragma warning(push)
#pragma warning(disable : 4251)
#endif

namespace ExperimentaChem
{
	// ---------------------------------------------------------------- Constantes (hood.ts)

	constexpr int HoodTraySlots = 8;
	constexpr double PourMs = 1500.0;
	constexpr double RinseMs = 900.0;
	constexpr double CylinderMl = 100.0;
	constexpr double CylinderRate = 8.0;
	constexpr double PipetteMl = 10.0;
	constexpr double PipetteRate = 2.0;
	/** Antes de que caiga nada el frasco se inclina (o se carga la espátula) durante 0,3 s. */
	constexpr double TiltSeconds = 0.3;
	constexpr int HoodLogMax = 40;
	constexpr int HoodRecordsMax = 30;
	constexpr int NumReagents = 27;

	struct FStreamRate { double Rate; double Step; };
	/** STREAM[kind]: caudal por segundo y tamaño de cada paso que llega al matraz. */
	EXPERIMENTACHEM_API FStreamRate StreamRate(EReagentKind Kind);
	/** spatulaRate: g/s de la espátula según los segundos que se lleva el clic mantenido. */
	EXPERIMENTACHEM_API double SpatulaRate(double HeldSeconds);
	/** reagentIds de reagents.ts: índices de GetReagents() en el orden del estante. */
	EXPERIMENTACHEM_API const std::array<int, NumReagents>& GetShelfOrder();

	// ---------------------------------------------------------------- Prácticas (hoodRecipes.ts)

	enum class ETool { Probeta, Balanza, Gotero };
	struct FRecipeAdd { int Reagent; double Amount; ETool Tool; };
	struct FHoodRecipe
	{
		const char* Id; const char* Title; const char* Equation; const char* Level;
		const char* Goal; const char* Observe; const char* Waste; const char* Safety;
		std::vector<FRecipeAdd> Adds;
		/** Reglas del motor que deben dispararse: así cada práctica está respaldada por el modelo. */
		std::vector<const char*> Expect;
	};
	EXPERIMENTACHEM_API const std::vector<FHoodRecipe>& GetHoodRecipes();
	/** recipeById: índice de la práctica o -1. */
	EXPERIMENTACHEM_API int FindHoodRecipe(std::string_view Id);

	// ---------------------------------------------------------------- Estado de la campana (hood.ts)

	enum class EHand { Left, Right };
	enum class EPlace { Shelf, Hood, Left, Right };
	enum class ESash { Closed, Work, Open };
	enum class EStreamTarget { Flask, Cylinder, Balance, Pipette };
	enum class ETransfer { Bottle, Cylinder, Balance, Waste, Rinse, Pipette };
	enum class EPipettePlace { Cabinet, Hood, Left, Right };
	enum class EToggle { Light, Fan, Stirring };

	struct FHoodLogEntry
	{
		/** Sustituye al id «pour-<ms>-<n>»: único en todo el proceso, como el contador del módulo de TypeScript. */
		long long Id = 0; double At = 0.0;
		int Reagent = -1; double Amount = 0.0;
		std::vector<FEvent> Events; double DeltaT = 0.0; std::string Note;
	};

	/** Último cambio visible: lo usa la escena para animar gas, precipitados y calor. */
	struct FHoodBurst
	{
		double At = 0.0; double GasMol = 0.0; double Vigor = 0.0;
		std::optional<std::string> SolidColor; double DeltaT = 0.0; bool bColorChange = false;
	};

	struct FHoodRecordGas { std::string Label; double Mol; };
	struct FHoodRecordLog { int Reagent; double Amount; std::vector<std::string> Titles, Equations; };
	struct FHoodRecord
	{
		/** «hood-<ms>-<n>» y la fecha ISO de TypeScript: aquí el instante del reloj del almacén. */
		long long Id = 0; double At = 0.0; std::string Observation;
		std::vector<FAddition> Additions;
		std::optional<double> PH; double TemperatureC = RoomC; double VolumeMl = 0.0;
		std::vector<std::string> Solids; std::vector<FHoodRecordGas> Gases;
		std::vector<FHoodRecordLog> Log;
	};

	/** Progreso de la práctica elegida. `Added` va por índice de GetReagents(); nullopt es «clave ausente». */
	struct FRecipeRun
	{
		int Recipe = -1; bool bCleanNeeded = false;
		std::array<std::optional<double>, NumReagents> Added{};
		bool bObserved = false, bSaved = false, bDisposed = false;
	};

	struct FPouring { int Reagent = -1; double Amount = 0.0; double StartedAt = 0.0; bool bStream = false; std::optional<EStreamTarget> Target; };
	struct FTransferState { ETransfer Kind = ETransfer::Bottle; int Reagent = -1; double StartedAt = 0.0; };
	struct FCylinder { int Reagent = -1; double Ml = 0.0; int Dirty = -1; };
	struct FBalance { int Reagent = -1; double Grams = 0.0; };
	struct FPipette { EPipettePlace Place = EPipettePlace::Cabinet; int Reagent = -1; double Ml = 0.0; int Dirty = -1; };

	/**
	 * useHood. Las acciones tienen los mismos nombres y devuelven lo mismo que en hood.ts. Lo que allí son
	 * variables del módulo (el contador de ids, el chorro que se está fundiendo) aquí son miembros que
	 * ResetSession() tampoco reinicia.
	 */
	class EXPERIMENTACHEM_API FHood
	{
	public:
		FHood();

		// Estado (solo lectura para el juego; lo modifican las acciones).
		std::array<EPlace, NumReagents> Places{};
		FMixture Mixture; std::vector<FHoodLogEntry> Log; std::optional<FHoodBurst> Burst;
		std::optional<FPouring> Pouring; std::optional<FTransferState> Transfer;
		FCylinder Cylinder; FBalance Balance; FPipette Pipette;
		int Disposals = 0; std::optional<FRecipeRun> Recipe;
		ESash Sash = ESash::Work; bool bLight = true, bFan = true, bStirring = false;
		std::vector<FHoodRecord> Records; std::optional<double> SavedAt; std::string Error;

		/** Reloj del almacén en ms (sustituye a Date.now()). */
		double NowMs() const { return Now; }
		/** Avanza el reloj; si vence el temporizador pendiente, se ejecuta con el reloj en su instante. */
		void Advance(double Ms);
		/** Solo para las pruebas: reloj a 0 y sin temporizador, como el reloj del arnés al empezar cada caso. */
		void ResetClock() { Now = 0.0; Timer = FTimer(); }

		/** heldIn: el primer frasco del estante que está en esa mano, o -1. */
		int HeldIn(EHand Hand) const;
		std::string Pick(int Reagent, EHand Hand);
		std::string Put(EHand Hand, EPlace Where);
		bool Pour(int Reagent, double Amount);
		bool StartStream(int Reagent, EStreamTarget Target = EStreamTarget::Flask);
		void StreamTick(double Seconds);
		void StopStream();
		std::string TakePipette(EHand Hand);
		std::string PutPipette(EHand Hand, EPipettePlace Where);
		bool PourPipette();
		bool PourCylinder();
		bool PourBalance();
		bool RinseCylinder();
		bool Dispose();
		/** selectRecipe: un id desconocido equivale a abandonar la práctica. */
		void SelectRecipe(std::string_view Id);
		void SelectRecipe(std::nullptr_t) { SelectRecipe(std::string_view()); }
		void Empty();
		void SetSash(ESash InSash) { Sash = InSash; }
		std::string ToggleSash();
		void Toggle(EToggle Key);
		void Save();
		void Annotate(long long RecordId, std::string Observation);
		void ReturnAll();
		void ResetSession();
		void CancelPour();

	private:
		enum class ETimer { None, Pour, Transfer };
		struct FTimer { ETimer What = ETimer::None; double Due = 0.0; int Reagent = -1; double Amount = 0.0; ETransfer Kind = ETransfer::Bottle; bool bPipetteDirty = false; };
		struct FStream { double Pending = 0.0; long long EntryId = -1; int AdditionIndex = -1; };

		double Now = 0.0;
		FTimer Timer;
		FStream Stream;
		long long EntryCount = 0;

		bool Busy() const { return Pouring.has_value() || Transfer.has_value(); }
		bool Apply(int Reagent, double Amount, bool bMerge);
		void TransferThen(ETransfer Kind, int Reagent);
		void RunTimer(const FTimer& Fired);
		void EmptyTools();
		void ResetStream() { Stream = FStream(); }
	};

	/** amountText: «20 mL», «0,3 g», «3 gotas». */
	EXPERIMENTACHEM_API std::string AmountText(int Reagent, double Amount);
	/** hoodGuidedIndex: pista de la mezcla libre (0 coger un frasco, 1 llevarlo, 2 mezclar, 3 anotar). */
	EXPERIMENTACHEM_API int HoodGuidedIndex(const FHood& Hood);

	struct FRecipeTarget { std::string Id; std::string Label; };
	struct FRecipeStep { std::string Key, Title, Detail; bool bDone = false; std::vector<FRecipeTarget> Targets; };
	struct FPpe { bool bGoggles = false; bool bGloves = false; };
	/** recipeSteps: el procedimiento derivado del estado real (protección, reactivos, medidas, observar, anotar, residuos). */
	EXPERIMENTACHEM_API std::vector<FRecipeStep> RecipeSteps(const FHoodRecipe& Def, const FRecipeRun& Run, const FHood& Hood, const FPpe& Ppe);

	// ---------------------------------------------------------------- Laboratorio (ramas de lab.ts que tocan la campana)

	enum class ELabMode { Guided, Free, Tutorial };

	/**
	 * Subconjunto de useLab: sesión, mano activa, protección, mensaje del HUD, panel y práctica activa, y las ramas
	 * de interact() y drop() de la campana. El vaso y los frascos de la práctica 01 solo están para ocupar una mano
	 * (su mezcla, add() y las mesas 02 y 03 no se portan), y no hay gabinetes ni vitrina (src/state/storage.ts).
	 * Panel, práctica activa, lugares y objetivos van como texto, con los mismos valores que en TypeScript.
	 */
	class EXPERIMENTACHEM_API FLabSession
	{
	public:
		FHood Hood;

		std::optional<ELabMode> Mode; ELabMode RequestedMode = ELabMode::Guided; bool bLocked = false;
		/** "" equivale a null. */
		std::string Panel;
		std::string ActivePractice = "reaction";
		bool bTutorialDone = false; int Tutorial = 0; double Moved = 0.0, Looked = 0.0;
		EHand Hand = EHand::Right; FPpe Ppe;
		/** Vaso, vinagre y bicarbonato: "shelf", "bench", "support-1", "support-2", "left" o "right". */
		std::string BeakerAt = "shelf", VinegarAt = "shelf", BicarbonateAt = "shelf";
		/** "" equivale a null. */
		std::string Target;
		std::string Message;

		void Start(ELabMode InMode);
		void Menu();
		void SelectHand(EHand InHand);
		void SetTarget(std::string_view InTarget);
		void Progress(bool bMove, double Amount);
		/** Tecla E sobre Target. */
		void Interact();
		/** Tecla Q sobre Target. */
		void Drop();
		/** open(panel): "" cierra el panel. Borra el mensaje y libera el puntero. */
		void Open(std::string_view InPanel);

	private:
		std::string* LocationOf(std::string_view Item);
		bool HandBusy() const;
	};

	/** isHoodTarget de lab.ts. */
	EXPERIMENTACHEM_API bool IsHoodTarget(std::string_view Target);
}

#if defined(_MSC_VER)
#pragma warning(pop)
#endif
