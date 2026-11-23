#include "LiquidoComponent.h"

#include "Materials/MaterialInterface.h"

namespace ExperimentaLiquido
{
	namespace
	{
		// Volumen (mm3) de un tronco de cono de radios R1 y R2 y altura H.
		double Tronco(double R1, double R2, double H)
		{
			return UE_DOUBLE_PI * H * (R1 * R1 + R1 * R2 + R2 * R2) / 3.0;
		}
	}

	TArray<FVector2D> OrdenarPerfil(const TArray<FVector2D>& Perfil)
	{
		TArray<FVector2D> Ordenado = Perfil;
		Ordenado.StableSort([](const FVector2D& A, const FVector2D& B)
		{
			return A.Y < B.Y || (A.Y == B.Y && A.X < B.X);
		});
		return Ordenado;
	}

	double RadioEn(const TArray<FVector2D>& Perfil, double AlturaMM)
	{
		if (Perfil.Num() == 0)
		{
			return 0.0;
		}
		if (AlturaMM <= Perfil[0].Y)
		{
			return Perfil[0].X;
		}
		for (int32 i = 0; i + 1 < Perfil.Num(); ++i)
		{
			const FVector2D& A = Perfil[i];
			const FVector2D& B = Perfil[i + 1];
			if (AlturaMM <= B.Y)
			{
				// A igual altura (escalón) se toma el radio mayor: es la pared.
				return B.Y > A.Y ? A.X + (B.X - A.X) * (AlturaMM - A.Y) / (B.Y - A.Y) : B.X;
			}
		}
		return Perfil.Last().X;
	}

	double VolumenHastaML(const TArray<FVector2D>& Perfil, double AlturaMM)
	{
		double Mm3 = 0.0;
		for (int32 i = 0; i + 1 < Perfil.Num(); ++i)
		{
			const FVector2D& A = Perfil[i];
			const FVector2D& B = Perfil[i + 1];
			if (AlturaMM <= A.Y)
			{
				break;
			}
			if (B.Y <= A.Y)
			{
				continue;
			}
			const double Tope = FMath::Min<double>(AlturaMM, B.Y);
			const double RadioTope = A.X + (B.X - A.X) * (Tope - A.Y) / (B.Y - A.Y);
			Mm3 += Tronco(A.X, RadioTope, Tope - A.Y);
		}
		return Mm3 / 1000.0;
	}

	double AlturaParaML(const TArray<FVector2D>& Perfil, double ML)
	{
		if (Perfil.Num() < 2)
		{
			return 0.0;
		}
		double Bajo = Perfil[0].Y;
		double Alto = Perfil.Last().Y;
		if (ML <= 0.0)
		{
			return Bajo;
		}
		if (ML >= VolumenHastaML(Perfil, Alto))
		{
			return Alto;
		}
		// El volumen crece con la altura: bisección (60 pasos dejan el error muy por debajo de 1e-9 mm).
		for (int32 Paso = 0; Paso < 60; ++Paso)
		{
			const double Medio = 0.5 * (Bajo + Alto);
			if (VolumenHastaML(Perfil, Medio) < ML)
			{
				Bajo = Medio;
			}
			else
			{
				Alto = Medio;
			}
		}
		return 0.5 * (Bajo + Alto);
	}
}

ULiquidoComponent::ULiquidoComponent(const FObjectInitializer& ObjectInitializer)
	: Super(ObjectInitializer)
{
	PrimaryComponentTick.bCanEverTick = true;
	PrimaryComponentTick.bStartWithTickEnabled = true;
	SetCollisionEnabled(ECollisionEnabled::NoCollision);
	// Se dibuja antes que el vidrio translúcido que lo contiene.
	TranslucencySortPriority = -1;
	bUseAsyncCooking = false;
}

void ULiquidoComponent::OnRegister()
{
	Super::OnRegister();
	Reconstruir();
}

void ULiquidoComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
	Super::TickComponent(DeltaTime, TickType, ThisTickFunction);
	if (DemoMLPorSegundo == 0.0f || DemoMaxML <= DemoMinML)
	{
		return;
	}
	float Nuevo = VolumenML + DemoSentido * DemoMLPorSegundo * DeltaTime;
	if (Nuevo >= DemoMaxML)
	{
		Nuevo = DemoMaxML;
		DemoSentido = -1.0f;
	}
	else if (Nuevo <= DemoMinML)
	{
		Nuevo = DemoMinML;
		DemoSentido = 1.0f;
	}
	FijarVolumenML(Nuevo);
}

void ULiquidoComponent::FijarVolumenML(float NuevoVolumenML)
{
	VolumenML = FMath::Clamp(NuevoVolumenML, 0.0f, CapacidadML());
	Reconstruir();
}

float ULiquidoComponent::AlturaNivelMM() const
{
	const TArray<FVector2D> Perfil = ExperimentaLiquido::OrdenarPerfil(PerfilInteriorMM);
	return static_cast<float>(ExperimentaLiquido::AlturaParaML(Perfil, VolumenML));
}

float ULiquidoComponent::CapacidadML() const
{
	const TArray<FVector2D> Perfil = ExperimentaLiquido::OrdenarPerfil(PerfilInteriorMM);
	return Perfil.Num() < 2 ? 0.0f : static_cast<float>(ExperimentaLiquido::VolumenHastaML(Perfil, Perfil.Last().Y));
}

void ULiquidoComponent::Reconstruir()
{
	const TArray<FVector2D> Perfil = ExperimentaLiquido::OrdenarPerfil(PerfilInteriorMM);
	if (Perfil.Num() < 2 || VolumenML <= 0.01f)
	{
		ClearAllMeshSections();
		return;
	}

	const double Fondo = Perfil[0].Y;
	const double Nivel = ExperimentaLiquido::AlturaParaML(Perfil, VolumenML);
	const double Holgura = HolguraMM;
	const double RadioNivel = FMath::Max(0.0, ExperimentaLiquido::RadioEn(Perfil, Nivel) - Holgura);
	const double Menisco = FMath::Min<double>(MeniscoMM, RadioNivel * 0.2);

	// Silueta (radio, altura) en mm: centro del fondo -> pared -> borde del menisco -> centro del nivel.
	TArray<FVector2D> Silueta;
	Silueta.Emplace(0.0, Fondo + Holgura);
	for (const FVector2D& Punto : Perfil)
	{
		if (Punto.Y > Fondo + 0.05 && Punto.Y < Nivel - 0.05 && Punto.X > Holgura)
		{
			Silueta.Emplace(Punto.X - Holgura, Punto.Y);
		}
	}
	if (Silueta.Num() == 1)
	{
		// Capa muy fina: sin puntos de pared intermedios, se añade el radio del fondo.
		Silueta.Emplace(FMath::Max(0.0, ExperimentaLiquido::RadioEn(Perfil, Fondo + Holgura) - Holgura), Fondo + Holgura);
	}
	Silueta.Emplace(RadioNivel, Nivel + Menisco);
	Silueta.Emplace(FMath::Max(0.0, RadioNivel - Menisco * 0.6), Nivel + Menisco * 0.45);
	Silueta.Emplace(FMath::Max(0.0, RadioNivel - Menisco * 1.6), Nivel + Menisco * 0.1);
	Silueta.Emplace(FMath::Max(0.0, RadioNivel - Menisco * 3.0), Nivel);
	Silueta.Emplace(0.0, Nivel);

	const int32 Gajos = 48;
	const int32 Anillos = Silueta.Num();
	const double MmACm = 0.1;

	TArray<FVector> Vertices;
	TArray<FVector> Normales;
	TArray<int32> Triangulos;
	Vertices.Reserve(Anillos * Gajos);
	Normales.Reserve(Anillos * Gajos);
	Triangulos.Reserve((Anillos - 1) * Gajos * 6);

	for (int32 i = 0; i < Anillos; ++i)
	{
		// Normal en el plano (radio, altura): perpendicular a la tangente, hacia fuera del líquido.
		const FVector2D Tangente = Silueta[FMath::Min(i + 1, Anillos - 1)] - Silueta[FMath::Max(i - 1, 0)];
		FVector2D Normal2D(Tangente.Y, -Tangente.X);
		if (!Normal2D.Normalize())
		{
			Normal2D = FVector2D(0.0, 1.0);
		}
		for (int32 j = 0; j < Gajos; ++j)
		{
			const double Angulo = 2.0 * UE_DOUBLE_PI * j / Gajos;
			const double C = FMath::Cos(Angulo);
			const double S = FMath::Sin(Angulo);
			Vertices.Emplace(Silueta[i].X * MmACm * C, Silueta[i].X * MmACm * S, Silueta[i].Y * MmACm);
			Normales.Emplace(Normal2D.X * C, Normal2D.X * S, Normal2D.Y);
		}
	}
	for (int32 i = 0; i + 1 < Anillos; ++i)
	{
		for (int32 j = 0; j < Gajos; ++j)
		{
			const int32 A = i * Gajos + j;
			const int32 B = i * Gajos + (j + 1) % Gajos;
			const int32 C = (i + 1) * Gajos + j;
			const int32 D = (i + 1) * Gajos + (j + 1) % Gajos;
			// Este orden es el correcto para las normales dadas. Probado el contrario (A, B, C, B, D, C):
			// todos los líquidos y el sedimento salían negros.
			Triangulos.Append({ A, C, B, B, C, D });
		}
	}

	CreateMeshSection_LinearColor(0, Vertices, Triangulos, Normales, TArray<FVector2D>(), TArray<FLinearColor>(),
		TArray<FProcMeshTangent>(), false);
	if (MaterialLiquido)
	{
		SetMaterial(0, MaterialLiquido);
	}
}

ALiquidoActor::ALiquidoActor()
{
	PrimaryActorTick.bCanEverTick = false;
	Liquido = CreateDefaultSubobject<ULiquidoComponent>(TEXT("Liquido"));
	RootComponent = Liquido;
}
