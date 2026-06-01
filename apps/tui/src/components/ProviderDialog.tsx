import { useRef, useState } from "react";
import { useKeyboard, usePaste } from "@opentui/react";
import { decodePasteBytes, type InputRenderable } from "@opentui/core";
import { useAtomValue, useSetAtom } from "jotai";
import { DEFAULT_PROVIDER, PROVIDERS, type ProviderInfo } from "@totvibe/protocol";
import {
  connectedProvidersAtom,
  connectionStatusAtom,
  isProviderDialogOpenAtom,
  modelIdAtom,
  noticeAtom,
  providerNameAtom,
  theme,
  useController,
} from "@totvibe/view";

type DialogMode = "select" | "key" | "model";

export function ProviderDialog() {
  const controller = useController();
  const activeProviderName = useAtomValue(providerNameAtom);
  const activeModelId = useAtomValue(modelIdAtom);
  const connectionStatus = useAtomValue(connectionStatusAtom);
  const connectedProviders = useAtomValue(connectedProvidersAtom);
  const notice = useAtomValue(noticeAtom);
  const setNotice = useSetAtom(noticeAtom);
  const setProviderDialogOpen = useSetAtom(isProviderDialogOpenAtom);
  const canClose = connectionStatus !== "no-key";

  const initialIndex = Math.max(
    0,
    PROVIDERS.findIndex((provider) => provider.name === activeProviderName),
  );
  const [highlightedIndex, setHighlightedIndex] = useState(initialIndex);
  const [mode, setMode] = useState<DialogMode>("select");
  const keyInputRef = useRef<InputRenderable>(null);
  const modelInputRef = useRef<InputRenderable>(null);

  const highlightedProvider = PROVIDERS[highlightedIndex] ?? DEFAULT_PROVIDER;
  const isConnected = (provider: ProviderInfo) => connectedProviders.has(provider.name);
  const resolveModelId = (provider: ProviderInfo) =>
    provider.name === activeProviderName ? activeModelId : provider.defaultModel;

  const activateProvider = (provider: ProviderInfo, modelId: string) => {
    if (!isConnected(provider)) {
      setNotice(`Add a ${provider.apiKeyEnv} to use ${provider.label}.`);
      setMode("key");
      return;
    }
    controller.selectProvider(provider.name, modelId.trim() || provider.defaultModel);
  };

  const submitApiKey = () => {
    const apiKey = keyInputRef.current?.value.trim() ?? "";
    if (!apiKey) return;
    controller.saveApiKey(highlightedProvider.name, apiKey);
  };

  usePaste((event) => {
    if (mode === "model") return;
    const pasted = decodePasteBytes(event.bytes).replace(/[\r\n]/g, "").trim();
    if (!pasted) return;
    event.preventDefault();
    const keyInput = keyInputRef.current;
    if (keyInput) keyInput.value = `${keyInput.value}${pasted}`;
    if (mode !== "key") setMode("key");
  });

  useKeyboard((key) => {
    if (mode !== "select") {
      if (key.name === "escape") setMode("select");
      return;
    }
    switch (key.name) {
      case "up":
        setHighlightedIndex((current) => (current === 0 ? PROVIDERS.length - 1 : current - 1));
        break;
      case "down":
        setHighlightedIndex((current) => (current === PROVIDERS.length - 1 ? 0 : current + 1));
        break;
      case "k":
        setMode("key");
        break;
      case "m":
        setMode("model");
        break;
      case "t":
        controller.testConnection(highlightedProvider.name);
        break;
      case "o":
        controller.openKeyPage(highlightedProvider.keyUrl);
        setNotice(`Opening ${highlightedProvider.keyUrl}`);
        break;
      case "return":
        activateProvider(highlightedProvider, resolveModelId(highlightedProvider));
        break;
      case "escape":
        if (canClose) setProviderDialogOpen(false);
        break;
    }
  });

  return (
    <box
      style={{
        border: true,
        borderStyle: "rounded",
        borderColor: theme.brand,
        padding: 1,
        flexDirection: "column",
        flexShrink: 0,
        gap: 1,
      }}
    >
      <text fg={theme.brand}>Connect a provider · switch model</text>

      <box style={{ flexDirection: "column", flexShrink: 0 }}>
        {PROVIDERS.map((provider, providerIndex) => (
          <text
            key={provider.name}
            style={{ flexShrink: 0 }}
            fg={providerIndex === highlightedIndex ? theme.text : theme.muted}
          >
            {providerIndex === highlightedIndex ? "▶ " : "  "}
            {isConnected(provider) ? "●" : "○"} {provider.label} · {resolveModelId(provider)}
          </text>
        ))}
      </box>

      <box style={{ flexDirection: "column", flexShrink: 0 }}>
        <text fg={isConnected(highlightedProvider) ? theme.ok : theme.warn}>
          {isConnected(highlightedProvider)
            ? `Connected via ${highlightedProvider.apiKeyEnv}`
            : `Not connected — needs ${highlightedProvider.apiKeyEnv}. ${highlightedProvider.keyHint}`}
        </text>
        {!isConnected(highlightedProvider) && (
          <text fg={theme.muted}>Get a key: {highlightedProvider.keyUrl}</text>
        )}

        <box style={{ flexDirection: "row", gap: 1 }}>
          <text fg={theme.muted}>API key</text>
          <input
            ref={keyInputRef}
            key={`key-${highlightedProvider.name}`}
            focused={mode === "key"}
            placeholder={`paste ${highlightedProvider.apiKeyEnv}, Enter to save`}
            onSubmit={submitApiKey}
          />
        </box>

        <box style={{ flexDirection: "row", gap: 1 }}>
          <text fg={theme.muted}>Model </text>
          <input
            ref={modelInputRef}
            key={`model-${highlightedProvider.name}`}
            value={resolveModelId(highlightedProvider)}
            focused={mode === "model"}
            placeholder="model id, Enter to use"
            onSubmit={() => {
              activateProvider(
                highlightedProvider,
                modelInputRef.current?.value ?? highlightedProvider.defaultModel,
              );
            }}
          />
        </box>
      </box>

      {notice ? <text fg={theme.highlight}>{notice}</text> : null}

      <text fg={theme.muted}>
        [↑↓] provider  [k] paste key  [t] test  [o] open key page  [m] model  [Enter] use
        {canClose ? "  [Esc] close" : ""}
      </text>
    </box>
  );
}
