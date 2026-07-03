# 1. [Builtin tools](1-builtin-tools.test.ts)

The agent's builtin tools — `read_file`, `list_dir`, `write_file`, `run_bash` —
operate relative to the working directory, stay inside the sandbox's writable
paths, and cap oversized output into spill files.

## 1.1 reading files inside the sandbox

### 1.1.1 reads a UTF-8 file relative to the working directory

### 1.1.2 reports a missing file by its requested path

### 1.1.3 refuses paths outside the writable directories

### 1.1.4 refuses paths that escape the sandbox through a symlink

### 1.1.5 truncates oversized output to a spill file

## 1.2 listing directories

### 1.2.1 lists entries sorted with a trailing slash on directories

### 1.2.2 describes an empty directory as empty

## 1.3 writing files

### 1.3.1 creates a file and reports the bytes written

### 1.3.2 refuses to write outside the sandbox unless sandboxing is off

## 1.4 running shell commands

### 1.4.1 reports the exit code and combined output of a command

### 1.4.2 reports a nonzero exit code without throwing

### 1.4.3 runs through the sandbox helper without the unsandboxed tag
