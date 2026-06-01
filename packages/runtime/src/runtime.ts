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
import {
  DEFAULT_PROVIDER,
  findProvider,
  PROVIDERS,
  type ServerEvent,
} from "@totvibe/protocol";
import { buildModel, validateApiKey } from "./providers/client";
import type { InitialConfig } from "./config";
import { bunHost, isConnected, type RuntimeHost } from "./host";

export interface AgentRuntime {
  start(): void;
  submit(text: string): void;
  cancel(): void;
  resolveApproval(granted: boolean): void;
  selectProvider(providerName: string, modelId: string): void;
  saveApiKey(providerName: string, apiKey: string): Promise<void>;
  testConnection(providerName: string): Promise<void>;
  subscribe(listener: (event: ServerEvent) => void): () => void;
}

function shortenPath(path: string): string {
  const home = process.env.HOME;
  return home && path.startsWith(home) ? `~${path.slice(home.length)}` : path;
}

function connectedProviderNames(): string[] {
  return PROVIDERS.filter(isConnected).map((provider) => provider.name);
}

export function createRuntime(config: InitialConfig, host: RuntimeHost = bunHost): AgentRuntime {
  const session: Session = createSession(config.sessionId, config.initialMessages);
  const sandbox = new SandboxState(config.cwd);
  const sessionStore = new SessionStore(config.paths.sessionsDir, config.sessionId);
  const auditLedger = new AuditLedger(config.paths.auditPath);
  const eventBus = new EventBus();
  eventBus.subscribe(sessionStore.persist);

  const listeners = new Set<(event: ServerEvent) => void>();
  const emit = (event: ServerEvent): void => {
    for (const listener of listeners) listener(event);
  };

  let abortController: AbortController | null = null;
  let approvalResolver: ((granted: boolean) => void) | null = null;
  let activeProviderName = config.providerName;
  let activeModelId = config.modelId;

  const approve = (request: ApprovalRequest) =>
    new Promise<boolean>((resolve) => {
      approvalResolver = resolve;
      emit({ type: "approval-request", request });
      emit({ type: "agent-status", status: "approval required" });
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

  function doSelectProvider(providerName: string, modelId: string): void {
    activeProviderName = providerName;
    activeModelId = modelId.trim() || (findProvider(providerName)?.defaultModel ?? modelId);
    emit({ type: "provider-changed", providerName: activeProviderName, modelId: activeModelId });
    emit({ type: "provider-dialog", open: false });
    refreshConnection();
  }

  function refreshConnection(): void {
    const provider = findProvider(activeProviderName) ?? DEFAULT_PROVIDER;
    const apiKey = process.env[provider.apiKeyEnv]?.trim();
    if (!apiKey) {
      emit({ type: "connection-status", status: "no-key" });
      return;
    }
    emit({ type: "connection-status", status: "checking" });
    void validateApiKey(provider, apiKey).then((check) => {
      emit({
        type: "connection-status",
        status: check.ok ? "ok" : check.rejected ? "rejected" : "unreachable",
      });
    });
  }

  async function runTurn(
    model: LanguageModel,
    fallbackModel: LanguageModel | undefined,
    text: string,
    signal: AbortSignal,
  ): Promise<void> {
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
        emit({ type: "agent", event });
        eventBus.publish(event);
      }
    } catch (error) {
      if (signal.aborted) {
        emit({ type: "agent", event: { type: "aborted" } });
      } else {
        const message = error instanceof Error ? error.message : String(error);
        emit({ type: "agent", event: { type: "error", error: message } });
      }
    } finally {
      abortController = null;
      try {
        await sessionStore.flushed();
        await auditLedger.flushed();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        emit({ type: "message", role: "tool", text: `could not persist session: ${message}` });
      }
    }
  }

  return {
    start() {
      const configuredProvider = findProvider(config.providerName) ?? DEFAULT_PROVIDER;
      const activeProvider = isConnected(configuredProvider)
        ? configuredProvider
        : (PROVIDERS.find(isConnected) ?? configuredProvider);
      activeProviderName = activeProvider.name;
      activeModelId =
        activeProvider === configuredProvider ? config.modelId : activeProvider.defaultModel;

      emit({
        type: "init",
        session: {
          cwd: shortenPath(config.cwd),
          providerName: activeProviderName,
          modelId: activeModelId,
          isProviderDialogOpen: !isConnected(activeProvider),
        },
      });
      emit({ type: "connected-providers", names: connectedProviderNames() });
      if (config.initialMessages.length > 0) {
        emit({
          type: "message",
          role: "tool",
          text: `resumed session ${config.sessionId} (${String(config.initialMessages.length)} messages)`,
        });
      }
      refreshConnection();
      void probeSandbox(config.sandboxNet, config.sandbox).then((status) => {
        emit({ type: "sandbox-status", status });
      });
    },

    submit(text) {
      const trimmedText = text.trim();
      if (/^\/provider(s)?$/.test(trimmedText)) {
        emit({ type: "provider-dialog", open: true });
        return;
      }
      const grantPath = trimmedText.match(/^\/grant\s+(.+)$/)?.[1]?.trim();
      if (grantPath) {
        sandbox.grantReadWrite(grantPath);
        emit({ type: "message", role: "tool", text: `granted read/write: ${grantPath}` });
        return;
      }
      emit({ type: "message", role: "user", text });
      emit({ type: "streaming", streaming: true });
      emit({ type: "agent-status", status: "thinking…" });
      const provider = findProvider(activeProviderName) ?? DEFAULT_PROVIDER;
      const model = buildModel(provider, activeModelId);
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
      emit({ type: "approval-request", request: null });
      emit({ type: "agent-status", status: "thinking…" });
    },

    selectProvider(providerName, modelId) {
      doSelectProvider(providerName, modelId);
    },

    async saveApiKey(providerName, apiKey) {
      const provider = findProvider(providerName) ?? DEFAULT_PROVIDER;
      emit({ type: "notice", text: `Verifying ${provider.apiKeyEnv}…` });
      const check = await validateApiKey(provider, apiKey);
      if (check.rejected) {
        emit({
          type: "notice",
          text: `${provider.apiKeyEnv} ${check.reason ?? ""}. Check the key and try again.`,
        });
        return;
      }
      await host.saveEnvVars({ [provider.apiKeyEnv]: apiKey });
      emit({
        type: "notice",
        text: check.ok
          ? `Saved ${provider.apiKeyEnv} to .env · key verified`
          : `Saved ${provider.apiKeyEnv} to .env · couldn't verify (${check.reason ?? ""})`,
      });
      emit({ type: "connected-providers", names: connectedProviderNames() });
      doSelectProvider(
        provider.name,
        provider.name === activeProviderName ? activeModelId : provider.defaultModel,
      );
    },

    async testConnection(providerName) {
      const provider = findProvider(providerName) ?? DEFAULT_PROVIDER;
      const apiKey = process.env[provider.apiKeyEnv]?.trim();
      if (!apiKey) {
        emit({ type: "notice", text: `${provider.apiKeyEnv} is not set — press k to add a key.` });
        return;
      }
      emit({ type: "notice", text: `Testing ${provider.label}…` });
      const check = await validateApiKey(provider, apiKey);
      emit({
        type: "notice",
        text: check.ok
          ? `${provider.label}: connection OK`
          : check.rejected
            ? `${provider.label}: key rejected (${check.reason ?? ""})`
            : `${provider.label}: unreachable (${check.reason ?? ""})`,
      });
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
