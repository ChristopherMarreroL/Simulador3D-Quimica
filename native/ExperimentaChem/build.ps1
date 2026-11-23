# Compila ExperimentaChem fuera de Unreal (MSVC + CMake + Ninja de Visual Studio) y ejecuta los vectores
# de referencia de golden/chemistry.json y de golden/steps.json (capa de estado de la campana).
#
#   powershell -ExecutionPolicy Bypass -File native\ExperimentaChem\build.ps1
#   powershell -ExecutionPolicy Bypass -File native\ExperimentaChem\build.ps1 -Config Debug -Clean
#
# Código de salida: el de chem_golden (0 solo si pasan todos los casos; 1 si algo falla; 2 si no se pudo
# leer el JSON), o 3 si se compiló pero Windows no dejó ejecutar el binario.
param(
	[ValidateSet('Release', 'Debug', 'RelWithDebInfo')]
	[string]$Config = 'Release',
	[switch]$Clean,
	[int]$MaxFailures = 40,
	# Solo compila; no ejecuta los vectores.
	[switch]$NoRun
)

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$repo = (Resolve-Path (Join-Path $here '..\..')).Path
$buildDir = Join-Path $here 'build'

# 1. Localizar Visual Studio con las herramientas de C++.
$vsRoot = $null
$vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
if (Test-Path $vswhere) {
	$vsRoot = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath | Select-Object -First 1
}
if (-not $vsRoot) { $vsRoot = 'C:\Program Files\Microsoft Visual Studio\18\Community' }
$vcvars = Join-Path $vsRoot 'VC\Auxiliary\Build\vcvars64.bat'
$cmake = Join-Path $vsRoot 'Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe'
$ninja = Join-Path $vsRoot 'Common7\IDE\CommonExtensions\Microsoft\CMake\Ninja\ninja.exe'
foreach ($tool in @($vcvars, $cmake, $ninja)) {
	if (-not (Test-Path $tool)) { throw "No se encuentra $tool. Instala en Visual Studio «Desarrollo para el escritorio con C++» y las herramientas de CMake." }
}

# 2. Cargar en este proceso el entorno de MSVC para x64 (cl, link, INCLUDE, LIB).
$environment = & cmd.exe /c "`"$vcvars`" >nul 2>&1 && set"
if ($LASTEXITCODE -ne 0) { throw "vcvars64.bat falló." }
foreach ($line in $environment) {
	$index = $line.IndexOf('=')
	if ($index -gt 0) { Set-Item -Path ("Env:" + $line.Substring(0, $index)) -Value $line.Substring($index + 1) }
}

# 3. Configurar y compilar en native/ExperimentaChem/build.
if ($Clean -and (Test-Path $buildDir)) { Remove-Item -Recurse -Force $buildDir }
& $cmake -S $here -B $buildDir -G Ninja "-DCMAKE_MAKE_PROGRAM=$ninja" "-DCMAKE_BUILD_TYPE=$Config" -DCMAKE_CXX_COMPILER=cl
if ($LASTEXITCODE -ne 0) { throw "La configuración de CMake falló." }
& $cmake --build $buildDir
if ($LASTEXITCODE -ne 0) { throw "La compilación falló." }
if ($NoRun) { exit 0 }

# 4. Ejecutar los vectores.
$exe = Join-Path $buildDir 'chem_golden.exe'
try {
	& $exe (Join-Path $repo 'golden\chemistry.json') $MaxFailures
	$code = $LASTEXITCODE
	# Capa de estado de la campana: golden/steps.json contra Hood.h.
	& (Join-Path $buildDir 'steps_golden.exe') (Join-Path $repo 'golden\steps.json') $MaxFailures
	if ($code -eq 0) { $code = $LASTEXITCODE }
} catch {
	# Un ejecutable recién compilado y sin firmar puede quedar bloqueado por el Control inteligente de
	# aplicaciones de Windows («Control de aplicaciones», «Device Guard»). No es un fallo de compilación.
	Write-Host ''
	Write-Host "La compilación terminó bien, pero Windows no dejó ejecutar $exe"
	Write-Host "  $($_.Exception.Message)"
	Write-Host 'Los vectores de referencia NO se han ejecutado.'
	exit 3
}
exit $code
