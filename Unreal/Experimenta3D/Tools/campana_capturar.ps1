# Mide FPS y captura /Game/Mapas/Campana (luz ya horneada) a 1920 x 1080 con los perfiles horneados.
#   powershell -ExecutionPolicy Bypass -File Unreal\Experimenta3D\Tools\campana_capturar.ps1
#   ... -Presets "horneado_media,horneado_alta" -Etiqueta campana -Calentar 20 -Medir 22
# Escribe en art\capturas\<Etiqueta>_<perfil>.png y <Etiqueta>_resultados.json (FPS medio, mediana, p95…).
# Se ejecuta en ventana con -game (no en el editor) y sin VSync; la cámara la fija el propio nivel.
param(
	[string]$Presets = "horneado_baja,horneado_media,horneado_alta",
	[string]$Etiqueta = "campana",
	[int]$Calentar = 20,
	[int]$Medir = 22,
	[int]$Ancho = 1920,
	[int]$Alto = 1080,
	[switch]$SinCapturas
)
$p = Split-Path -Parent $PSScriptRoot
$raiz = Split-Path -Parent (Split-Path -Parent $p)
$ue = "C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64"
$out = "$raiz\art\capturas"
New-Item -ItemType Directory -Force $out | Out-Null
$env:SONDA_SALIDA = $out; $env:SONDA_PRESETS = $Presets; $env:SONDA_CALENTAR = "$Calentar"; $env:SONDA_MEDIR = "$Medir"
$env:SONDA_ETIQUETA = $Etiqueta; $env:SONDA_ESPERA_CAPTURA = "6"; $env:SONDA_RESOLUCION = "${Ancho}x${Alto}"
$env:SONDA_CAPTURAR = $(if ($SinCapturas) { "0" } else { "1" })
$log = "$p\Saved\Logs\campana_captura.log"
$proc = Start-Process "$ue\UnrealEditor.exe" -PassThru -ArgumentList "`"$p\Experimenta3D.uproject`"", "/Game/Mapas/Campana", "-game", "-windowed", "-ResX=$Ancho", "-ResY=$Alto", "-NoScreenMessages", "-nosplash", "-nosound", "-unattended", "`"-abslog=$log`"", "`"-ExecCmds=py $p\Tools\sonda_medir.py`""
if (-not $proc.WaitForExit(900000)) { $proc.Kill(); "TIMEOUT" }
Select-String -Path $log -Pattern 'MEDIDA|SONDA_MEDIR_FIN|ERROR|LogRHI: .*Feature|RHI.*SM[56]|lighting needs to be rebuilt' | Select-Object -Last 12 | ForEach-Object { $_.Line }
