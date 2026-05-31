import { JsonlLog } from "@totvibe/core";
import type { PolicyDecisionRecord } from "./index";

export class AuditLedger {
  private readonly log: JsonlLog;

  constructor(path: string) {
    this.log = new JsonlLog(path);
  }

  readonly record = (entry: PolicyDecisionRecord): void => {
    this.log.append(entry);
  };

  flushed(): Promise<void> {
    return this.log.flushed();
  }
}
