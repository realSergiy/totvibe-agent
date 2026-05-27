import type { DisplayMessage, Role } from "./state";

const ROLE_COLOR: Record<Role, string> = {
  user: "#7aa2f7",
  assistant: "#9ece6a",
  tool: "#e0af68",
};

const ROLE_LABEL: Record<Role, string> = {
  user: "you",
  assistant: "totvibe",
  tool: "tool",
};

export function Conversation({ messages }: { messages: DisplayMessage[] }) {
  return (
    <scrollbox
      style={{ flexGrow: 1, border: true, borderStyle: "rounded", padding: 1, gap: 1 }}
      stickyScroll
      stickyStart="bottom"
    >
      {messages.map((message) => (
        <box key={message.id} style={{ flexDirection: "column" }}>
          <text fg={ROLE_COLOR[message.role]}>{ROLE_LABEL[message.role]}</text>
          <text>{message.text}</text>
        </box>
      ))}
    </scrollbox>
  );
}
