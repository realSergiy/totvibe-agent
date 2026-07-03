# 1. [Wire protocol](1-wire-protocol.test.ts)

`ClientCommand` and `ServerEvent` are the single seam between frontends and the
agent runtime: every shape must survive JSON transport and validate against its
zod schema, and the provider registry backing them must stay consistent.

## 1.1 client commands on the wire

### 1.1.1 every client command survives a JSON wire round-trip

### 1.1.2 the client command schema accepts every command shape

### 1.1.3 the client command schema rejects an unknown command type

## 1.2 server events on the wire

### 1.2.1 every server event survives a JSON wire round-trip

### 1.2.2 the server event schema accepts every event shape

### 1.2.3 the server event schema rejects a malformed event

## 1.3 provider registry

### 1.3.1 finds every registered provider by name

### 1.3.2 returns undefined for an unknown provider name

### 1.3.3 lists the default provider first with unique names and key env vars
