# 3. [Events and persistence](3-events-and-persistence.test.ts)

Core's plumbing carries the agent's history: the event bus fans events out to
subscribers, the jsonl log serializes appends, and the session store persists
model messages so a session can resume later.

## 3.1 broadcasting agent events

### 3.1.1 delivers events to every subscriber until it unsubscribes

## 3.2 appending records to a jsonl log

### 3.2.1 appends records in order and reads them back through a schema

### 3.2.2 reads an absent log as an empty history

## 3.3 persisting and resuming sessions

### 3.3.1 persists only message events and loads them back

### 3.3.2 finds the most recently modified session id

### 3.3.3 creates sessions with a fresh id and empty history by default
