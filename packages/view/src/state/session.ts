import type { ApprovalRequest } from "@totvibe/safety";
import type { SandboxStatus } from "@totvibe/sandbox";

import { atom } from "jotai";

export const isStreamingAtom = atom(false);
export const agentStatusAtom = atom("ready");
export const pendingApprovalAtom = atom<ApprovalRequest | null>(null);
export const sandboxStatusAtom = atom<null | SandboxStatus>(null);
export const cwdAtom = atom("");
