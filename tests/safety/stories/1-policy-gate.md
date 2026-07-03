# 1. [Policy gate](1-policy-gate.test.ts)

Every mutating tool call passes through the safety policy: read-only actions
run freely, mutating actions need the user's approval (or auto mode), a short
list of catastrophic commands is denied absolutely, and every decision lands in
the audit ledger.

## 1.1 deciding what a tool action may do

### 1.1.1 allows read-only actions without asking

### 1.1.2 allows mutating actions in auto mode

### 1.1.3 asks for approval on mutating actions in default mode

### 1.1.4 extracts command and path only from object inputs

## 1.2 absolute-deny rules that no mode can override

### 1.2.1 denies recursive deletes of root or home paths

### 1.2.2 denies fork bombs

### 1.2.3 denies force pushes but allows force-with-lease

### 1.2.4 denies piping a network download straight into a shell

### 1.2.5 denies overwriting raw block devices

### 1.2.6 denies touching private keys and credential files by command or path

## 1.3 gating tool invocations through approval

### 1.3.1 runs allowed invocations and records the allow decision

### 1.3.2 runs a mutating invocation once the user approves it

### 1.3.3 replaces the output with denial feedback when the user refuses

### 1.3.4 blocks absolute-deny invocations without asking

### 1.3.5 times out a pending approval and reports it to the model

## 1.4 auditing every decision

### 1.4.1 appends decision records to the audit jsonl file
