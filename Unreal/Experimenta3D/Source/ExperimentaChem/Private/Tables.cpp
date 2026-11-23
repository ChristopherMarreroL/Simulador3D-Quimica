#include "ExperimentaChem/Chem.h"

#include <cstring>

namespace ExperimentaChem
{
#include "Generated/ChemTables.inc"

	const std::vector<FSpecies>& GetSpecies() { static const std::vector<FSpecies> Table = Generated::BuildSpecies(); return Table; }
	const std::vector<FReagent>& GetReagents() { static const std::vector<FReagent> Table = Generated::BuildReagents(); return Table; }
	const std::vector<FRule>& GetRules() { static const std::vector<FRule> Table = Generated::BuildRules(); return Table; }

	template <typename T>
	static int FindById(const std::vector<T>& Table, std::string_view Id)
	{
		for (size_t Index = 0; Index < Table.size(); ++Index)
		{
			if (Id == Table[Index].Id) { return static_cast<int>(Index); }
		}
		return -1;
	}
	int FindSpecies(std::string_view Id) { return FindById(GetSpecies(), Id); }
	int FindReagent(std::string_view Id) { return FindById(GetReagents(), Id); }
}
