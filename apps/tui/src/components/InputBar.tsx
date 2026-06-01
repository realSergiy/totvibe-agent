import type { InputRenderable } from "@opentui/core";

import { isStreamingAtom, useController } from "@totvibe/view";
import { useAtomValue } from "jotai";
import { useRef } from "react";

export const InputBar = () => {
  const isStreaming = useAtomValue(isStreamingAtom);
  const controller = useController();
  const inputRef = useRef<InputRenderable>(null);

  return (
    <box style={{ border: true, borderStyle: "single", padding: 1 }}>
      <input
        focused={!isStreaming}
        onSubmit={() => {
          if (isStreaming) return;
          const text = inputRef.current?.value.trim() ?? "";
          if (!text) return;
          if (inputRef.current) inputRef.current.value = "";
          controller.submit(text);
        }}
        placeholder={isStreaming ? "working… (Esc cancels · Ctrl+C quits)" : "Ask totvibe to do something…"}
        ref={inputRef}
      />
    </box>
  );
};
