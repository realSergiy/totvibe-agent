import type { Harness } from './harness';

import registerInputCommandScenarios from './input-commands';
import registerModelRoundtripScenarios from './model-roundtrip';
import registerProviderConnectionScenarios from './provider-connection';

export const registerSharedScenarios = (harness: Harness) => {
  const registrars = [
    registerInputCommandScenarios,
    registerModelRoundtripScenarios,
    registerProviderConnectionScenarios,
  ];
  for (const register of registrars) register(harness);
};
