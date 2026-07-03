# 2. [Status presentation](2-status-presentation.test.ts)

The view layer formats connection, sandbox, and tool-input state into the
labels, colors, and symbols both frontends render, and hands components the
agent controller through React context.

## 2.1 presenting the connection status

### 2.1.1 suffixes the provider label with transient connection states

### 2.1.2 colors and symbolizes each connection state

## 2.2 presenting the sandbox status

### 2.2.1 labels every sandbox state

### 2.2.2 colors the sandbox by health

## 2.3 previewing tool input

### 2.3.1 shows strings as-is and serializes objects

### 2.3.2 truncates long previews with an ellipsis

### 2.3.3 falls back to a plain string for unserializable input

## 2.4 exposing the agent controller to components

### 2.4.1 returns the controller provided by the frontend root

### 2.4.2 refuses to render outside a controller provider
