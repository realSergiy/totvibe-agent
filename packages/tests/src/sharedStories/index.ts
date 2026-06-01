import { Glob } from "bun";
import type { Harness } from "./harness";

type ScenarioModule = { default: (harness: Harness) => void };

const scenarioFiles = new Glob("*.ts");
const NON_SCENARIO_FILES = new Set(["index.ts", "harness.ts"]);

export async function registerSharedScenarios(harness: Harness): Promise<void> {
  const directory = import.meta.dir;
  const files = [...scenarioFiles.scanSync(directory)]
    .filter((file) => !NON_SCENARIO_FILES.has(file))
    .sort();
  for (const file of files) {
    const scenario = (await import(`${directory}/${file}`)) as ScenarioModule;
    scenario.default(harness);
  }
}
