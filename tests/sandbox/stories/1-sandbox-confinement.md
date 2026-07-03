# 1. [Sandbox confinement](1-sandbox-confinement.test.ts)

The sandbox confines file tools and `run_bash` to the working directory plus
explicitly granted paths, probing the Landlock helper binary and degrading
gracefully when it is missing or disabled.

## 1.1 tracking writable and readable directories

### 1.1.1 allows writes inside the working directory and default writable paths

### 1.1.2 grants additional read-write and read-only directories on request

### 1.1.3 serializes the grants into helper environment variables

## 1.2 locating and probing the sandbox helper

### 1.2.1 resolves the helper binary from the environment override

### 1.2.2 reports the sandbox disabled when the user opted out

### 1.2.3 reports a degraded sandbox when the helper binary is missing

### 1.2.4 detects landlock support from the helper probe output

## 1.3 running shell commands through the sandbox

### 1.3.1 runs the command through the helper when it is available

### 1.3.2 falls back to plain bash when sandboxing is disabled

### 1.3.3 reports the exit code of a failing command
