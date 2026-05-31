import type { DisplayMessage, Role } from "../state/conversation";
import { theme } from "../theme";

const ROLE_COLOR: Record<Role, string> = {
  user: theme.user,
  assistant: theme.assistant,
  tool: theme.tool,
};

const ROLE_LABEL: Record<Role, string> = {
  user: "you",
  assistant: "totvibe",
  tool: "tool",
};

export function MessageView({ message }: { message: DisplayMessage }) {
  return (
    <box style={{ flexDirection: "column" }}>
      <text fg={ROLE_COLOR[message.role]}>{ROLE_LABEL[message.role]}</text>
      <text>{message.text}</text>
    </box>
  );
}
