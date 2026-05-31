import { useRef, useState } from "react";
import { useKeyboard, usePaste } from "@opentui/react";
import { decodePasteBytes, type InputRenderable } from "@opentui/core";
import { useAtomValue, useSetAtom } from "jotai";
import { connectionStatusAtom, modelIdAtom, providerNameAtom } from "../state/providers";
import { isProviderDialogOpenAtom } from "../state/ui";
import { isConnected, PROVIDERS, type ProviderInfo } from "../providers/registry";
import { validateApiKey } from "../providers/client";
import { getController } from "../agent/controller";
import { openKeyPage } from "../actions";
import { theme } from "../theme";

type DialogMode = "select" | "key" | "model";

export function ProviderDialog() {
  const controller = getController();
  const activeProviderName = useAtomValue(providerNameAtom);
  const activeModelId = useAtomValue(modelIdAtom);
  const connectionStatus = useAtomValue(connectionStatusAtom);
  const setProviderDialogOpen = useSetAtom(isProviderDialogOpenAtom);
  const canClose = connectionStatus !== "no-key";

  const initialIndex = Math.max(
    0,
    PROVIDERS.findIndex((provider) => provider.name === activeProviderName),
  );
  const [highlightedIndex, setHighlightedIndex] = useState(initialIndex);
  const [mode, setMode] = useState<DialogMode>("select");
  const [notice, setNotice] = useState("");
  const keyInputRef = useRef<InputRenderable>(null);
  const modelInputRef = useRef<InputRenderable>(null);

  const highlightedProvider = PROVIDERS[highlightedIndex]!;
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

  const submitApiKey = async () => {
    const apiKey = keyInputRef.current?.value.trim() ?? "";
    if (!apiKey) return;
    setNotice(`Verifying ${highlightedProvider.apiKeyEnv}…`);
    const check = await validateApiKey(highlightedProvider, apiKey);
    if (check.rejected) {
      setNotice(`${highlightedProvider.apiKeyEnv} ${check.reason}. Check the key and try again.`);
      return;
    }
    if (keyInputRef.current) keyInputRef.current.value = "";
    await controller.saveApiKey(highlightedProvider, apiKey);
    setNotice(
      check.ok
        ? `Saved ${highlightedProvider.apiKeyEnv} to .env · key verified`
        : `Saved ${highlightedProvider.apiKeyEnv} to .env · couldn't verify (${check.reason})`,
    );
    setMode("select");
    controller.selectProvider(highlightedProvider.name, resolveModelId(highlightedProvider));
  };

  const testConnection = async (provider: ProviderInfo) => {
    const apiKey = process.env[provider.apiKeyEnv]?.trim();
    if (!apiKey) {
      setNotice(`${provider.apiKeyEnv} is not set — press k to add a key.`);
      return;
    }
    setNotice(`Testing ${provider.label}…`);
    const check = await validateApiKey(provider, apiKey);
    setNotice(
      check.ok
        ? `${provider.label}: connection OK`
        : check.rejected
          ? `${provider.label}: key rejected (${check.reason})`
          : `${provider.label}: unreachable (${check.reason})`,
    );
  };

  usePaste((event) => {
    if (mode === "model") return;
    const pasted = decodePasteBytes(event.bytes).replace(/[\r\n]/g, "").trim();
    if (!pasted) return;
    event.preventDefault();
    const keyInput = keyInputRef.current;
    if (keyInput) keyInput.value = `${keyInput.value ?? ""}${pasted}`;
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
        void testConnection(highlightedProvider);
        break;
      case "o":
        openKeyPage(highlightedProvider.keyUrl);
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
            onSubmit={() => {
              void submitApiKey();
            }}
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
