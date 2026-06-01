import { useAtomValue } from "jotai";
import { messagesAtom } from "@totvibe/view";
import { Banner } from "./Banner";
import { MessageView } from "./MessageView";

export function Conversation() {
  const messages = useAtomValue(messagesAtom);
  return (
    <div className="conversation">
      {messages.length === 0 && <Banner />}
      {messages.map((message) => (
        <MessageView key={message.id} message={message} />
      ))}
    </div>
  );
}
