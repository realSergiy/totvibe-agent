# 1. [Agent runtime](1-agent-runtime.test.ts)

`createRuntime` hosts one agent session behind the `ServerEvent` stream: it
announces session state, interprets slash commands, runs model turns with
approval-gated tools, and manages provider keys through the host.

## 1.1 starting a session

### 1.1.1 announces the session, connected providers, and connection status

### 1.1.2 opens the provider dialog when no provider is connected

### 1.1.3 falls over to the first connected provider when the configured one has no key

### 1.1.4 announces a resumed session and reports the sandbox state

## 1.2 steering the session with slash commands

### 1.2.1 /provider opens the provider dialog

### 1.2.2 /grant widens the sandbox and confirms it in the conversation

## 1.3 running a model turn

### 1.3.1 streams the reply and toggles the streaming flag

## 1.4 approving mutating tool calls

### 1.4.1 asks for approval and runs the tool once granted

### 1.4.2 replaces the tool output with denial feedback when refused

### 1.4.3 skips approval entirely in auto-approve mode

### 1.4.4 ignores a stray approval when nothing is pending

## 1.5 managing providers and keys

### 1.5.1 selecting a provider falls back to its default model

### 1.5.2 saves a verified key through the host and connects the provider

### 1.5.3 refuses to save a rejected key

### 1.5.4 saves an unverifiable key with a caveat

### 1.5.5 reports connection tests for missing, valid, rejected, and unreachable keys

### 1.5.6 builds an OpenAI-compatible model for a provider

### 1.5.7 keeps an unknown provider selection but checks the default provider key

## 1.6 persisting keys to the .env file

### 1.6.1 rewrites existing entries and appends new ones

### 1.6.2 creates the .env file when none exists
