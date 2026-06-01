import type { LanguageModel } from 'ai';

import { compose, createSession, EventBus, runAgent, type Session, SessionStore } from '@totvibe/core';
import { DEFAULT_PROVIDER, findProvider, PROVIDERS, type ServerEvent } from '@totvibe/protocol';
import { type ApprovalRequest, AuditLedger, policyGate } from '@totvibe/safety';
import { probeSandbox, SandboxState } from '@totvibe/sandbox';
import { createBuiltinTools } from '@totvibe/tools';

import type { InitialConfig } from './config';

import { bunHost, isConnected, type RuntimeHost } from './host';
import { buildModel, validateApiKey } from './providers/client';

export type AgentRuntime = {
  cancel(): void;
  resolveApproval(granted: boolean): void;
  saveApiKey(providerName: string, apiKey: string): Promise<void>;
  selectProvider(providerName: string, modelId: string): void;
  start(): void;
  submit(text: string): void;
  subscribe(listener: (event: ServerEvent) => void): () => void;
  testConnection(providerName: string): Promise<void>;
};

const shortenPath = (path: string) => {
  const home = process.env.HOME;
  return home && path.startsWith(home) ? `~${path.slice(home.length)}` : path;
};

const connectedProviderNames = () => PROVIDERS.filter(isConnected).map(provider => provider.name);

export const createRuntime = (config: InitialConfig, host: RuntimeHost = bunHost) => {
  const session: Session = createSession(config.sessionId, config.initialMessages);
  const sandbox = new SandboxState(config.cwd);
  const sessionStore = new SessionStore(config.paths.sessionsDir, config.sessionId);
  const auditLedger = new AuditLedger(config.paths.auditPath);
  const eventBus = new EventBus();
  eventBus.subscribe(sessionStore.persist);

  const listeners = new Set<(event: ServerEvent) => void>();
  const emit = (event: ServerEvent) => {
    for (const listener of listeners) listener(event);
  };

  let abortController: AbortController | undefined;
  let approvalResolver: ((granted: boolean) => void) | undefined;
  let activeProviderName = config.providerName;
  let activeModelId = config.modelId;

  const approve = (request: ApprovalRequest) =>
    new Promise<boolean>(resolve => {
      approvalResolver = resolve;
      emit({ request, type: 'approval-request' });
      emit({ status: 'approval required', type: 'agent-status' });
    });

  const middleware = compose(
    policyGate({
      approvalTimeoutMs: config.limits.approvalTimeoutMs,
      approve,
      mode: config.autoApprove ? 'auto' : 'default',
      onDecision: auditLedger.record,
    }),
  );
  const tools = createBuiltinTools(sandbox, {
    net: config.sandboxNet,
    sandbox: config.sandbox,
  });

  const doSelectProvider = (providerName: string, modelId: string) => {
    activeProviderName = providerName;
    activeModelId = modelId.trim() || (findProvider(providerName)?.defaultModel ?? modelId);
    emit({ modelId: activeModelId, providerName: activeProviderName, type: 'provider-changed' });
    emit({ open: false, type: 'provider-dialog' });
    refreshConnection();
  };

  const refreshConnection = () => {
    const provider = findProvider(activeProviderName) ?? DEFAULT_PROVIDER;
    const apiKey = process.env[provider.apiKeyEnv]?.trim();
    if (!apiKey) {
      emit({ status: 'no-key', type: 'connection-status' });
      return;
    }
    emit({ status: 'checking', type: 'connection-status' });
    void validateApiKey(provider, apiKey).then(check => {
      emit({
        status: check.ok ? 'ok' : check.rejected ? 'rejected' : 'unreachable',
        type: 'connection-status',
      });
    });
  };

  const runTurn = async (
    model: LanguageModel,
    fallbackModel: LanguageModel | undefined,
    text: string,
    signal: AbortSignal,
  ) => {
    try {
      const events = runAgent(session, text, {
        cwd: config.cwd,
        fallbackModel,
        maxSteps: config.limits.maxSteps,
        middleware,
        model,
        signal,
        system: config.system,
        tokenBudget: config.limits.tokenBudget,
        tools,
        wallClockMs: config.limits.wallClockMs,
      });
      for await (const event of events) {
        emit({ event, type: 'agent' });
        eventBus.publish(event);
      }
    } catch (error) {
      if (signal.aborted) {
        emit({ event: { type: 'aborted' }, type: 'agent' });
      } else {
        const message = error instanceof Error ? error.message : String(error);
        emit({ event: { error: message, type: 'error' }, type: 'agent' });
      }
    } finally {
      abortController = undefined;
      try {
        await sessionStore.flushed();
        await auditLedger.flushed();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        emit({ role: 'tool', text: `could not persist session: ${message}`, type: 'message' });
      }
    }
  };

  return {
    cancel: () => {
      abortController?.abort();
      abortController = undefined;
    },

    resolveApproval: granted => {
      approvalResolver?.(granted);
      approvalResolver = undefined;
      emit({ type: 'approval-request' });
      emit({ status: 'thinking…', type: 'agent-status' });
    },

    saveApiKey: async (providerName, apiKey) => {
      const provider = findProvider(providerName) ?? DEFAULT_PROVIDER;
      emit({ text: `Verifying ${provider.apiKeyEnv}…`, type: 'notice' });
      const check = await validateApiKey(provider, apiKey);
      if (check.rejected) {
        emit({
          text: `${provider.apiKeyEnv} ${check.reason ?? ''}. Check the key and try again.`,
          type: 'notice',
        });
        return;
      }
      await host.saveEnvVars({ [provider.apiKeyEnv]: apiKey });
      emit({
        text: check.ok
          ? `Saved ${provider.apiKeyEnv} to .env · key verified`
          : `Saved ${provider.apiKeyEnv} to .env · couldn't verify (${check.reason ?? ''})`,
        type: 'notice',
      });
      emit({ names: connectedProviderNames(), type: 'connected-providers' });
      doSelectProvider(provider.name, provider.name === activeProviderName ? activeModelId : provider.defaultModel);
    },

    selectProvider: (providerName, modelId) => {
      doSelectProvider(providerName, modelId);
    },

    start: () => {
      const configuredProvider = findProvider(config.providerName) ?? DEFAULT_PROVIDER;
      const activeProvider = isConnected(configuredProvider)
        ? configuredProvider
        : (PROVIDERS.find(isConnected) ?? configuredProvider);
      activeProviderName = activeProvider.name;
      activeModelId = activeProvider === configuredProvider ? config.modelId : activeProvider.defaultModel;

      emit({
        session: {
          cwd: shortenPath(config.cwd),
          isProviderDialogOpen: !isConnected(activeProvider),
          modelId: activeModelId,
          providerName: activeProviderName,
        },
        type: 'init',
      });
      emit({ names: connectedProviderNames(), type: 'connected-providers' });
      if (config.initialMessages.length > 0) {
        emit({
          role: 'tool',
          text: `resumed session ${config.sessionId} (${String(config.initialMessages.length)} messages)`,
          type: 'message',
        });
      }
      refreshConnection();
      void probeSandbox(config.sandboxNet, config.sandbox).then(status => {
        emit({ status, type: 'sandbox-status' });
      });
    },

    submit: text => {
      const trimmedText = text.trim();
      if (/^\/provider(s)?$/.test(trimmedText)) {
        emit({ open: true, type: 'provider-dialog' });
        return;
      }
      const grantPath = /^\/grant\s+(.+)$/.exec(trimmedText)?.[1]?.trim();
      if (grantPath) {
        sandbox.grantReadWrite(grantPath);
        emit({ role: 'tool', text: `granted read/write: ${grantPath}`, type: 'message' });
        return;
      }
      emit({ role: 'user', text, type: 'message' });
      emit({ streaming: true, type: 'streaming' });
      emit({ status: 'thinking…', type: 'agent-status' });
      const provider = findProvider(activeProviderName) ?? DEFAULT_PROVIDER;
      const model = buildModel(provider, activeModelId);
      const fallbackProvider = PROVIDERS.find(entry => entry.name !== provider.name && isConnected(entry));
      const fallbackModel = fallbackProvider ? buildModel(fallbackProvider, fallbackProvider.defaultModel) : undefined;
      abortController = new AbortController();
      void runTurn(model, fallbackModel, text, abortController.signal);
    },

    subscribe: listener => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    testConnection: async providerName => {
      const provider = findProvider(providerName) ?? DEFAULT_PROVIDER;
      const apiKey = process.env[provider.apiKeyEnv]?.trim();
      if (!apiKey) {
        emit({ text: `${provider.apiKeyEnv} is not set — press k to add a key.`, type: 'notice' });
        return;
      }
      emit({ text: `Testing ${provider.label}…`, type: 'notice' });
      const check = await validateApiKey(provider, apiKey);
      emit({
        text: check.ok
          ? `${provider.label}: connection OK`
          : check.rejected
            ? `${provider.label}: key rejected (${check.reason ?? ''})`
            : `${provider.label}: unreachable (${check.reason ?? ''})`,
        type: 'notice',
      });
    },
  } satisfies AgentRuntime;
};
