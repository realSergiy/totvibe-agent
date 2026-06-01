import type { ClientCommand, ServerEvent } from "@totvibe/protocol";

import { type AgentRuntime, createRuntime, loadInitialConfig } from "@totvibe/runtime";

import index from "./index.html";

export type ServeOptions = {
  port?: number;
  sandbox: boolean;
}

type SocketData = {
  runtime?: AgentRuntime;
  unsubscribe?: () => void;
}

export const startServer = (options: ServeOptions) => {
  const dev = process.env.NODE_ENV !== "production";
  const server = Bun.serve<SocketData>({
    development: dev ? { console: true, hmr: true } : false,
    fetch: (request, srv) => {
      if (new URL(request.url).pathname === "/ws") {
        return srv.upgrade(request, { data: {} })
          ? undefined
          : new Response("websocket upgrade failed", { status: 426 });
      }
      return new Response("not found", { status: 404 });
    },
    port: options.port ?? 3000,
    routes: {
      "/": index,
    },
    websocket: {
      close: (ws) => {
        ws.data.unsubscribe?.();
        ws.data.runtime?.cancel();
      },
      message: (ws, message) => {
        const runtime = ws.data.runtime;
        if (!runtime) return;
        const command = JSON.parse(
          typeof message === "string" ? message : message.toString(),
        ) as ClientCommand;
        switch (command.type) {
          case "approve": {
            runtime.resolveApproval(command.granted);
            break;
          }
          case "cancel": {
            runtime.cancel();
            break;
          }
          case "save-api-key": {
            void runtime.saveApiKey(command.providerName, command.apiKey);
            break;
          }
          case "select-provider": {
            runtime.selectProvider(command.providerName, command.modelId);
            break;
          }
          case "submit": {
            runtime.submit(command.text);
            break;
          }
          case "test-connection": {
            void runtime.testConnection(command.providerName);
            break;
          }
        }
      },
      open: async (ws) => {
        const config = await loadInitialConfig({ sandbox: options.sandbox });
        const runtime = createRuntime(config);
        ws.data.runtime = runtime;
        ws.data.unsubscribe = runtime.subscribe((event: ServerEvent) => {
          ws.send(JSON.stringify(event));
        });
        runtime.start();
      },
    },
  });
  console.log(`totvibe web UI on http://localhost:${String(server.port)}`);
  return server;
};
