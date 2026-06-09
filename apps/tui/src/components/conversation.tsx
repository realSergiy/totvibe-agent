import { messagesAtom } from '@totvibe/view';
import { useAtomValue } from 'jotai';

import { Banner } from './banner';
import { MessageView } from './message-view';

export const Conversation = () => {
  const messages = useAtomValue(messagesAtom);
  return (
    <scrollbox
      stickyScroll
      stickyStart="bottom"
      style={{ border: true, borderStyle: 'rounded', flexGrow: 1, gap: 1, padding: 1 }}
    >
      {messages.length === 0 && <Banner />}
      {messages.map(message => (
        <MessageView key={message.id} message={message} />
      ))}
    </scrollbox>
  );
};
