using UnrealBuildTool;
using System.Collections.Generic;

public class Experimenta3DEditorTarget : TargetRules
{
	public Experimenta3DEditorTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Editor;
		DefaultBuildSettings = BuildSettingsVersion.V7;
		IncludeOrderVersion = EngineIncludeOrderVersion.Unreal5_8;
		ExtraModuleNames.AddRange(new string[] { "Experimenta3D", "ExperimentaChem" });
	}
}
