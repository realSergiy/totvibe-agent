import { pendingApprovalAtom, providerDialogOpenAtom, streamingAtom, useController } from '@totvibe/view';
import { useAtomValue, useStore } from 'jotai';
import { useEffect } from 'react';

import { ApprovalPrompt } from './components/approval-prompt';
import { Conversation } from './components/conversation';
import { InputBar } from './components/input-bar';
import { ProviderDialog } from './components/provider-dialog';
import { StatusBar } from './components/status-bar';

export const App = () => {
  const controller = useController();
  const store = useStore();
  const isProviderDialogOpen = useAtomValue(providerDialogOpenAtom);

  useEffect(() => {
    const onKeydown = ({ key }: KeyboardEvent) => {
      if (store.get(providerDialogOpenAtom) || store.get(pendingApprovalAtom)) return;
      if (key === 'Escape' && store.get(streamingAtom)) controller.cancel();
    };
    globalThis.addEventListener('keydown', onKeydown);
    return () => {
      globalThis.removeEventListener('keydown', onKeydown);
    };
  }, [store, controller]);

  return (
    <div className="app">
      <StatusBar />
      <Conversation />
      <ApprovalPrompt />
      {isProviderDialogOpen ? <ProviderDialog /> : <InputBar />}
    </div>
  );
};
