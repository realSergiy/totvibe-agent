import type { SandboxStatus } from '@totvibe/sandbox';

import { renderHook } from '@testing-library/react';
import { type AgentController, ControllerContext, useController } from '@totvibe/view';
import { createStore } from 'jotai';
import { createElement, type ReactNode } from 'react';

export { DEFAULT_PROVIDER, type SessionInfo } from '@totvibe/protocol';
export {
  type AgentController,
  agentStatusAtom,
  applyServerEvent,
  connectedProvidersAtom,
  connectionStatusAtom,
  cwdAtom,
  formatConnectionSuffix,
  formatSandboxLabel,
  formatToolInput,
  messagesAtom,
  modelIdAtom,
  noticeAtom,
  pendingApprovalAtom,
  pickConnectionColor,
  pickConnectionSymbol,
  pickSandboxColor,
  providerAtom,
  providerDialogOpenAtom,
  providerNameAtom,
  sandboxStatusAtom,
  streamingAtom,
  theme,
} from '@totvibe/view';

export const makeStore = () => createStore();

export const makeSandboxStatus = (overrides: Partial<SandboxStatus> = {}): SandboxStatus => ({
  available: true,
  degraded: false,
  enabled: true,
  hasLandlock: true,
  net: 'none',
  ...overrides,
});

export const stubController: AgentController = {
  cancel: () => void 0,
  openKeyPage: () => void 0,
  resolveApproval: () => void 0,
  saveApiKey: () => void 0,
  selectProvider: () => void 0,
  submit: () => void 0,
  testConnection: () => void 0,
};

type WrapperProps = {
  children: ReactNode;
};

export const renderUseController = (controller?: AgentController) =>
  renderHook(() => useController(), {
    wrapper: controller
      ? ({ children }: WrapperProps) => createElement(ControllerContext, { value: controller }, children)
      : undefined,
  });
