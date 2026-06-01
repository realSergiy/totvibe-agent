import { resolve } from "node:path";

export async function saveEnvVars(updates: Record<string, string>): Promise<void> {
  const path = resolve(process.cwd(), ".env");
  const file = Bun.file(path);
  const existing = (await file.exists()) ? await file.text() : "";
  const lines = existing.length ? existing.split("\n") : [];

  const written = new Set<string>();
  const rewritten = lines.map((line) => {
    const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=/);
    const name = match?.[1];
    if (name && updates[name] !== undefined) {
      written.add(name);
      return `${name}=${updates[name]}`;
    }
    return line;
  });

  while (rewritten.at(-1)?.trim() === "") rewritten.pop();

  for (const [name, value] of Object.entries(updates)) {
    if (!written.has(name)) rewritten.push(`${name}=${value}`);
    process.env[name] = value;
  }

  await Bun.write(path, `${rewritten.join("\n")}\n`);
}

export function openKeyPage(url: string): void {
  const command =
    process.platform === "darwin"
      ? ["open", url]
      : process.platform === "win32"
        ? ["cmd", "/c", "start", "", url]
        : ["xdg-open", url];
  try {
    Bun.spawn(command, { stdout: "ignore", stderr: "ignore", stdin: "ignore" });
  } catch {
    // No browser available (headless / SSH); the URL is still shown in the dialog.
  }
}
