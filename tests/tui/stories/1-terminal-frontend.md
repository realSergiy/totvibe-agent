# 1. [Terminal frontend](1-terminal-frontend.test.ts)

The OpenTUI terminal frontend renders the shared session behavior — provider
connection, slash commands, and model round-trips — on a character frame.

## 1.1 connecting a provider

### 1.1.1 opens the provider dialog when no provider is connected

### 1.1.2 arrowing down moves the highlight to the next provider

### 1.1.3 shows the input prompt when a provider is connected

## 1.2 driving the session with slash commands

### 1.2.1 the /grant command prints a confirmation in the conversation

### 1.2.2 the /provider command opens the provider dialog

## 1.3 talking to the model

### 1.3.1 sends a message and renders the model's streamed reply
