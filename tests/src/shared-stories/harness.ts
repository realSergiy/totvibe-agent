export type Harness = {
  connected(): Promise<Scene>;
  connectedWithReply(reply: string): Promise<Scene>;
  unconnected(): Promise<Scene>;
};

export type Scene = {
  act: Act;
  assert: Assert;
  dispose(): Promise<void>;
};

type Act = {
  type(text: string): Promise<void>;
  typeAndSubmit(text: string): Promise<void>;
};

type Assert = {
  eventuallyShows(text: string): Promise<void>;
  hides(text: string): void;
  shows(text: string): void;
};
