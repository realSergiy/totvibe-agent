# 1. [Server event dispatch](1-server-event-dispatch.test.ts)

`applyServerEvent` is the only way frontends ingest runtime state: every
`ServerEvent` maps onto the jotai atoms that the TUI and web components render.

## 1.1 rendering agent events into the conversation

### 1.1.1 streams assistant text into one growing message

### 1.1.2 records a tool call with a preview of its input

### 1.1.3 records a tool error against the tool name

### 1.1.4 ends the turn by stopping the stream and reporting the finish reason

### 1.1.5 surfaces aborts and errors in the status line

### 1.1.6 leaves the conversation untouched for bookkeeping events

## 1.2 tracking the session lifecycle

### 1.2.1 init resets the conversation and seeds the session fields

### 1.2.2 appends role-tagged messages with unique ids

### 1.2.3 tracks notices, streaming, status, approvals, and the sandbox

## 1.3 tracking providers and connections

### 1.3.1 switches the active provider and model

### 1.3.2 falls back to the default provider for an unknown name

### 1.3.3 tracks the connected provider set, connection status, and dialog
