# 1. [Agent loop](1-agent-loop.test.ts)

`runAgent` drives the conversation: it streams model turns, executes requested
tool calls between them, falls back to a second model on failure, and enforces
step, token, wall-clock, and cancellation limits.

## 1.1 streaming a plain reply

### 1.1.1 yields the user message, streamed text, and turn end

### 1.1.2 relays reasoning deltas as reasoning events

## 1.2 executing tool calls between turns

### 1.2.1 runs the requested tool and feeds the result into the next turn

### 1.2.2 reports a call to an unknown tool as a tool error

## 1.3 surviving model failures

### 1.3.1 emits an error event when the model fails and no fallback exists

### 1.3.2 retries the turn on the fallback model when the primary fails

### 1.3.3 emits an error event when the fallback model also fails

## 1.4 enforcing limits and cancellation

### 1.4.1 stops with max_steps when the model keeps calling tools

### 1.4.2 stops with token_budget once usage exceeds the budget

### 1.4.3 stops with wall_clock once the deadline passes

### 1.4.4 yields aborted when the signal is already cancelled

### 1.4.5 yields aborted when the stream reports an abort mid-turn
