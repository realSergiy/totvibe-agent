import { type DisplayMessage, type Role, theme } from '@totvibe/view';

const ROLE_COLOR: Record<Role, string> = {
  assistant: theme.assistant,
  tool: theme.tool,
  user: theme.user,
};

const ROLE_LABEL: Record<Role, string> = {
  assistant: 'totvibe',
  tool: 'tool',
  user: 'you',
};

type MessageViewProps = {
  message: DisplayMessage;
};

export const MessageView = ({ message }: MessageViewProps) => (
  <div className="message">
    <div style={{ color: ROLE_COLOR[message.role] }}>{ROLE_LABEL[message.role]}</div>
    <div className="message-text">{message.text}</div>
  </div>
);
