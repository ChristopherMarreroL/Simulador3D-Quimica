using UnrealBuildTool;

public class Experimenta3D : ModuleRules
{
	public Experimenta3D(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

		PublicDependencyModuleNames.AddRange(new string[] { "Core", "CoreUObject", "Engine", "InputCore", "EnhancedInput", "ProceduralMeshComponent", "UMG", "Slate", "SlateCore" });

		// Lectura de art/export/perfiles_interiores.json en la prueba Experimenta.Liquido.Geometria.
		PrivateDependencyModuleNames.AddRange(new string[] { "Json" });

		// Motor químico en C++ estándar (sin tipos de Unreal). La prueba Experimenta.Chem.Golden lo ejecuta.
		PrivateDependencyModuleNames.AddRange(new string[] { "ExperimentaChem" });
	}
}
