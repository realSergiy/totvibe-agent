import { atom } from "jotai";
import type { Role } from "@totvibe/protocol";

export type { Role };

export interface DisplayMessage {
  id: string;
  role: Role;
  text: string;
}

export const messagesAtom = atom<DisplayMessage[]>([]);

const messageIdCounterAtom = atom(0);

export const appendMessageAtom = atom(
  null,
  (get, set, message: { role: Role; text: string }) => {
    const id = get(messageIdCounterAtom) + 1;
    set(messageIdCounterAtom, id);
    set(messagesAtom, [...get(messagesAtom), { id: `m${String(id)}`, ...message }]);
  },
);
