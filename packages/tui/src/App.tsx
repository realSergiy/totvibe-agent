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
  type InitialConfig,
  type ProviderInfo,
} from "./config";
import { saveEnvVars } from "./actions";
import { formatInput, initialState, reducer } from "./state";
import { StatusBar } from "./StatusBar";
import { Conversation } from "./Conversation";
import { InputBar } from "./InputBar";
import { ProviderDialog } from "./ProviderDialog";

export function App({ config }: { config: InitialConfig }) {
  const renderer = useRenderer();
  const [state, dispatch] = useReducer(reducer, initialState);
  const sessionRef = useRef<Session>(createSession());
  const resolveApprovalRef = useRef<((granted: boolean) => void) | null>(null);

  const [providerName, setProviderName] = useState(config.providerName);
  const [modelId, setModelId] = useState(config.modelId);
  const [revision, setRevision] = useState(0);

  const provider = findProvider(providerName) as ProviderInfo;
  const connected = isConnected(provider);
  const [dialogOpen, setDialogOpen] = useState(!connected);

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
    void probeSandbox(config.sandboxNet).then(setSandboxStatus);
  }, [config.sandboxNet]);

  const tools = useMemo(() => {
    const middleware = compose(approvalGate({ approve, autoApprove: config.autoApprove }));
    const builtinTools = createBuiltinTools(sandboxRef.current, { net: config.sandboxNet });
    return toModelTools(builtinTools, { cwd: config.cwd }, middleware);
  }, [approve, config.autoApprove, config.cwd, config.sandboxNet]);

  const onSubmit = useCallback(
    async (text: string) => {
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
    if (key.name === "p" && key.ctrl) {
      setDialogOpen(true);
      return;
    }
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
        connected={connected}
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
