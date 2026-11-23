# Regenera /Game/Mapas/Vitrina y guarda una captura en art\capturas\<Etiqueta>_media_taa.png.
#   powershell -File Unreal\Experimenta3D\Tools\vitrina_capturar.ps1 [-Etiqueta vitrina]
param([string]$Etiqueta = "vitrina", [string]$Presets = "media_taa", [string]$Mapa = "Vitrina", [string]$Guion = "vitrina_crear_nivel.py")
$p = Split-Path -Parent $PSScriptRoot
$raiz = Split-Path -Parent (Split-Path -Parent $p)
$ue = "C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64"
$log = "$p\Saved\Logs\vitrina_crear.log"
& "$ue\UnrealEditor-Cmd.exe" "$p\Experimenta3D.uproject" -run=pythonscript "-script=$p\Tools\$Guion" -nullrhi -unattended -nosplash -nosound "-abslog=$log" | Out-Null
"CREAR_EXIT=$LASTEXITCODE"
Select-String -Path $log -Pattern 'VITRINA_|LABORATORIO_OK|LogPython: Error' | Select-Object -First 12 | ForEach-Object { $_.Line }
if ($LASTEXITCODE -ne 0) { exit 1 }
$out = "$raiz\art\capturas"; New-Item -ItemType Directory -Force $out | Out-Null
$env:SONDA_SALIDA = $out; $env:SONDA_PRESETS = $Presets; $env:SONDA_CALENTAR = "25"; $env:SONDA_MEDIR = "5"
$env:SONDA_ETIQUETA = $Etiqueta; $env:SONDA_ESPERA_CAPTURA = "6"
$proc = Start-Process "$ue\UnrealEditor.exe" -PassThru -ArgumentList "`"$p\Experimenta3D.uproject`"", "/Game/Mapas/$Mapa", "-game", "-windowed", "-ResX=1280", "-ResY=720", "-CustomConfig=Sonda", "-NoScreenMessages", "-nosplash", "-nosound", "-unattended", "-ExperimentaPaseo", "`"-abslog=$p\Saved\Logs\vitrina_captura.log`"", "`"-ExecCmds=py $p\Tools\sonda_medir.py`""
if (-not $proc.WaitForExit(480000)) { $proc.Kill(); "TIMEOUT" }
Select-String -Path "$p\Saved\Logs\vitrina_captura.log" -Pattern 'MEDIDA|Failed to compile|LogShaderCompilers.*rror' | Select-Object -Last 4 | ForEach-Object { $_.Line }
