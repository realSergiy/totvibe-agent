import { atom } from "jotai";
import type { ApprovalRequest } from "@totvibe/safety";
import type { SandboxStatus } from "@totvibe/sandbox";
import type { InitialConfig } from "../providers/config";

export const isStreamingAtom = atom(false);
export const agentStatusAtom = atom("ready");
export const pendingApprovalAtom = atom<ApprovalRequest | null>(null);
export const sandboxStatusAtom = atom<SandboxStatus | null>(null);
export const configAtom = atom<InitialConfig | null>(null);
