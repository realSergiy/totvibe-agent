import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useKeyboard, useRenderer } from "@opentui/react";
import { compose, createSession, runAgent, toModelTools, type Session } from "@totvibe/core";
import { createBuiltinTools } from "@totvibe/tools";
import { probeSandbox, SandboxState, type SandboxStatus } from "@totvibe/sandbox";
import { approvalGate, type ApprovalRequest } from "@totvibe/safety";
import {
  buildModel,
  findProvider,
  isConnected,
  PROVIDERS,
  validateApiKey,
  type InitialConfig,
  type ProviderInfo,
} from "./config";
import { saveEnvVars } from "./actions";
import { formatInput, initialState, reducer } from "./state";
import { StatusBar, type ConnectionStatus } from "./StatusBar";
import { Conversation } from "./Conversation";
import { InputBar } from "./InputBar";
import { ProviderDialog } from "./ProviderDialog";

export function App({ config }: { config: InitialConfig }) {
  const renderer = useRenderer();
  const [state, dispatch] = useReducer(reducer, initialState);
  const sessionRef = useRef<Session>(createSession());
  const resolveApprovalRef = useRef<((granted: boolean) => void) | null>(null);

  const configuredProvider = findProvider(config.providerName) as ProviderInfo;
  const initialProvider = isConnected(configuredProvider)
    ? configuredProvider
    : (PROVIDERS.find(isConnected) ?? configuredProvider);

  const [providerName, setProviderName] = useState(initialProvider.name);
  const [modelId, setModelId] = useState(
    initialProvider === configuredProvider ? config.modelId : initialProvider.defaultModel,
  );
  const [revision, setRevision] = useState(0);

  const provider = findProvider(providerName) as ProviderInfo;
  const connected = isConnected(provider);
  const [dialogOpen, setDialogOpen] = useState(!connected);
  const [connection, setConnection] = useState<ConnectionStatus>(
    connected ? "checking" : "no-key",
  );

  useEffect(() => {
    const apiKey = process.env[provider.apiKeyEnv]?.trim();
    if (!apiKey) {
      setConnection("no-key");
      return;
    }
    let cancelled = false;
    setConnection("checking");
    void validateApiKey(provider, apiKey).then((check) => {
      if (cancelled) return;
      setConnection(check.ok ? "ok" : check.rejected ? "rejected" : "unreachable");
    });
    return () => {
      cancelled = true;
    };
  }, [providerName, provider.apiKeyEnv, revision]);

  const model = useMemo(
    () => buildModel(provider, modelId),
    [providerName, modelId, revision],
  );

  const approve = useCallback(
    (request: ApprovalRequest) =>
      new Promise<boolean>((resolve) => {
        resolveApprovalRef.current = resolve;
        dispatch({ type: "approval_request", request });
      }),
    [],
  );

  const sandboxRef = useRef<SandboxState>(new SandboxState(config.cwd));
  const [sandboxStatus, setSandboxStatus] = useState<SandboxStatus | null>(null);

  useEffect(() => {
    void probeSandbox(config.sandboxNet, config.sandbox).then(setSandboxStatus);
  }, [config.sandboxNet, config.sandbox]);

  const tools = useMemo(() => {
    const middleware = compose(approvalGate({ approve, autoApprove: config.autoApprove }));
    const builtinTools = createBuiltinTools(sandboxRef.current, {
      net: config.sandboxNet,
      sandbox: config.sandbox,
    });
    return toModelTools(builtinTools, { cwd: config.cwd }, middleware);
  }, [approve, config.autoApprove, config.cwd, config.sandboxNet, config.sandbox]);

  const onSubmit = useCallback(
    async (text: string) => {
      if (/^\/provider(s)?\s*$/.test(text.trim())) {
        setDialogOpen(true);
        return;
      }

      const grant = text.match(/^\/grant\s+(.+)$/);
      if (grant) {
        const path = grant[1]!.trim();
        sandboxRef.current.grantReadWrite(path);
        dispatch({ type: "notice", text: `granted read/write: ${path}` });
        return;
      }

      dispatch({ type: "user_message", text });
      const events = runAgent(sessionRef.current, text, {
        model,
        system: config.system,
        tools,
      });
      for await (const event of events) {
        dispatch({ type: "agent_event", event });
      }
    },
    [model, config.system, tools],
  );

  const activateProvider = (nextProvider: string, nextModel: string) => {
    setProviderName(nextProvider);
    setModelId(nextModel);
    setRevision((current) => current + 1);
    setDialogOpen(false);
  };

  const saveKey = async (target: ProviderInfo, apiKey: string) => {
    await saveEnvVars({ [target.apiKeyEnv]: apiKey });
    setRevision((current) => current + 1);
  };

  const resolveApproval = (granted: boolean) => {
    resolveApprovalRef.current?.(granted);
    resolveApprovalRef.current = null;
    dispatch({ type: "approval_resolved" });
  };

  useKeyboard((key) => {
    if (key.name === "c" && key.ctrl) {
      renderer.destroy();
      process.exit(0);
    }
    if (dialogOpen) return;
    if (resolveApprovalRef.current) {
      if (key.name === "y") resolveApproval(true);
      else if (key.name === "n" || key.name === "escape") resolveApproval(false);
    }
  });

  return (
    <box style={{ flexDirection: "column", flexGrow: 1 }}>
      <StatusBar
        provider={provider}
        modelId={modelId}
        connection={connection}
        cwd={config.cwd}
        status={state.status}
        sandbox={sandboxStatus}
      />
      <Conversation messages={state.messages} />
      {state.pendingApproval && (
        <box
          style={{
            border: true,
            borderStyle: "rounded",
            borderColor: "#e0af68",
            padding: 1,
            flexDirection: "column",
          }}
        >
          <text fg="#e0af68">
            Approve {state.pendingApproval.name}?  [y] run   [n] skip
          </text>
          <text fg="#565f89">{formatInput(state.pendingApproval.input)}</text>
        </box>
      )}
      {dialogOpen ? (
        <ProviderDialog
          providers={PROVIDERS}
          activeProviderName={providerName}
          activeModelId={modelId}
          canClose={connected}
          onActivate={activateProvider}
          onSaveKey={saveKey}
          onClose={() => setDialogOpen(false)}
        />
      ) : (
        <InputBar onSubmit={onSubmit} disabled={state.streaming} />
      )}
    </box>
  );
}
