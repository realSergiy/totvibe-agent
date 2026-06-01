import { useRef } from "react";
import { useAtomValue } from "jotai";
import type { InputRenderable } from "@opentui/core";
import { isStreamingAtom } from "../state/session";
import { useController } from "../agent/controllerContext";

export function InputBar() {
  const isStreaming = useAtomValue(isStreamingAtom);
  const controller = useController();
  const inputRef = useRef<InputRenderable>(null);

  return (
    <box style={{ border: true, borderStyle: "single", padding: 1 }}>
      <input
        ref={inputRef}
        focused={!isStreaming}
        placeholder={isStreaming ? "working… (Esc cancels · Ctrl+C quits)" : "Ask totvibe to do something…"}
        onSubmit={() => {
          if (isStreaming) return;
          const text = inputRef.current?.value.trim() ?? "";
          if (!text) return;
          if (inputRef.current) inputRef.current.value = "";
          controller.submit(text);
        }}
      />
    </box>
  );
}
