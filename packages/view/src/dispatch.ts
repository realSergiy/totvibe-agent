import type { AgentEvent } from "@totvibe/core";
import type { ServerEvent } from "@totvibe/protocol";

import type { Store } from "./state/store";

import { formatToolInput } from "./format";
import { appendMessageAtom, messagesAtom } from "./state/conversation";
import {
  connectedProvidersAtom,
  connectionStatusAtom,
  modelIdAtom,
  noticeAtom,
  providerNameAtom,
} from "./state/providers";
import {
  agentStatusAtom,
  cwdAtom,
  isStreamingAtom,
  pendingApprovalAtom,
  sandboxStatusAtom,
} from "./state/session";
import { isProviderDialogOpenAtom } from "./state/ui";

const applyAgentEvent = (store: Store, event: AgentEvent) => {
  switch (event.type) {
    case "aborted": {
      store.set(isStreamingAtom, false);
      store.set(agentStatusAtom, "aborted");
      break;
    }
    case "error": {
      store.set(appendMessageAtom, { role: "tool", text: `error: ${event.error}` });
      store.set(isStreamingAtom, false);
      store.set(agentStatusAtom, "error");
      break;
    }
    case "message":
    case "reasoning":
    case "tool_result":
    case "turn_start": {
      break;
    }
    case "text": {
      const messages = store.get(messagesAtom);
      const last = messages.at(-1);
      if (last?.role === "assistant") {
        store.set(messagesAtom, [
          ...messages.slice(0, -1),
          { ...last, text: last.text + event.text },
        ]);
      } else {
        store.set(appendMessageAtom, { role: "assistant", text: event.text });
      }
      break;
    }
    case "tool_call": {
      store.set(appendMessageAtom, {
        role: "tool",
        text: `⏺ ${event.name} ${formatToolInput(event.input)}`,
      });
      break;
    }
    case "tool_error": {
      store.set(appendMessageAtom, { role: "tool", text: `✗ ${event.name}: ${event.error}` });
      break;
    }
    case "turn_end": {
      store.set(isStreamingAtom, false);
      store.set(agentStatusAtom, `ready · ${event.finishReason}`);
      break;
    }
  }
};

export const applyServerEvent = (store: Store, event: ServerEvent) => {
  switch (event.type) {
    case "agent": {
      applyAgentEvent(store, event.event);
      break;
    }
    case "agent-status": {
      store.set(agentStatusAtom, event.status);
      break;
    }
    case "approval-request": {
      store.set(pendingApprovalAtom, event.request);
      break;
    }
    case "connected-providers": {
      store.set(connectedProvidersAtom, new Set(event.names));
      break;
    }
    case "connection-status": {
      store.set(connectionStatusAtom, event.status);
      break;
    }
    case "init": {
      store.set(messagesAtom, []);
      store.set(isStreamingAtom, false);
      store.set(agentStatusAtom, "ready");
      store.set(pendingApprovalAtom, null);
      store.set(noticeAtom, "");
      store.set(cwdAtom, event.session.cwd);
      store.set(providerNameAtom, event.session.providerName);
      store.set(modelIdAtom, event.session.modelId);
      store.set(isProviderDialogOpenAtom, event.session.isProviderDialogOpen);
      break;
    }
    case "message": {
      store.set(appendMessageAtom, { role: event.role, text: event.text });
      break;
    }
    case "notice": {
      store.set(noticeAtom, event.text);
      break;
    }
    case "provider-changed": {
      store.set(providerNameAtom, event.providerName);
      store.set(modelIdAtom, event.modelId);
      break;
    }
    case "provider-dialog": {
      store.set(isProviderDialogOpenAtom, event.open);
      break;
    }
    case "sandbox-status": {
      store.set(sandboxStatusAtom, event.status);
      break;
    }
    case "streaming": {
      store.set(isStreamingAtom, event.streaming);
      break;
    }
  }
};
