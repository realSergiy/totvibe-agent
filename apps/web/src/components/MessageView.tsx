import { theme, type DisplayMessage, type Role } from "@totvibe/view";

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
    <div className="message">
      <div style={{ color: ROLE_COLOR[message.role] }}>{ROLE_LABEL[message.role]}</div>
      <div className="message-text">{message.text}</div>
    </div>
  );
}
