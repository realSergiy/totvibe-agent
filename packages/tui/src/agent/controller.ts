import {
  compose,
  createSession,
  EventBus,
  runAgent,
  SessionStore,
  type Session,
} from "@totvibe/core";
import { createBuiltinTools } from "@totvibe/tools";
import { probeSandbox, SandboxState } from "@totvibe/sandbox";
import { AuditLedger, policyGate, type ApprovalRequest } from "@totvibe/safety";
import type { LanguageModel } from "ai";
import type { Store } from "../state/store";
import { appendMessageAtom, applyEventAtom, messagesAtom } from "../state/conversation";
import {
  agentStatusAtom,
  configAtom,
  isStreamingAtom,
  pendingApprovalAtom,
  sandboxStatusAtom,
} from "../state/session";
import {
  connectionStatusAtom,
  modelIdAtom,
  providerAtom,
  providerNameAtom,
} from "../state/providers";
import { isProviderDialogOpenAtom } from "../state/ui";
import {
  DEFAULT_PROVIDER,
  findProvider,
  isConnected,
  PROVIDERS,
  type ProviderInfo,
} from "../providers/registry";
import { buildModel, validateApiKey } from "../providers/client";
import type { InitialConfig } from "../providers/config";
import { saveEnvVars } from "../actions";

export interface AgentController {
  start(): void;
  submit(text: string): void;
  cancel(): void;
  resolveApproval(granted: boolean): void;
  selectProvider(providerName: string, modelId: string): void;
  saveApiKey(provider: ProviderInfo, apiKey: string): Promise<void>;
}

export function createController(config: InitialConfig, store: Store): AgentController {
  const session: Session = createSession(config.sessionId, config.initialMessages);
  const sandbox = new SandboxState(config.cwd);
  const sessionStore = new SessionStore(config.paths.sessionsDir, config.sessionId);
  const auditLedger = new AuditLedger(config.paths.auditPath);
  const eventBus = new EventBus();
  eventBus.subscribe(sessionStore.persist);

  let abortController: AbortController | null = null;
  let approvalResolver: ((granted: boolean) => void) | null = null;

  const approve = (request: ApprovalRequest) =>
    new Promise<boolean>((resolve) => {
      approvalResolver = resolve;
      store.set(pendingApprovalAtom, request);
      store.set(agentStatusAtom, "approval required");
    });

  const middleware = compose(
    policyGate({
      approve,
      mode: config.autoApprove ? "auto" : "default",
      approvalTimeoutMs: config.limits.approvalTimeoutMs,
      onDecision: auditLedger.record,
    }),
  );
  const tools = createBuiltinTools(sandbox, {
    net: config.sandboxNet,
    sandbox: config.sandbox,
  });

  function refreshConnection() {
    const provider = store.get(providerAtom);
    const apiKey = process.env[provider.apiKeyEnv]?.trim();
    if (!apiKey) {
      store.set(connectionStatusAtom, "no-key");
      return;
    }
    store.set(connectionStatusAtom, "checking");
    void validateApiKey(provider, apiKey).then((check) => {
      store.set(
        connectionStatusAtom,
        check.ok ? "ok" : check.rejected ? "rejected" : "unreachable",
      );
    });
  }

  async function runTurn(
    model: LanguageModel,
    fallbackModel: LanguageModel | undefined,
    text: string,
    signal: AbortSignal,
  ) {
    try {
      const events = runAgent(session, text, {
        model,
        fallbackModel,
        system: config.system,
        tools,
        middleware,
        cwd: config.cwd,
        maxSteps: config.limits.maxSteps,
        wallClockMs: config.limits.wallClockMs,
        tokenBudget: config.limits.tokenBudget,
        signal,
      });
      for await (const event of events) {
        store.set(applyEventAtom, event);
        eventBus.publish(event);
      }
    } catch (error) {
      if (signal.aborted) {
        store.set(agentStatusAtom, "aborted");
      } else {
        const message = error instanceof Error ? error.message : String(error);
        store.set(appendMessageAtom, { role: "tool", text: `error: ${message}` });
        store.set(agentStatusAtom, "error");
      }
      store.set(isStreamingAtom, false);
    } finally {
      abortController = null;
      try {
        await sessionStore.flushed();
        await auditLedger.flushed();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        store.set(appendMessageAtom, {
          role: "tool",
          text: `could not persist session: ${message}`,
        });
      }
    }
  }

  store.set(configAtom, config);
  store.set(messagesAtom, []);
  store.set(isStreamingAtom, false);
  store.set(agentStatusAtom, "ready");
  store.set(pendingApprovalAtom, null);
  const configuredProvider = findProvider(config.providerName) ?? DEFAULT_PROVIDER;
  const activeProvider = isConnected(configuredProvider)
    ? configuredProvider
    : (PROVIDERS.find(isConnected) ?? configuredProvider);
  store.set(providerNameAtom, activeProvider.name);
  store.set(
    modelIdAtom,
    activeProvider === configuredProvider ? config.modelId : activeProvider.defaultModel,
  );
  store.set(isProviderDialogOpenAtom, !isConnected(activeProvider));
  if (config.initialMessages.length > 0) {
    store.set(appendMessageAtom, {
      role: "tool",
      text: `resumed session ${config.sessionId} (${String(config.initialMessages.length)} messages)`,
    });
  }

  return {
    start() {
      refreshConnection();
      void probeSandbox(config.sandboxNet, config.sandbox).then((sandboxStatus) => {
        store.set(sandboxStatusAtom, sandboxStatus);
      });
    },

    submit(text) {
      const trimmedText = text.trim();
      if (/^\/provider(s)?$/.test(trimmedText)) {
        store.set(isProviderDialogOpenAtom, true);
        return;
      }
      const grantPath = trimmedText.match(/^\/grant\s+(.+)$/)?.[1]?.trim();
      if (grantPath) {
        sandbox.grantReadWrite(grantPath);
        store.set(appendMessageAtom, {
          role: "tool",
          text: `granted read/write: ${grantPath}`,
        });
        return;
      }
      store.set(appendMessageAtom, { role: "user", text });
      store.set(isStreamingAtom, true);
      store.set(agentStatusAtom, "thinking…");
      const provider = store.get(providerAtom);
      const model = buildModel(provider, store.get(modelIdAtom));
      const fallbackProvider = PROVIDERS.find(
        (entry) => entry.name !== provider.name && isConnected(entry),
      );
      const fallbackModel = fallbackProvider
        ? buildModel(fallbackProvider, fallbackProvider.defaultModel)
        : undefined;
      abortController = new AbortController();
      void runTurn(model, fallbackModel, text, abortController.signal);
    },

    cancel() {
      abortController?.abort();
      abortController = null;
    },

    resolveApproval(granted) {
      approvalResolver?.(granted);
      approvalResolver = null;
      store.set(pendingApprovalAtom, null);
      store.set(agentStatusAtom, "thinking…");
    },

    selectProvider(providerName, modelId) {
      store.set(providerNameAtom, providerName);
      store.set(
        modelIdAtom,
        modelId.trim() || (findProvider(providerName)?.defaultModel ?? modelId),
      );
      store.set(isProviderDialogOpenAtom, false);
      refreshConnection();
    },

    async saveApiKey(provider, apiKey) {
      await saveEnvVars({ [provider.apiKeyEnv]: apiKey });
      refreshConnection();
    },
  };
}
