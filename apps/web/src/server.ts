import { createRuntime, loadInitialConfig, type AgentRuntime } from "@totvibe/runtime";
import type { ClientCommand, ServerEvent } from "@totvibe/protocol";
import index from "./index.html";

export interface ServeOptions {
  sandbox: boolean;
  port?: number;
}

interface SocketData {
  runtime?: AgentRuntime;
  unsubscribe?: () => void;
}

export function startServer(options: ServeOptions) {
  const dev = process.env.NODE_ENV !== "production";
  const server = Bun.serve<SocketData>({
    port: options.port ?? 3000,
    development: dev ? { hmr: true, console: true } : false,
    routes: {
      "/": index,
    },
    fetch(request, srv) {
      if (new URL(request.url).pathname === "/ws") {
        return srv.upgrade(request, { data: {} })
          ? undefined
          : new Response("websocket upgrade failed", { status: 426 });
      }
      return new Response("not found", { status: 404 });
    },
    websocket: {
      async open(ws) {
        const config = await loadInitialConfig({ sandbox: options.sandbox });
        const runtime = createRuntime(config);
        ws.data.runtime = runtime;
        ws.data.unsubscribe = runtime.subscribe((event: ServerEvent) => {
          ws.send(JSON.stringify(event));
        });
        runtime.start();
      },
      message(ws, message) {
        const runtime = ws.data.runtime;
        if (!runtime) return;
        const command = JSON.parse(
          typeof message === "string" ? message : message.toString(),
        ) as ClientCommand;
        switch (command.type) {
          case "submit":
            runtime.submit(command.text);
            break;
          case "cancel":
            runtime.cancel();
            break;
          case "approve":
            runtime.resolveApproval(command.granted);
            break;
          case "select-provider":
            runtime.selectProvider(command.providerName, command.modelId);
            break;
          case "save-api-key":
            void runtime.saveApiKey(command.providerName, command.apiKey);
            break;
          case "test-connection":
            void runtime.testConnection(command.providerName);
            break;
        }
      },
      close(ws) {
        ws.data.unsubscribe?.();
        ws.data.runtime?.cancel();
      },
    },
  });
  console.log(`totvibe web UI on http://localhost:${String(server.port)}`);
  return server;
}
