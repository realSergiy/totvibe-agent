import { atom } from "jotai";
import { DEFAULT_PROVIDER, findProvider, type ProviderInfo } from "../providers/registry";

export type ConnectionStatus = "no-key" | "checking" | "ok" | "rejected" | "unreachable";

export const providerNameAtom = atom("");
export const modelIdAtom = atom("");
export const connectionStatusAtom = atom<ConnectionStatus>("checking");

export const providerAtom = atom<ProviderInfo>(
  (get) => findProvider(get(providerNameAtom)) ?? DEFAULT_PROVIDER,
);
