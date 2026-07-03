# 2. [Tool execution](2-tool-execution.test.ts)

Tool calls requested by the model run through a middleware pipeline: unknown
tools and thrown errors become error outcomes instead of crashes, consecutive
read-only calls run concurrently, and composed middleware wraps in order.

## 2.1 executing a single tool call

### 2.1.1 runs the tool through the middleware and returns its output

### 2.1.2 returns an error outcome for an unknown tool

### 2.1.3 captures a thrown tool error as an error outcome

## 2.2 batching read-only calls

### 2.2.1 preserves outcome order across mixed read-only and mutating calls

### 2.2.2 runs consecutive read-only calls concurrently

## 2.3 describing tools to the model

### 2.3.1 exposes every definition in the model tool set by name

### 2.3.2 finds definitions by name and classifies read-only tools

## 2.4 composing middleware

### 2.4.1 applies middleware in declaration order around the tool
