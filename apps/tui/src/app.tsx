import { useKeyboard, useRenderer } from '@opentui/react';
import { pendingApprovalAtom, providerDialogOpenAtom, streamingAtom, useController } from '@totvibe/view';
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
  const isProviderDialogOpen = useAtomValue(providerDialogOpenAtom);

  useKeyboard(key => {
    if (key.name === 'c' && key.ctrl) {
      renderer.destroy();
      return;
    }
    if (store.get(providerDialogOpenAtom) || store.get(pendingApprovalAtom)) return;
    if (key.name === 'escape' && store.get(streamingAtom)) controller.cancel();
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
