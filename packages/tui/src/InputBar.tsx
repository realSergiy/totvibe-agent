import { useRef } from "react";
import type { InputRenderable } from "@opentui/core";

export function InputBar({
  onSubmit,
  disabled,
}: {
  onSubmit: (text: string) => void;
  disabled: boolean;
}) {
  const inputRef = useRef<InputRenderable>(null);
  return (
    <box style={{ border: true, borderStyle: "single", padding: 1 }}>
      <input
        ref={inputRef}
        focused={!disabled}
        placeholder={disabled ? "working… (Esc cancels · Ctrl+C quits)" : "Ask totvibe to do something…"}
        onSubmit={() => {
          if (disabled) return;
          const text = inputRef.current?.value.trim() ?? "";
          if (!text) return;
          if (inputRef.current) inputRef.current.value = "";
          onSubmit(text);
        }}
      />
    </box>
  );
}
