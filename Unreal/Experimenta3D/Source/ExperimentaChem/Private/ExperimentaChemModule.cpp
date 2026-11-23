// Único archivo del módulo que incluye cabeceras de Unreal: registra el módulo en el motor.
// native/ExperimentaChem/CMakeLists.txt lo excluye de la compilación fuera de Unreal.
// Hace falta aunque no tenga lógica: IMPLEMENT_MODULE redirige new y delete de esta DLL al asignador del
// motor, y así un std::string o std::vector creado aquí se puede liberar en otro módulo.
#include "Modules/ModuleManager.h"

IMPLEMENT_MODULE(FDefaultModuleImpl, ExperimentaChem);
