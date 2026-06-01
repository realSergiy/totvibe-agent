import {
  type ConnectionStatus,
  DEFAULT_PROVIDER,
  findProvider,
  type ProviderInfo,
} from "@totvibe/protocol";
import { atom } from "jotai";



export const providerNameAtom = atom("");
export const modelIdAtom = atom("");
export const connectionStatusAtom = atom<ConnectionStatus>("checking");
export const connectedProvidersAtom = atom<ReadonlySet<string>>(new Set<string>());
export const noticeAtom = atom("");

export const providerAtom = atom<ProviderInfo>(
  (get) => findProvider(get(providerNameAtom)) ?? DEFAULT_PROVIDER,
);

export {type ConnectionStatus} from "@totvibe/protocol";