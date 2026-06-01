import { registerSharedScenarios } from "../sharedStories";
import { webHarness } from "./harness";

await registerSharedScenarios(webHarness);
