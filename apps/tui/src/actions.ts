export const openKeyPage = (url: string) => {
  const command =
    process.platform === "darwin"
      ? ["open", url]
      : process.platform === "win32"
        ? ["cmd", "/c", "start", "", url]
        : ["xdg-open", url];
  try {
    Bun.spawn(command, { stderr: "ignore", stdin: "ignore", stdout: "ignore" });
  } catch {
    // No browser available (headless / SSH); the URL is still shown in the dialog.
  }
};
