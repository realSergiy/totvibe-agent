import { atom } from "jotai";
import {
  DEFAULT_PROVIDER,
  findProvider,
  type ConnectionStatus,
  type ProviderInfo,
} from "@totvibe/protocol";

export type { ConnectionStatus };

export const providerNameAtom = atom("");
export const modelIdAtom = atom("");
export const connectionStatusAtom = atom<ConnectionStatus>("checking");
export const connectedProvidersAtom = atom<ReadonlySet<string>>(new Set<string>());
export const noticeAtom = atom("");

export const providerAtom = atom<ProviderInfo>(
  (get) => findProvider(get(providerNameAtom)) ?? DEFAULT_PROVIDER,
);
