import { useKeyboard, useRenderer } from '@opentui/react';
import { isProviderDialogOpenAtom, isStreamingAtom, pendingApprovalAtom, useController } from '@totvibe/view';
import { useAtomValue, useStore } from 'jotai';

import { ApprovalPrompt } from './components/approval-prompt';
import { Conversation } from './components/conversation';
import { InputBar } from './components/input-bar';
import { ProviderDialog } from './components/provider-dialog';
import { StatusBar } from './components/status-bar';

export const App = () => {
  const renderer = useRenderer();
  const controller = useController();
  const store = useStore();
  const isProviderDialogOpen = useAtomValue(isProviderDialogOpenAtom);

  useKeyboard(key => {
    if (key.name === 'c' && key.ctrl) {
      renderer.destroy();
      return;
    }
    if (store.get(isProviderDialogOpenAtom) || store.get(pendingApprovalAtom)) return;
    if (key.name === 'escape' && store.get(isStreamingAtom)) controller.cancel();
  });

  return (
    <box style={{ flexDirection: 'column', flexGrow: 1 }}>
      <StatusBar />
      <Conversation />
      <ApprovalPrompt />
      {isProviderDialogOpen ? <ProviderDialog /> : <InputBar />}
    </box>
  );
};
