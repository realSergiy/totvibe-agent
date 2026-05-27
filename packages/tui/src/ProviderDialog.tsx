import { useRef, useState } from "react";
import { useKeyboard, usePaste } from "@opentui/react";
import { decodePasteBytes, type InputRenderable } from "@opentui/core";
import { isConnected, validateApiKey, type ProviderInfo } from "./config";
import { openKeyPage } from "./actions";

type Mode = "select" | "key" | "model";

export function ProviderDialog({
  providers,
  activeProviderName,
  activeModelId,
  canClose,
  onActivate,
  onSaveKey,
  onClose,
}: {
  providers: ProviderInfo[];
  activeProviderName: string;
  activeModelId: string;
  canClose: boolean;
  onActivate: (providerName: string, modelId: string) => void;
  onSaveKey: (provider: ProviderInfo, apiKey: string) => Promise<void>;
  onClose: () => void;
}) {
  const initialIndex = Math.max(
    0,
    providers.findIndex((provider) => provider.name === activeProviderName),
  );
  const [index, setIndex] = useState(initialIndex);
  const [mode, setMode] = useState<Mode>("select");
  const [notice, setNotice] = useState("");
  const keyInputRef = useRef<InputRenderable>(null);
  const modelInputRef = useRef<InputRenderable>(null);

  const highlighted = providers[index]!;
  const modelFor = (provider: ProviderInfo) =>
    provider.name === activeProviderName ? activeModelId : provider.defaultModel;

  const activate = (provider: ProviderInfo, modelId: string) => {
    if (!isConnected(provider)) {
      setNotice(`Add a ${provider.apiKeyEnv} to use ${provider.label}.`);
      setMode("key");
      return;
    }
    onActivate(provider.name, modelId.trim() || provider.defaultModel);
  };

  const submitKey = async () => {
    const apiKey = keyInputRef.current?.value.trim() ?? "";
    if (!apiKey) return;
    setNotice(`Verifying ${highlighted.apiKeyEnv}…`);
    const check = await validateApiKey(highlighted, apiKey);
    if (check.rejected) {
      setNotice(`${highlighted.apiKeyEnv} ${check.reason}. Check the key and try again.`);
      return;
    }
    if (keyInputRef.current) keyInputRef.current.value = "";
    await onSaveKey(highlighted, apiKey);
    setNotice(
      check.ok
        ? `Saved ${highlighted.apiKeyEnv} to .env · key verified`
        : `Saved ${highlighted.apiKeyEnv} to .env · couldn't verify (${check.reason})`,
    );
    setMode("select");
    onActivate(highlighted.name, modelFor(highlighted));
  };

  const testConnection = async (target: ProviderInfo) => {
    const apiKey = process.env[target.apiKeyEnv]?.trim();
    if (!apiKey) {
      setNotice(`${target.apiKeyEnv} is not set — press k to add a key.`);
      return;
    }
    setNotice(`Testing ${target.label}…`);
    const check = await validateApiKey(target, apiKey);
    setNotice(
      check.ok
        ? `${target.label}: connection OK`
        : check.rejected
          ? `${target.label}: key rejected (${check.reason})`
          : `${target.label}: unreachable (${check.reason})`,
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
        setIndex((current) => (current === 0 ? providers.length - 1 : current - 1));
        break;
      case "down":
        setIndex((current) => (current === providers.length - 1 ? 0 : current + 1));
        break;
      case "k":
        setMode("key");
        break;
      case "m":
        setMode("model");
        break;
      case "t":
        void testConnection(highlighted);
        break;
      case "o":
        openKeyPage(highlighted.keyUrl);
        setNotice(`Opening ${highlighted.keyUrl}`);
        break;
      case "return":
        activate(highlighted, modelFor(highlighted));
        break;
      case "escape":
        if (canClose) onClose();
        break;
    }
  });

  return (
    <box
      style={{
        border: true,
        borderStyle: "rounded",
        borderColor: "#7dcfff",
        padding: 1,
        flexDirection: "column",
        flexShrink: 0,
        gap: 1,
      }}
    >
      <text fg="#7dcfff">Connect a provider · switch model</text>

      <box style={{ flexDirection: "column", flexShrink: 0 }}>
        {providers.map((provider, providerIndex) => (
          <text
            key={provider.name}
            style={{ flexShrink: 0 }}
            fg={providerIndex === index ? "#c0caf5" : "#565f89"}
          >
            {providerIndex === index ? "▶ " : "  "}
            {isConnected(provider) ? "●" : "○"} {provider.label} · {modelFor(provider)}
          </text>
        ))}
      </box>

      <box style={{ flexDirection: "column", flexShrink: 0 }}>
        <text fg={isConnected(highlighted) ? "#9ece6a" : "#e0af68"}>
          {isConnected(highlighted)
            ? `Connected via ${highlighted.apiKeyEnv}`
            : `Not connected — needs ${highlighted.apiKeyEnv}. ${highlighted.keyHint}`}
        </text>
        {!isConnected(highlighted) && <text fg="#565f89">Get a key: {highlighted.keyUrl}</text>}

        <box style={{ flexDirection: "row", gap: 1 }}>
          <text fg="#565f89">API key</text>
          <input
            ref={keyInputRef}
            key={`key-${highlighted.name}`}
            focused={mode === "key"}
            placeholder={`paste ${highlighted.apiKeyEnv}, Enter to save`}
            onSubmit={() => {
              void submitKey();
            }}
          />
        </box>

        <box style={{ flexDirection: "row", gap: 1 }}>
          <text fg="#565f89">Model </text>
          <input
            ref={modelInputRef}
            key={`model-${highlighted.name}`}
            value={modelFor(highlighted)}
            focused={mode === "model"}
            placeholder="model id, Enter to use"
            onSubmit={() => {
              activate(highlighted, modelInputRef.current?.value ?? highlighted.defaultModel);
            }}
          />
        </box>
      </box>

      {notice ? <text fg="#bb9af7">{notice}</text> : null}

      <text fg="#565f89">
        [↑↓] provider  [k] paste key  [t] test  [o] open key page  [m] model  [Enter] use
        {canClose ? "  [Esc] close" : ""}
      </text>
    </box>
  );
}
