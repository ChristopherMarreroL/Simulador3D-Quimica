# Compila el módulo ExperimentaChem fuera de Unreal y ejecuta los vectores de referencia.
# Los fuentes son los mismos que compila Unreal: aquí no se copia ni se adapta nada.
cmake_minimum_required(VERSION 3.20)
project(ExperimentaChemNative LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

get_filename_component(REPO_ROOT "${CMAKE_CURRENT_SOURCE_DIR}/../.." ABSOLUTE)
set(CHEM_MODULE "${REPO_ROOT}/Unreal/Experimenta3D/Source/ExperimentaChem")
set(CHEM_GOLDEN_JSON "${REPO_ROOT}/golden/chemistry.json")

# Todos los .cpp de Private, salvo los que incluyen cabeceras del motor (el módulo de Unreal, la prueba
# Automation…): esos solo los puede compilar Unreal.
file(GLOB_RECURSE CHEM_CANDIDATES CONFIGURE_DEPENDS "${CHEM_MODULE}/Private/*.cpp")
set(CHEM_SOURCES "")
foreach(SOURCE IN LISTS CHEM_CANDIDATES)
	file(STRINGS "${SOURCE}" UNREAL_INCLUDES
		REGEX "^[ \t]*#[ \t]*include[ \t]*[\"<](CoreMinimal\\.h|CoreTypes\\.h|Modules/|Misc/|HAL/|UObject/|Containers/|Logging/|Kismet/|Engine/|Tests/|[^\">]*\\.generated\\.h)")
	if(UNREAL_INCLUDES)
		message(STATUS "Solo para Unreal, no se compila aquí: ${SOURCE}")
	else()
		list(APPEND CHEM_SOURCES "${SOURCE}")
	endif()
endforeach()
if(NOT CHEM_SOURCES)
	message(FATAL_ERROR "No hay fuentes en ${CHEM_MODULE}/Private")
endif()

add_library(ExperimentaChem STATIC ${CHEM_SOURCES})
target_include_directories(ExperimentaChem PUBLIC "${CHEM_MODULE}/Public" PRIVATE "${CHEM_MODULE}/Private")

add_executable(chem_golden main.cpp)
target_link_libraries(chem_golden PRIVATE ExperimentaChem)
# Vectores de la capa de estado de la campana (golden/steps.json) contra Hood.h.
add_executable(steps_golden main_steps.cpp)
target_link_libraries(steps_golden PRIVATE ExperimentaChem)

if(MSVC)
	# CMake añade /EHsc (y /GR en versiones antiguas) por defecto. Se quitan: el módulo se compila sin
	# excepciones ni RTTI, y sin /EH un try, catch o throw da C4530, que /WX convierte en error.
	string(REGEX REPLACE "(^| )[/-]EH[a-z-]+" "" CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS}")
	string(REGEX REPLACE "(^| )[/-]GR-?" "" CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS}")
	set(CHEM_COMPILE_OPTIONS
		/W4 /WX /permissive- /fp:precise /GR- /utf-8
		# C4577: «noexcept usado sin modo de control de excepciones». Lo da la propia biblioteca estándar
		# al compilar sin /EH; es el único aviso que hay que silenciar.
		/wd4577)
	target_compile_options(ExperimentaChem PRIVATE ${CHEM_COMPILE_OPTIONS})
	target_compile_options(chem_golden PRIVATE ${CHEM_COMPILE_OPTIONS})
	target_compile_options(steps_golden PRIVATE ${CHEM_COMPILE_OPTIONS})
	target_compile_definitions(ExperimentaChem PRIVATE _HAS_EXCEPTIONS=0)
	target_compile_definitions(chem_golden PRIVATE _HAS_EXCEPTIONS=0)
	target_compile_definitions(steps_golden PRIVATE _HAS_EXCEPTIONS=0)
else()
	set(CHEM_COMPILE_OPTIONS -Wall -Wextra -Wshadow -Werror -fno-exceptions -fno-rtti -ffp-contract=off)
	target_compile_options(ExperimentaChem PRIVATE ${CHEM_COMPILE_OPTIONS})
	target_compile_options(chem_golden PRIVATE ${CHEM_COMPILE_OPTIONS})
	target_compile_options(steps_golden PRIVATE ${CHEM_COMPILE_OPTIONS})
endif()

# `ctest` desde la carpeta de compilación ejecuta los vectores.
enable_testing()
add_test(NAME chem_golden COMMAND chem_golden "${CHEM_GOLDEN_JSON}")
add_test(NAME steps_golden COMMAND steps_golden "${REPO_ROOT}/golden/steps.json")
