import { useAtomValue } from "jotai";
import { messagesAtom } from "@totvibe/view";
import { Banner } from "./Banner";
import { MessageView } from "./MessageView";

export function Conversation() {
  const messages = useAtomValue(messagesAtom);
  return (
    <scrollbox
      style={{ flexGrow: 1, border: true, borderStyle: "rounded", padding: 1, gap: 1 }}
      stickyScroll
      stickyStart="bottom"
    >
      {messages.length === 0 && <Banner />}
      {messages.map((message) => (
        <MessageView key={message.id} message={message} />
      ))}
    </scrollbox>
  );
}
