import { useState } from "react";
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
  const [keyValue, setKeyValue] = useState("");
  const [modelValue, setModelValue] = useState("");

  const highlightedProvider = PROVIDERS[highlightedIndex] ?? DEFAULT_PROVIDER;
  const isConnected = (provider: ProviderInfo) => connectedProviders.has(provider.name);
  const resolveModelId = (provider: ProviderInfo) =>
    provider.name === activeProviderName ? activeModelId : provider.defaultModel;

  const activateProvider = (provider: ProviderInfo) => {
    if (!isConnected(provider)) {
      setNotice(`Add a ${provider.apiKeyEnv} to use ${provider.label}.`);
      return;
    }
    controller.selectProvider(provider.name, modelValue.trim() || resolveModelId(provider));
  };

  const saveApiKey = () => {
    const apiKey = keyValue.trim();
    if (!apiKey) return;
    controller.saveApiKey(highlightedProvider.name, apiKey);
    setKeyValue("");
  };

  return (
    <div className="dialog" style={{ borderColor: theme.brand }}>
      <div style={{ color: theme.brand }}>Connect a provider · switch model</div>

      <div className="provider-list">
        {PROVIDERS.map((provider, providerIndex) => (
          <button
            type="button"
            key={provider.name}
            className={`provider-row${providerIndex === highlightedIndex ? " highlighted" : ""}`}
            style={{ color: providerIndex === highlightedIndex ? theme.text : theme.muted }}
            onClick={() => {
              setHighlightedIndex(providerIndex);
            }}
          >
            {isConnected(provider) ? "●" : "○"} {provider.label} · {resolveModelId(provider)}
          </button>
        ))}
      </div>

      <div style={{ color: isConnected(highlightedProvider) ? theme.ok : theme.warn }}>
        {isConnected(highlightedProvider)
          ? `Connected via ${highlightedProvider.apiKeyEnv}`
          : `Not connected — needs ${highlightedProvider.apiKeyEnv}. ${highlightedProvider.keyHint}`}
      </div>

      <div className="field">
        <span style={{ color: theme.muted }}>API key</span>
        <input
          type="password"
          value={keyValue}
          placeholder={`paste ${highlightedProvider.apiKeyEnv}`}
          onChange={(event) => {
            setKeyValue(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") saveApiKey();
          }}
        />
        <button type="button" onClick={saveApiKey}>
          Save
        </button>
      </div>

      <div className="field">
        <span style={{ color: theme.muted }}>Model</span>
        <input
          value={modelValue}
          placeholder={resolveModelId(highlightedProvider)}
          onChange={(event) => {
            setModelValue(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") activateProvider(highlightedProvider);
          }}
        />
        <button
          type="button"
          onClick={() => {
            activateProvider(highlightedProvider);
          }}
        >
          Use
        </button>
      </div>

      <div className="field">
        <button
          type="button"
          onClick={() => {
            controller.testConnection(highlightedProvider.name);
          }}
        >
          Test
        </button>
        <button
          type="button"
          onClick={() => {
            controller.openKeyPage(highlightedProvider.keyUrl);
            setNotice(`Opening ${highlightedProvider.keyUrl}`);
          }}
        >
          Open key page
        </button>
        {canClose && (
          <button
            type="button"
            onClick={() => {
              setProviderDialogOpen(false);
            }}
          >
            Close
          </button>
        )}
      </div>

      {notice ? <div style={{ color: theme.highlight }}>{notice}</div> : null}
    </div>
  );
}
