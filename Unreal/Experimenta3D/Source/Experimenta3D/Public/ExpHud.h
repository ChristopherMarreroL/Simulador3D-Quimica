// Interfaz UMG del juego, construida en C++ sin recursos de widget (WidgetTree en NativeOnInitialized).
//  - UExpHud: punto de mira, aviso contextual, panel de tarea arriba a la izquierda (pasos y barra de progreso),
//    casillas de las dos manos abajo, mensaje de la capa de estado y resultado al completar.
//  - UExpMenuPausa: Continuar, calidad Baja/Media/Alta (los perfiles medidos de Tools/sonda_medir.py) y Salir.
#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"

#include "ExpHud.generated.h"

class AExpPersonaje;
class UBorder;
class UButton;
class UExpSubsistema;
class UProgressBar;
class UTextBlock;
class UVerticalBox;

UCLASS()
class EXPERIMENTA3D_API UExpHud : public UUserWidget
{
	GENERATED_BODY()
public:
	void Actualizar(const UExpSubsistema& S, const AExpPersonaje& Jugador);

protected:
	virtual void NativeOnInitialized() override;

private:
	UPROPERTY() TObjectPtr<UTextBlock> Mira;
	UPROPERTY() TObjectPtr<UTextBlock> Aviso;
	UPROPERTY() TObjectPtr<UBorder> Panel;
	UPROPERTY() TObjectPtr<UTextBlock> Titulo;
	UPROPERTY() TObjectPtr<UTextBlock> Ecuacion;
	UPROPERTY() TObjectPtr<UProgressBar> Progreso;
	UPROPERTY() TObjectPtr<UTextBlock> Contador;
	UPROPERTY() TObjectPtr<UVerticalBox> Lista;
	UPROPERTY() TArray<TObjectPtr<UTextBlock>> Lineas;
	UPROPERTY() TObjectPtr<UTextBlock> Detalle;
	UPROPERTY() TObjectPtr<UTextBlock> Mensaje;
	UPROPERTY() TObjectPtr<UBorder> CajaMano[2];
	UPROPERTY() TObjectPtr<UTextBlock> TextoMano[2];
	UPROPERTY() TObjectPtr<UBorder> Resultado;
	UPROPERTY() TObjectPtr<UTextBlock> TextoResultado;
	UPROPERTY() TObjectPtr<UTextBlock> Ayuda;
};

UCLASS()
class EXPERIMENTA3D_API UExpMenuPausa : public UUserWidget
{
	GENERATED_BODY()
public:
	/** 0 Baja, 1 Media, 2 Alta: mismos ajustes que los perfiles horneado_* medidos. */
	static void AplicarCalidad(UWorld* Mundo, int32 Nivel);
	static int32 CalidadActual;

protected:
	virtual void NativeOnInitialized() override;

private:
	UPROPERTY() TObjectPtr<UTextBlock> Estado;
	UFUNCTION() void AlContinuar();
	UFUNCTION() void AlBaja();
	UFUNCTION() void AlMedia();
	UFUNCTION() void AlAlta();
	UFUNCTION() void AlSalir();
	void Refrescar();
};
