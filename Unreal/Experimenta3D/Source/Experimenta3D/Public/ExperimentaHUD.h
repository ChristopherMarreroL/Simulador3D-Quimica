// Interfaz mínima dibujada sobre el lienzo (sin recursos UMG): punto de mira, aviso contextual
// junto a él, las dos manos abajo y un mensaje temporal. Todo en español.
#pragma once

#include "CoreMinimal.h"
#include "GameFramework/HUD.h"
#include "ExperimentaHUD.generated.h"

UCLASS()
class EXPERIMENTA3D_API AExperimentaHUD : public AHUD
{
	GENERATED_BODY()

public:
	virtual void DrawHUD() override;
};
