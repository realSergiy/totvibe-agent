import { atom } from "jotai";
import { findProvider, type ProviderInfo } from "../providers/registry";

export type ConnectionStatus = "no-key" | "checking" | "ok" | "rejected" | "unreachable";

export const providerNameAtom = atom("");
export const modelIdAtom = atom("");
export const connectionStatusAtom = atom<ConnectionStatus>("checking");

export const providerAtom = atom<ProviderInfo>((get) => findProvider(get(providerNameAtom))!);
