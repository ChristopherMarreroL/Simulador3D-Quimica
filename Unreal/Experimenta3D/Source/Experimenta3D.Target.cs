using UnrealBuildTool;
using System.Collections.Generic;

public class Experimenta3DTarget : TargetRules
{
	public Experimenta3DTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Game;
		DefaultBuildSettings = BuildSettingsVersion.V7;
		IncludeOrderVersion = EngineIncludeOrderVersion.Unreal5_8;
		ExtraModuleNames.AddRange(new string[] { "Experimenta3D", "ExperimentaChem" });
	}
}
