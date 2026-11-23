using UnrealBuildTool;

// Motor químico: C++ estándar, sin tipos de Unreal. Los mismos fuentes se compilan fuera del motor en
// native/ExperimentaChem. Solo Private/ExperimentaChemModule.cpp incluye cabeceras de Unreal.
public class ExperimentaChem : ModuleRules
{
	public ExperimentaChem(ReadOnlyTargetRules Target) : base(Target)
	{
		// Coma flotante estricta (/fp:precise con MSVC, -ffp-contract=off con clang). Con BuildSettingsVersion.V7
		// los destinos Editor y Program ya son precisos por defecto, pero Game, Client y Server usan /fp:fast:
		// se fija aquí para que el módulo dé lo mismo en todos los destinos (ver golden/README.md).
		FPSemantics = FPSemanticsMode.Precise;

		// Cada .cpp se compila solo, sin PCH compartido ni archivos unity: así los fuentes estándar no reciben
		// ninguna cabecera de Unreal y se compilan igual que fuera del motor.
		PCHUsage = PCHUsageMode.NoPCHs;
		bUseUnity = false;

		bUseRTTI = false;
		// No pide excepciones. En los destinos Editor UnrealBuildTool las activa de todos modos (/EHsc) para
		// todos los módulos; en Game las desactiva (_HAS_EXCEPTIONS=0). El código no usa ninguna.
		bEnableExceptions = false;

		// Solo para ExperimentaChemModule.cpp (IMPLEMENT_MODULE).
		PrivateDependencyModuleNames.AddRange(new string[] { "Core" });

		// UnrealBuildTool define EXPERIMENTACHEM_API como DLLEXPORT, y DLLEXPORT lo definen las cabeceras de
		// plataforma de Core, que los fuentes estándar no incluyen. Se define aquí con el mismo texto que
		// Core/Public/Windows/WindowsPlatform.h (una redefinición idéntica no da aviso). Para otra plataforma
		// hay que añadir su equivalente (__attribute__((visibility("default"))) en Unix, Apple y Android).
		if (Target.Platform.IsInGroup(UnrealPlatformGroup.Microsoft))
		{
			PrivateDefinitions.Add("DLLEXPORT=__declspec(dllexport)");
		}
	}
}
