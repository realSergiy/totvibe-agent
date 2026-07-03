# 1. [Web frontend](1-web-frontend.test.ts)

The browser frontend renders the same shared session behavior as the terminal —
provider connection, slash commands, and model round-trips — in a DOM.

## 1.1 connecting a provider

### 1.1.1 opens the provider dialog when no provider is connected

### 1.1.2 shows the input prompt when a provider is connected

## 1.2 driving the session with slash commands

### 1.2.1 the /grant command prints a confirmation in the conversation

### 1.2.2 the /provider command opens the provider dialog

## 1.3 talking to the model

### 1.3.1 sends a message and renders the model's streamed reply
