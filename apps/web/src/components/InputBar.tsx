import { isStreamingAtom, useController } from "@totvibe/view";
import { useAtomValue } from "jotai";
import { useState } from "react";

export const InputBar = () => {
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
        disabled={isStreaming}
        onChange={(event) => {
          setValue(event.target.value);
        }}
        placeholder={isStreaming ? "working… (Esc cancels)" : "Ask totvibe to do something…"}
        value={value}
      />
    </form>
  );
};
