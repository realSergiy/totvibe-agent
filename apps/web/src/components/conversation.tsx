import { messagesAtom } from '@totvibe/view';
import { useAtomValue } from 'jotai';

import { Banner } from './banner';
import { MessageView } from './message-view';

export const Conversation = () => {
  const messages = useAtomValue(messagesAtom);
  return (
    <div className="conversation">
      {messages.length === 0 && <Banner />}
      {messages.map(message => (
        <MessageView key={message.id} message={message} />
      ))}
    </div>
  );
};
