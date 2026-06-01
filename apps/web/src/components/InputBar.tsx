import { useState } from "react";
import { useAtomValue } from "jotai";
import { isStreamingAtom, useController } from "@totvibe/view";

export function InputBar() {
  const isStreaming = useAtomValue(isStreamingAtom);
  const controller = useController();
  const [value, setValue] = useState("");

  return (
    <form
      className="input-bar"
      onSubmit={(event) => {
        event.preventDefault();
        if (isStreaming) return;
        const text = value.trim();
        if (!text) return;
        setValue("");
        controller.submit(text);
      }}
    >
      <input
        autoFocus
        value={value}
        disabled={isStreaming}
        placeholder={isStreaming ? "working… (Esc cancels)" : "Ask totvibe to do something…"}
        onChange={(event) => {
          setValue(event.target.value);
        }}
      />
    </form>
  );
}
