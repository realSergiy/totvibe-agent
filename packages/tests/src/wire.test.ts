import { expect, test } from "bun:test";
import type { ClientCommand, ServerEvent } from "@totvibe/protocol";

function roundTrip<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

test("client commands survive a JSON wire round-trip", () => {
  const commands: ClientCommand[] = [
    { type: "submit", text: "ping" },
    { type: "cancel" },
    { type: "approve", granted: true },
    { type: "select-provider", providerName: "qwen", modelId: "qwen3.7-max" },
    { type: "save-api-key", providerName: "qwen", apiKey: "secret" },
    { type: "test-connection", providerName: "qwen" },
  ];
  for (const command of commands) {
    expect(roundTrip(command)).toEqual(command);
  }
});

test("server events survive a JSON wire round-trip", () => {
  const events: ServerEvent[] = [
    {
      type: "init",
      session: { cwd: "~/project", providerName: "qwen", modelId: "qwen3.7-max", isProviderDialogOpen: false },
    },
    { type: "connected-providers", names: ["qwen", "deepseek"] },
    { type: "agent", event: { type: "text", text: "hello" } },
    { type: "approval-request", request: null },
    { type: "agent-status", status: "thinking…" },
    { type: "streaming", streaming: true },
    { type: "connection-status", status: "ok" },
    { type: "provider-changed", providerName: "qwen", modelId: "qwen3.7-max" },
    { type: "provider-dialog", open: true },
    { type: "notice", text: "Saved DASHSCOPE_API_KEY to .env" },
    { type: "message", role: "tool", text: "granted read/write: /tmp/demo" },
  ];
  for (const event of events) {
    expect(roundTrip(event)).toEqual(event);
  }
});
