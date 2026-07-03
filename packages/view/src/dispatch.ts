import type { AgentEvent } from '@totvibe/core';
import type { ServerEvent } from '@totvibe/protocol';

import type { Store } from './state/store';

import { formatToolInput } from './format';
import { appendMessageAtom, messagesAtom } from './state/conversation';
import {
  connectedProvidersAtom,
  connectionStatusAtom,
  modelIdAtom,
  noticeAtom,
  providerNameAtom,
} from './state/providers';
import { agentStatusAtom, cwdAtom, pendingApprovalAtom, sandboxStatusAtom, streamingAtom } from './state/session';
import { providerDialogOpenAtom } from './state/ui';

type AgentEventOf<T extends AgentEvent['type']> = Extract<AgentEvent, { type: T }>;
type ServerEventOf<T extends ServerEvent['type']> = Extract<ServerEvent, { type: T }>;

const applyAgentError = (store: Store, { error }: AgentEventOf<'error'>) => {
  store.set(appendMessageAtom, { role: 'tool', text: `error: ${error}` });
  store.set(streamingAtom, false);
  store.set(agentStatusAtom, 'error');
};

const appendAssistantText = (store: Store, { text }: AgentEventOf<'text'>) => {
  const messages = store.get(messagesAtom);
  const last = messages.at(-1);
  if (last?.role === 'assistant') {
    store.set(messagesAtom, [...messages.slice(0, -1), { ...last, text: last.text + text }]);
  } else {
    store.set(appendMessageAtom, { role: 'assistant', text });
  }
};

const appendToolCall = (store: Store, { input, name }: AgentEventOf<'tool_call'>) => {
  store.set(appendMessageAtom, {
    role: 'tool',
    text: `⏺ ${name} ${formatToolInput(input)}`,
  });
};

const appendToolError = (store: Store, { error, name }: AgentEventOf<'tool_error'>) => {
  store.set(appendMessageAtom, { role: 'tool', text: `✗ ${name}: ${error}` });
};

const applyTurnEnd = (store: Store, { finishReason }: AgentEventOf<'turn_end'>) => {
  store.set(streamingAtom, false);
  store.set(agentStatusAtom, `ready · ${finishReason}`);
};

const applyAgentEvent = (store: Store, event: AgentEvent) => {
  switch (event.type) {
    case 'aborted': {
      store.set(streamingAtom, false);
      store.set(agentStatusAtom, 'aborted');
      break;
    }
    case 'error': {
      applyAgentError(store, event);
      break;
    }
    case 'message':
    case 'reasoning':
    case 'tool_result':
    case 'turn_start': {
      break;
    }
    case 'text': {
      appendAssistantText(store, event);
      break;
    }
    case 'tool_call': {
      appendToolCall(store, event);
      break;
    }
    case 'tool_error': {
      appendToolError(store, event);
      break;
    }
    case 'turn_end': {
      applyTurnEnd(store, event);
      break;
    }
  }
};

const applyInit = (store: Store, { session }: ServerEventOf<'init'>) => {
  store.set(messagesAtom, []);
  store.set(streamingAtom, false);
  store.set(agentStatusAtom, 'ready');
  store.set(pendingApprovalAtom, undefined);
  store.set(noticeAtom, '');
  store.set(cwdAtom, session.cwd);
  store.set(providerNameAtom, session.providerName);
  store.set(modelIdAtom, session.modelId);
  store.set(providerDialogOpenAtom, session.isProviderDialogOpen);
};

const applyProviderChanged = (store: Store, { modelId, providerName }: ServerEventOf<'provider-changed'>) => {
  store.set(providerNameAtom, providerName);
  store.set(modelIdAtom, modelId);
};

export const applyServerEvent = (store: Store, serverEvent: ServerEvent) => {
  switch (serverEvent.type) {
    case 'agent': {
      applyAgentEvent(store, serverEvent.event);
      break;
    }
    case 'agent-status': {
      store.set(agentStatusAtom, serverEvent.status);
      break;
    }
    case 'approval-request': {
      store.set(pendingApprovalAtom, serverEvent.request);
      break;
    }
    case 'connected-providers': {
      store.set(connectedProvidersAtom, new Set(serverEvent.names));
      break;
    }
    case 'connection-status': {
      store.set(connectionStatusAtom, serverEvent.status);
      break;
    }
    case 'init': {
      applyInit(store, serverEvent);
      break;
    }
    case 'message': {
      store.set(appendMessageAtom, { role: serverEvent.role, text: serverEvent.text });
      break;
    }
    case 'notice': {
      store.set(noticeAtom, serverEvent.text);
      break;
    }
    case 'provider-changed': {
      applyProviderChanged(store, serverEvent);
      break;
    }
    case 'provider-dialog': {
      store.set(providerDialogOpenAtom, serverEvent.open);
      break;
    }
    case 'sandbox-status': {
      store.set(sandboxStatusAtom, serverEvent.status);
      break;
    }
    case 'streaming': {
      store.set(streamingAtom, serverEvent.streaming);
      break;
    }
  }
};
