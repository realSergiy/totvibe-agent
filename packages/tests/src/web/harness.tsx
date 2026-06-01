import "../fixtures/model-mock";
import { act } from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { applyServerEvent, type AgentController, type Store } from "@totvibe/view";
import { createRuntime } from "@totvibe/runtime";
import { Root } from "@totvibe/web";
import {
  buildConfig,
  CONNECTED_PROVIDER_KEYS,
  isolateProviderEnv,
  stubFetchOk,
} from "../fixtures/config";
import { resetModelReply, setModelReply } from "../fixtures/model-mock";
import type { Scene } from "../sharedStories/harness";

interface RenderOptions {
  connectedProviderKeys?: Record<string, string>;
}

function createInProcessController(store: Store): {
  controller: AgentController;
  start: () => void;
} {
  const runtime = createRuntime(buildConfig());
  runtime.subscribe((event) => {
    applyServerEvent(store, event);
  });
  const controller: AgentController = {
    submit: (text) => {
      runtime.submit(text);
    },
    cancel: () => {
      runtime.cancel();
    },
    resolveApproval: (granted) => {
      runtime.resolveApproval(granted);
    },
    selectProvider: (providerName, modelId) => {
      runtime.selectProvider(providerName, modelId);
    },
    saveApiKey: (providerName, apiKey) => {
      void runtime.saveApiKey(providerName, apiKey);
    },
    testConnection: (providerName) => {
      void runtime.testConnection(providerName);
    },
    openKeyPage: () => undefined,
  };
  return {
    controller,
    start: () => {
      runtime.start();
    },
  };
}

function visibleText(): string {
  const haystack = [document.body.textContent];
  for (const input of Array.from(document.querySelectorAll("input"))) {
    haystack.push(input.placeholder, input.value);
  }
  return haystack.join(" ");
}

async function renderScene(options: RenderOptions): Promise<Scene> {
  const restoreEnv = isolateProviderEnv(options.connectedProviderKeys ?? {});
  const restoreFetch = stubFetchOk();

  await act(async () => {
    render(<Root create={createInProcessController} />);
    await Promise.resolve();
  });

  const flush = () =>
    act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

  const inputBar = (): HTMLInputElement => {
    const input = document.querySelector<HTMLInputElement>(".input-bar input");
    if (!input) throw new Error("input bar is not rendered");
    return input;
  };

  return {
    act: {
      async type(text) {
        fireEvent.change(inputBar(), { target: { value: text } });
        await flush();
      },
      async typeAndSubmit(text) {
        const input = inputBar();
        fireEvent.change(input, { target: { value: text } });
        const form = input.closest("form");
        if (form) fireEvent.submit(form);
        await flush();
      },
    },
    assert: {
      shows(text) {
        if (!visibleText().includes(text)) {
          throw new Error(`expected web UI to show ${JSON.stringify(text)}`);
        }
      },
      hides(text) {
        if (visibleText().includes(text)) {
          throw new Error(`expected web UI to hide ${JSON.stringify(text)}`);
        }
      },
      async eventuallyShows(text) {
        for (let pass = 0; pass < 50; pass += 1) {
          if (visibleText().includes(text)) return;
          await flush();
        }
        if (!visibleText().includes(text)) {
          throw new Error(`expected web UI to eventually show ${JSON.stringify(text)}`);
        }
      },
    },
    dispose() {
      cleanup();
      restoreFetch();
      restoreEnv();
      return Promise.resolve();
    },
  };
}

export const webHarness = {
  unconnected(): Promise<Scene> {
    resetModelReply();
    return renderScene({});
  },
  connected(): Promise<Scene> {
    resetModelReply();
    return renderScene({ connectedProviderKeys: CONNECTED_PROVIDER_KEYS });
  },
  connectedWithReply(reply: string): Promise<Scene> {
    setModelReply(reply);
    return renderScene({ connectedProviderKeys: CONNECTED_PROVIDER_KEYS });
  },
};
