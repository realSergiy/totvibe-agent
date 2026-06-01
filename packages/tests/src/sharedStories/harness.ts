interface Assert {
  shows(text: string): void;
  hides(text: string): void;
  eventuallyShows(text: string): Promise<void>;
}

interface Act {
  type(text: string): Promise<void>;
  typeAndSubmit(text: string): Promise<void>;
}

export interface Scene {
  act: Act;
  assert: Assert;
  dispose(): Promise<void>;
}

export interface Harness {
  unconnected(): Promise<Scene>;
  connected(): Promise<Scene>;
  connectedWithReply(reply: string): Promise<Scene>;
}
