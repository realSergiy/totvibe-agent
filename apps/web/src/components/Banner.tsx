import { theme } from "@totvibe/view";

export function Banner() {
  return (
    <div className="banner">
      <h1 style={{ color: theme.brand }}>totvibe</h1>
      <p style={{ color: theme.muted }}>
        minimalist coding assistant · type a request and press Enter
      </p>
    </div>
  );
}
