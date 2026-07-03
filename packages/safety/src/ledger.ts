import { JsonlLog } from '@totvibe/core';

import type { PolicyDecisionRecord } from './index';

export class AuditLedger {
  private readonly log: JsonlLog;

  constructor(path: string) {
    this.log = new JsonlLog(path);
  }

  flushed() {
    return this.log.flushed();
  }

  record(entry: PolicyDecisionRecord) {
    this.log.append(entry);
  }
}
