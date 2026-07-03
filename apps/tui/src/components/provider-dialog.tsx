import { decodePasteBytes, type InputRenderable } from '@opentui/core';
import { useKeyboard, usePaste } from '@opentui/react';
import { DEFAULT_PROVIDER, type ProviderInfo, PROVIDERS } from '@totvibe/protocol';
import {
  connectedProvidersAtom,
  connectionStatusAtom,
  modelIdAtom,
  noticeAtom,
  providerDialogOpenAtom,
  providerNameAtom,
  theme,
  useController,
} from '@totvibe/view';
import { useAtomValue, useSetAtom } from 'jotai';
import { useRef, useState } from 'react';

type DialogMode = 'key' | 'model' | 'select';

export const ProviderDialog = () => {
  const controller = useController();
  const activeProviderName = useAtomValue(providerNameAtom);
  const activeModelId = useAtomValue(modelIdAtom);
  const connectionStatus = useAtomValue(connectionStatusAtom);
  const connectedProviders = useAtomValue(connectedProvidersAtom);
  const notice = useAtomValue(noticeAtom);
  const setNotice = useSetAtom(noticeAtom);
  const setProviderDialogOpen = useSetAtom(providerDialogOpenAtom);
  const canClose = connectionStatus !== 'no-key';

  const initialIndex = Math.max(
    0,
    PROVIDERS.findIndex(provider => provider.name === activeProviderName),
  );
  const [highlightedIndex, setHighlightedIndex] = useState(initialIndex);
  const [mode, setMode] = useState<DialogMode>('select');
  const keyInputRef = useRef<InputRenderable>(null);
  const modelInputRef = useRef<InputRenderable>(null);

  const highlightedProvider = PROVIDERS[highlightedIndex] ?? DEFAULT_PROVIDER;
  const isConnected = ({ name }: ProviderInfo) => connectedProviders.has(name);
  const resolveModelId = ({ defaultModel, name }: ProviderInfo) =>
    name === activeProviderName ? activeModelId : defaultModel;

  const activateProvider = (provider: ProviderInfo, modelId: string) => {
    if (!isConnected(provider)) {
      setNotice(`Add a ${provider.apiKeyEnv} to use ${provider.label}.`);
      setMode('key');
      return;
    }
    controller.selectProvider(provider.name, modelId.trim() || provider.defaultModel);
  };

  const submitApiKey = () => {
    const apiKey = keyInputRef.current?.value.trim() ?? '';
    if (!apiKey) return;
    controller.saveApiKey(highlightedProvider.name, apiKey);
  };

  usePaste(event => {
    if (mode === 'model') return;
    const pasted = decodePasteBytes(event.bytes)
      .replaceAll(/[\r\n]/g, '')
      .trim();
    if (!pasted) return;
    event.preventDefault();
    const keyInput = keyInputRef.current;
    if (keyInput) keyInput.value = `${keyInput.value}${pasted}`;
    if (mode !== 'key') setMode('key');
  });

  useKeyboard(key => {
    if (mode !== 'select') {
      if (key.name === 'escape') setMode('select');
      return;
    }
    switch (key.name) {
      case 'down': {
        setHighlightedIndex(current => (current === PROVIDERS.length - 1 ? 0 : current + 1));
        break;
      }
      case 'escape': {
        if (canClose) setProviderDialogOpen(false);
        break;
      }
      case 'k': {
        setMode('key');
        break;
      }
      case 'm': {
        setMode('model');
        break;
      }
      case 'o': {
        controller.openKeyPage(highlightedProvider.keyUrl);
        setNotice(`Opening ${highlightedProvider.keyUrl}`);
        break;
      }
      case 'return': {
        activateProvider(highlightedProvider, resolveModelId(highlightedProvider));
        break;
      }
      case 't': {
        controller.testConnection(highlightedProvider.name);
        break;
      }
      case 'up': {
        setHighlightedIndex(current => (current === 0 ? PROVIDERS.length : current) - 1);
        break;
      }
    }
  });

  return (
    <box
      style={{
        border: true,
        borderColor: theme.brand,
        borderStyle: 'rounded',
        flexDirection: 'column',
        flexShrink: 0,
        gap: 1,
        padding: 1,
      }}
    >
      <text fg={theme.brand}>Connect a provider · switch model</text>

      <box style={{ flexDirection: 'column', flexShrink: 0 }}>
        {PROVIDERS.map((provider, providerIndex) => (
          <text
            fg={providerIndex === highlightedIndex ? theme.text : theme.muted}
            key={provider.name}
            style={{ flexShrink: 0 }}
          >
            {providerIndex === highlightedIndex ? '▶ ' : '  '}
            {isConnected(provider) ? '●' : '○'} {provider.label} · {resolveModelId(provider)}
          </text>
        ))}
      </box>

      <box style={{ flexDirection: 'column', flexShrink: 0 }}>
        <text fg={isConnected(highlightedProvider) ? theme.ok : theme.warn}>
          {isConnected(highlightedProvider)
            ? `Connected via ${highlightedProvider.apiKeyEnv}`
            : `Not connected — needs ${highlightedProvider.apiKeyEnv}. ${highlightedProvider.keyHint}`}
        </text>
        {!isConnected(highlightedProvider) && <text fg={theme.muted}>Get a key: {highlightedProvider.keyUrl}</text>}

        <box style={{ flexDirection: 'row', gap: 1 }}>
          <text fg={theme.muted}>API key</text>
          <input
            focused={mode === 'key'}
            key={`key-${highlightedProvider.name}`}
            onSubmit={submitApiKey}
            placeholder={`paste ${highlightedProvider.apiKeyEnv}, Enter to save`}
            ref={keyInputRef}
          />
        </box>

        <box style={{ flexDirection: 'row', gap: 1 }}>
          <text fg={theme.muted}>Model </text>
          <input
            focused={mode === 'model'}
            key={`model-${highlightedProvider.name}`}
            onSubmit={() => {
              activateProvider(highlightedProvider, modelInputRef.current?.value ?? highlightedProvider.defaultModel);
            }}
            placeholder="model id, Enter to use"
            ref={modelInputRef}
            value={resolveModelId(highlightedProvider)}
          />
        </box>
      </box>

      {notice ? <text fg={theme.highlight}>{notice}</text> : undefined}

      <text fg={theme.muted}>
        [↑↓] provider [k] paste key [t] test [o] open key page [m] model [Enter] use
        {canClose ? '  [Esc] close' : ''}
      </text>
    </box>
  );
};
