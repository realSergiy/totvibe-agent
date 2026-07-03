import type { ApprovalRequest } from '@totvibe/safety';
import type { SandboxStatus } from '@totvibe/sandbox';

import { atom } from 'jotai';

export const streamingAtom = atom(false);
export const agentStatusAtom = atom('ready');
export const pendingApprovalAtom = atom<ApprovalRequest | undefined>();
export const sandboxStatusAtom = atom<SandboxStatus | undefined>();
export const cwdAtom = atom('');
