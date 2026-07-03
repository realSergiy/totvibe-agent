# 2. [Initial config](2-initial-config.test.ts)

`loadInitialConfig` turns CLI flags and environment variables into the runtime's
initial configuration: provider and model selection, agent limits, and the
session to start or resume under the data directory.

## 2.1 resolving the provider

### 2.1.1 defaults to the default provider and its model

### 2.1.2 honors provider, model, approval, and network overrides from the environment

### 2.1.3 rejects an unknown provider naming the known ones

## 2.2 deriving agent limits

### 2.2.1 defaults the limits from the provider metadata

### 2.2.2 honors positive integer overrides and ignores invalid ones

## 2.3 resolving the session and data paths

### 2.3.1 starts a fresh session under the data directory by default

### 2.3.2 continues the most recently saved session

### 2.3.3 resumes an explicitly named session
