import type { Role } from '@totvibe/protocol';

import { atom } from 'jotai';

export type DisplayMessage = {
  id: string;
  role: Role;
  text: string;
};

export const messagesAtom = atom<DisplayMessage[]>([]);

const messageIdCounterAtom = atom(0);

type MessageDraft = {
  role: Role;
  text: string;
};

export const appendMessageAtom = atom(undefined, (get, set, message: MessageDraft) => {
  const id = get(messageIdCounterAtom) + 1;
  set(messageIdCounterAtom, id);
  set(messagesAtom, [...get(messagesAtom), { id: `m${String(id)}`, ...message }]);
});

export { type Role } from '@totvibe/protocol';
