# totvibe — User Stories

This document describes **totvibe** strictly from the user's point of view: what a
person sitting at the terminal can do, what they see, what they type, and how the
program responds. It covers every user-facing function. Internal architecture is
mentioned only where it changes what the user experiences.

## What the software is

totvibe is a minimalist **terminal coding assistant**. The user opens it in a project
directory, types a request in plain language ("add a test for the parser", "what does
this script do?"), and an AI model answers — reading files, listing directories, writing
files, and running shell commands on the user's behalf to get the job done. Reads happen
automatically; anything that changes the machine (writing files, running commands) pauses
and asks the user for a one-keystroke approval. The whole thing runs as a full-screen
text UI (TUI) with a status bar, a scrolling conversation, and an input box.

The user picks which AI provider and model to use (Anthropic, OpenAI, or several
OpenAI-compatible providers) through a built-in dialog that also stores the API key. On
Linux, shell commands run inside a filesystem + network sandbox so the assistant can't
touch anything outside the working directory unless the user explicitly grants it.

---

## 1. Starting the program

### 1.1 Launch in the working directory

*As a developer, I want to launch the assistant in my project folder with a single command
so I can start working immediately.*

- The user runs `bun start` (or `just totvibe`) from the project root. The program opens
  full-screen in the terminal at 30 fps.
- The current working directory becomes the assistant's workspace — every relative file
  path and every shell command is rooted here, and the sandbox (on by default) treats this
  directory as the only writable project location.
- On launch the user sees three regions stacked top to bottom:
  1. a **status bar** (provider, model, live connection indicator, sandbox state, working
     directory, current activity, and the `/provider to connect` hint);
  2. a **conversation pane** showing an ASCII **welcome banner** ("totvibe") with a
     one-line tagline until the first message arrives, then scrollable and sticking to the
     bottom as new content arrives;
  3. an **input box** at the bottom, focused and ready for typing.

### 1.2 First-run connect prompt

*As a first-time user, I don't want to get stuck at a dead prompt when I haven't set up a
key yet.*

- If **no provider has an API key**, the connect dialog (Section 7) opens automatically
  instead of the input box, walking the user through choosing a provider and pasting a key
  before anything else.
- If at least one provider already has a key, totvibe skips the dialog and goes straight to
  the session — preferring the configured `AI_PROVIDER` when it's connected, otherwise the
  first connected provider.

---

## 2. Asking the assistant to do something

### 2.1 Submit a request

*As a user, I want to type a natural-language request and press Enter so the assistant
starts working on it.*

- The user types into the input box with the placeholder **"Ask totvibe to do
  something…"** and presses **Enter**.
- Empty or whitespace-only input is ignored. On submit, the input box clears immediately.
- The typed text is added to the conversation under the **"you"** label (blue), and the
  status changes to **"thinking…"**.

### 2.2 One request at a time

*As a user, I want a clear signal that the assistant is busy so I don't fire off a second
request by accident.*

- While the assistant is working, the input box is **disabled** and its placeholder
  changes to **"working… (Ctrl+C to quit)"** — the user cannot submit a second request
  until the current turn finishes.

### 2.3 Follow-up requests with context

*As a user, I want the assistant to remember the conversation so my follow-ups make
sense.*

- The conversation keeps full history within the session, so follow-up requests like
  "now do the same for the other file" have context.

---

## 3. Watching the assistant respond (streaming)

### 3.1 See prose stream live

*As a user, I want the answer to appear as it's written so I'm not staring at a frozen
screen.*

- **Assistant prose** appears under the **"totvibe"** label (green), growing token by
  token rather than appearing all at once.

### 3.2 See which tools run

*As a user, I want to watch which tools the assistant uses, in real time, so I understand
what it's doing to my project.*

- **Tool calls** appear under a **"tool"** label (amber) the moment the assistant decides
  to use one, formatted as `⏺ <tool_name> <arguments>`. Long argument blobs are truncated
  to ~96 characters with an ellipsis so the line stays readable.
- The assistant can chain many steps in one turn (read a file, then write it, then run a
  command) — up to an internal cap of 24 steps per request — and each step streams as it
  happens.

### 3.3 See tool failures

*As a user, I want failures surfaced inline so I know when something didn't work.*

- **Tool failures** appear as `✗ <tool_name>: <error message>` (e.g. "No such file",
  "Path outside the sandbox's writable dirs").

### 3.4 Know when a turn ends or errors

*As a user, I want to know when the assistant is done and whether it succeeded.*

- When the turn finishes, the status bar shows **"ready · <reason>"**, the input box
  re-enables, and the user can type the next request.
- If the model or network errors mid-turn, the conversation shows an `error: <message>`
  line and the status switches to **"error"**, but the program stays alive and the input
  re-enables.

---

## 4. The tools the assistant can use

These are the concrete actions the assistant performs on the user's machine. From the
user's seat, the important distinction is **automatic (read)** vs **approval-required
(mutate)**.

### 4.1 `read_file` — automatic

*As a user, I want the assistant to read files on its own so it can answer questions
without nagging me for permission on every glance.*

- Reads a UTF-8 text file relative to the working directory. Runs **without asking**.
- If the file doesn't exist, the assistant gets a clear "No such file: <path>" error
  (shown as a tool-error line).
- The path is checked against the sandbox allow-list: a file outside the writable dirs
  cannot be read, and the error tells the user to `/grant` it.

### 4.2 `list_dir` — automatic

*As a user, I want the assistant to browse directory contents on its own so it can orient
itself in my project.*

- Lists a directory's entries (defaults to the current directory `.`), sorted, with
  trailing `/` on subdirectories; an empty directory shows `(empty)`. Runs **without
  asking**. Subject to the same sandbox path check as reads.

### 4.3 `write_file` — requires approval

*As a user, I want to approve any file the assistant wants to create or overwrite, so it
never changes my code behind my back.*

- Creates or overwrites a UTF-8 text file with full contents provided by the assistant.
- **Always pauses for approval** (unless auto-approve is on — Section 6). The user sees
  the approval box (Section 5) naming the tool and showing a preview of the path/content.
- On success, the assistant is told "Wrote N bytes to <path>".
- The target path must be inside the sandbox's writable dirs (working directory, `/tmp`,
  `/dev`, plus anything granted). A path outside fails with a "Path outside the sandbox's
  writable dirs… Ask the user to /grant it" error.

### 4.4 `run_bash` — requires approval, sandboxed

*As a user, I want the assistant to run shell commands — but only after I see the command
and approve it, and only inside a sandbox that protects the rest of my machine.*

- Runs a shell command and returns its combined stdout + stderr plus the exit code.
- **Always pauses for approval** (unless auto-approve is on). The approval box shows the
  exact command before anything runs.
- On Linux with the sandbox helper built, the command — **and every process it spawns** —
  is confined by Landlock + namespaces (Section 8): it can read system directories,
  read/write the working directory, `/tmp`, and `/dev`, and reach the network only if
  network access was explicitly enabled.
- If the sandbox helper isn't built, the command still runs but **unsandboxed**, and its
  output is tagged `(unsandboxed)` so the user knows the protection wasn't applied.
- Output is prefixed with `exit <code>` so the user can see whether the command succeeded.

---

## 5. Approving or skipping an action

### 5.1 Approve a pending action

*As a user, I want a fast, unmissable prompt before any change happens, so I stay in
control with a single keystroke.*

- When the assistant calls `write_file` or `run_bash`, a bordered amber box appears
  between the conversation and the input, reading:
  **`Approve <tool>?  [y] run   [n] skip`**, with a dimmed preview of the arguments
  (the command, or the file path and content) underneath.
- The status bar shows **"approval required"** and the assistant is blocked, waiting.
- Pressing **`y`** runs the action; the box disappears and the turn continues (status
  returns to "thinking…").
- Read tools (`read_file`, `list_dir`) never trigger this prompt.

### 5.2 Skip or deny a pending action

*As a user, I want to refuse an action with one key and have the assistant respond
sensibly rather than retry the same thing.*

- Pressing **`n`** or **`Esc`** skips the action. The assistant is told the user denied it
  and is nudged to "choose a safer approach instead of retrying the same action," so it
  doesn't just attempt the identical call again.

---

## 6. Running unattended (auto-approve)

### 6.1 Skip every approval prompt

*As a power user running a scripted or trusted session, I want to skip every approval
prompt so the assistant can work end-to-end without me.*

- Setting the environment variable `AUTO_APPROVE=1` (e.g. in `.env`) makes every
  `write_file` and `run_bash` run **without prompting**.
- The sandbox still applies — auto-approve removes the *human gate*, not the *filesystem/
  network confinement*. This is intended for unattended or CI-style runs.

---

## 7. Choosing a provider and model (the connect dialog)

The connect dialog is the program's settings hub for the model. It opens **automatically
on first run when no provider has a key**, and the user can open it any time by typing the
**`/provider`** command in the input box.

### 7.1 Open the dialog and browse providers

*As a user, I want to see every supported provider with its connection status and model at
a glance.*

- Each line shows a connection dot (● connected / ○ not), the provider's label, and the
  model that would be used. The supported providers — all OpenAI-compatible, each with its
  own default model — are **Alibaba Qwen** (`qwen`), **Z.ai GLM Coding Plan — Global**
  (`glm`), **Zhipu GLM Coding Plan — China** (`glm-cn`), **Moonshot Kimi** (`kimi`),
  **Xiaomi MiMo** (`mimo`), **DeepSeek** (`deepseek`), **Google Gemini** (`gemini`),
  **MiniMax** (`minimax`), and **Mistral AI** (`mistral`). The two GLM entries load the
  **GLM Coding Plan** the same way Z.ai's own coding-tool helper does: `glm` points at the
  Global coding endpoint (`api.z.ai`) and `glm-cn` at the China endpoint
  (`open.bigmodel.cn`).
- **↑ / ↓** move the highlight between providers (wraps around top/bottom). For the
  highlighted provider the dialog shows whether it's connected ("Connected via
  <ENV_VAR>") or what's missing ("Not connected — needs <ENV_VAR>" plus a hint and the
  key URL).

### 7.2 Open a provider's key page

*As a user, I want to jump to the page where I create an API key.*

- Pressing **`o`** opens the highlighted provider's API-key web page in the system browser
  (`xdg-open`/`open`/`start`). On a headless/SSH box where no browser opens, the URL is
  shown in the dialog instead so the user can copy it.

### 7.2a Test whether a provider actually connects

*As a user, I want to confirm a stored key really works, not just that it's set.*

- Pressing **`t`** probes the highlighted provider's `/models` endpoint with its stored key
  and reports the result in the dialog: **connection OK**, **key rejected** (HTTP 401/403),
  or **unreachable** (network/timeout). If no key is set, it tells the user to press `k`
  first. This is a live network check, distinct from the ● dot, which only means "a key is
  present".

### 7.3 Paste, verify, and save an API key

*As a user, I want to paste my key once, know immediately whether it actually works, and
have it remembered.*

- Pressing **`k`** switches to key-entry, then the user pastes the API key and presses
  **Enter** to save. Pasting (e.g. **`Ctrl+Shift+V`**) also works without pressing `k`
  first: a paste anywhere in the dialog is captured straight into the key field and
  switches to key-entry.
- On **Enter**, the key is **verified** against the provider's `/models` endpoint before
  anything is saved (the dialog shows "Verifying <ENV_VAR>…"). If the provider **rejects**
  the key (HTTP 401/403), nothing is written, the typed key stays in the field, and a
  notice tells the user to fix it and try again. If the key is accepted — or simply can't
  be reached (offline / timeout) — it is written to `.env`, applied live, and the provider
  becomes active.

### 7.4 Edit the model id

*As a user, I want to switch to a specific model id for a provider.*

- Pressing **`m`** switches to model-entry: the user edits the model id and presses
  **Enter** to switch the highlighted provider to that model.

### 7.5 Activate a provider/model

*As a user, I want to start using the highlighted provider and model immediately.*

- Pressing **Enter** uses the highlighted provider with its shown model. If that provider
  has no key yet, the dialog tells the user which env var is needed and switches to
  key-entry.
- Selecting a provider/model takes effect **immediately and live** — no restart. The
  status bar updates to the new `provider:model`.

### 7.6 Close the dialog

*As a user, I want to dismiss the dialog — but never into a non-working state.*

- Pressing **Esc** closes the dialog, **only if a provider is already connected**. In the
  key/model sub-modes, Esc returns to the provider list instead.

---

## 8. Sandboxing and the status indicator (Linux)

### 8.1 See whether the sandbox is active

*As a user, I want to see at a glance whether shell commands and writes are confined to my
project.*

- The sandbox is **on by default** — the user gets full protection without doing anything.
- The status bar always shows the current sandbox state with a color cue:
  - **`sandbox: fs+net`** (green) — full protection: filesystem confined and network
    isolated.
  - **`sandbox: off (--no-sandbox)`** (amber) — the user deliberately started without the
    sandbox (Story 8.5); nothing is confined.
  - **`sandbox: fs`** (green) — filesystem confined; network access allowed (because the
    user opted into network).
  - **`sandbox: net-only (no landlock)`** (amber) — the kernel lacks Landlock, so only
    network isolation applies; filesystem confinement is degraded.
  - **`sandbox: off (run build:sandbox)`** (amber) — the helper binary isn't built;
    commands run unsandboxed. The label tells the user exactly how to fix it.
  - **`sandbox: …`** — still probing at startup.

### 8.2 Default sandbox boundaries

*As a user, I want a mistaken or surprising command to be unable to damage the rest of my
system.*

- What the sandbox allows by default: **read** of system dirs (`/usr`, `/bin`, `/etc`,
  `/proc`, `/sys`, …); **read/write** of the working directory, `/tmp`, and `/dev`;
  network **only** when explicitly enabled.
- Both the shell sandbox and the file tools (`read_file`/`write_file`/`list_dir`) honor
  the **same** allow-list, so the file tools can't reach anywhere a sandboxed command
  couldn't.
- The helper is optional; without it the program still works, just unsandboxed (clearly
  flagged in both the status bar and each command's output).

### 8.3 Grant more access — `/grant`

*As a user, I want to let the assistant touch a path outside my project for the rest of
this session, without restarting or loosening the whole sandbox.*

- The user types **`/grant <path>`** into the input box and presses Enter.
- That path is added to the writable allow-list for the current session. A confirmation
  line "granted read/write: <path>" appears in the conversation (under the tool label).
- After granting, both the file tools and `run_bash` can read and write under that path.
  The grant lasts until the program exits.
- `/grant` is handled locally — it does **not** go to the model and does not start a
  thinking turn.

### 8.4 Enable network for commands

*As a user, I want to decide whether sandboxed commands can reach the network (e.g. to run
an installer or fetch a dependency).*

- By default, network is **isolated** — sandboxed commands have no network access.
- Setting `TOTVIBE_SANDBOX_NET=inherit` (env / `.env`) lets `run_bash` use the host
  network. The status bar reflects this as `sandbox: fs` (filesystem still confined,
  network open).

### 8.5 Start without the sandbox

*As a user on a trusted machine, I want to opt out of confinement entirely when I
deliberately need the assistant to reach beyond the working directory.*

- The sandbox is **on by default**; the user opts out with the **`--no-sandbox`**
  command-line flag (e.g. `bun start --no-sandbox` or `just totvibe --no-sandbox`).
- With the flag set: the file-tool allow-list checks are skipped (reads/writes can go
  anywhere) and `run_bash` runs in a plain, unconfined shell. The status bar shows
  **`sandbox: off (--no-sandbox)`** (amber) so the reduced protection is never hidden.
- Flags are parsed by [citty](https://github.com/unjs/citty); `bun start --help` lists
  them.

---

## 9. Reading the status bar

### 9.1 Understand the assistant's state at a glance

*As a user, I want a single line that tells me the assistant's state so I never have to
guess what's happening.*

Left to right, the status bar shows:

1. **`totvibe`** — the app name.
2. **Connection + model** — a live connection indicator followed by `provider:model`,
   e.g. `● qwen:qwen3.7-max`. totvibe probes the active provider's `/models` on launch and
   after each change, so the indicator reflects real reachability, not just key presence:
   **● ok** (green), **◌ (checking…)** (cyan), **✗ (key rejected)** (red), **● (unreachable)**
   (amber), or **○** when no key is set (amber).
3. **Sandbox state** — as described in Section 8.
4. **Working directory** — shortened with `~` for the home directory.
5. **Activity** — `ready`, `thinking…`, `approval required`, `ready · <reason>`,
   `error`, or `aborted`.
6. **`/provider to connect`** — the hint for opening the connect dialog.

---

## 10. Selecting and copying text

### 10.1 Select and copy with the terminal's own tools

*As a user, I want to select text in the conversation and copy it the way I do in any other
terminal program, so I can paste an answer or a command elsewhere.*

- totvibe does **not** capture the mouse, so the terminal emulator keeps full control of
  text selection. The user drags to select any text in the conversation (prose, tool
  output, error lines) and copies it with the terminal's own shortcut — **`Ctrl+Shift+C`**
  on most Linux terminals (`Cmd+C` on macOS).
- **Right-click** opens the terminal emulator's native context menu (copy, paste, etc.)
  rather than being swallowed by the app.

---

## 11. Quitting

### 11.1 Exit instantly

*As a user, I want to exit the program instantly at any time.*

- Pressing **`Ctrl+C`** quits immediately — from anywhere, including mid-turn, mid-dialog,
  or while an approval prompt is up. The TUI tears down and the process exits.
- `Ctrl+C` is intercepted by the app rather than killing it abruptly, so the terminal is
  restored cleanly.

---

## 12. Configuring via environment / `.env`

### 12.1 Preset everything in a file

*As a user, I want to preset provider, model, key, approvals, and network in a file so I
don't have to click through the dialog each run.*

Bun loads `.env` automatically. The user-facing settings:

| Variable | Effect for the user |
|---|---|
| `AI_PROVIDER` | Which provider to start with (`qwen` default, or `glm`/`glm-cn`/`kimi`/`mimo`/`deepseek`/`gemini`/`minimax`/`mistral`). An unknown value stops startup with a message listing the valid choices. |
| `MODEL` | Override the model id for the chosen provider. |
| `<PROVIDER>_API_KEY` | The key for the chosen provider (e.g. `DASHSCOPE_API_KEY` for `qwen`, `ZAI_API_KEY` for `glm`, `ZHIPU_API_KEY` for `glm-cn`). Also writable via the dialog's `k` action. |
| `AUTO_APPROVE=1` | Skip all approval prompts (Section 6). |
| `TOTVIBE_SANDBOX_NET=inherit` | Allow network in sandboxed commands (Section 8.4). |
| `TOTVIBE_SANDBOX_BIN` | Point at a custom sandbox helper binary. |

Turning the sandbox **off** is a command-line flag, not an env var: `--no-sandbox`
(Story 8.5). The sandbox is on by default.

### 12.2 Keys saved from the dialog persist

*As a user, I want a key I pasted in the dialog to still be there next launch.*

- Keys saved through the dialog are written back into `.env` (existing values are updated
  in place, new ones appended), so the next launch starts already connected.

---

## Summary of every user-facing function

| # | Function | How the user triggers it | What it does |
|---|---|---|---|
| 1 | Launch | `bun start` / `just totvibe` | Opens the TUI in the working directory, sandboxed by default. |
| 2 | Ask | Type + **Enter** | Sends a natural-language request to the assistant. |
| 3 | Live response | (automatic) | Streams prose, tool calls, and errors into the conversation. |
| 4 | `read_file` / `list_dir` | (assistant, automatic) | Reads files / lists dirs without asking. |
| 5 | `write_file` / `run_bash` | (assistant, gated) | Writes files / runs shell commands after approval. |
| 6 | Approve / skip | **y** / **n** / **Esc** | Allows or denies a pending change. |
| 7 | Auto-approve | `AUTO_APPROVE=1` | Removes approval prompts for unattended runs. |
| 8 | Connect dialog | Type **`/provider`** (or auto when no provider has a key) | Pick provider, switch model, paste & verify & save key, test connection, open key page. |
| 9 | `/grant <path>` | Type in input box | Adds a path to the session's writable allow-list. |
| 10 | Network toggle | `TOTVIBE_SANDBOX_NET=inherit` | Lets sandboxed commands use the network. |
| 11 | Disable sandbox | `--no-sandbox` flag | Starts without filesystem/network confinement. |
| 12 | Status bar | (always visible) | Shows provider, model, connection, sandbox state, cwd, activity. |
| 13 | Select & copy | Drag-select + **Ctrl+Shift+C** / right-click | Uses the terminal's native selection, copy, and context menu (mouse not captured). |
| 14 | Quit | **Ctrl+C** | Exits immediately and restores the terminal. |
| 15 | Env config | `.env` / environment | Presets provider, model, key, approvals, sandbox. |
