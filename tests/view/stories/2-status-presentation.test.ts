import { describe, expect, test } from 'vitest';

import {
  formatConnectionSuffix,
  formatSandboxLabel,
  formatToolInput,
  makeSandboxStatus,
  pickConnectionColor,
  pickConnectionSymbol,
  pickSandboxColor,
  renderUseController,
  stubController,
  theme,
} from '#view';

describe('2.1 presenting the connection status', () => {
  test('2.1.1 suffixes the provider label with transient connection states', () => {
    expect(formatConnectionSuffix('checking')).toBe(' (checking…)');
    expect(formatConnectionSuffix('rejected')).toBe(' (key rejected)');
    expect(formatConnectionSuffix('unreachable')).toBe(' (unreachable)');
    expect(formatConnectionSuffix('ok')).toBe('');
    expect(formatConnectionSuffix('no-key')).toBe('');
  });

  test('2.1.2 colors and symbolizes each connection state', () => {
    expect(pickConnectionColor('checking')).toBe(theme.checking);
    expect(pickConnectionColor('ok')).toBe(theme.ok);
    expect(pickConnectionColor('rejected')).toBe(theme.error);
    expect(pickConnectionColor('no-key')).toBe(theme.warn);
    expect(pickConnectionSymbol('checking')).toBe('◌');
    expect(pickConnectionSymbol('ok')).toBe('●');
    expect(pickConnectionSymbol('rejected')).toBe('✗');
    expect(pickConnectionSymbol('unreachable')).toBe('●');
    expect(pickConnectionSymbol('no-key')).toBe('○');
  });
});

describe('2.2 presenting the sandbox status', () => {
  test('2.2.1 labels every sandbox state', () => {
    expect(formatSandboxLabel(undefined)).toBe('sandbox: …');
    expect(formatSandboxLabel(makeSandboxStatus({ enabled: false }))).toBe('sandbox: off (--no-sandbox)');
    expect(formatSandboxLabel(makeSandboxStatus({ available: false }))).toBe('sandbox: off (run build:sandbox)');
    expect(formatSandboxLabel(makeSandboxStatus({ hasLandlock: false }))).toBe('sandbox: net-only (no landlock)');
    expect(formatSandboxLabel(makeSandboxStatus({ net: 'none' }))).toBe('sandbox: fs+net');
    expect(formatSandboxLabel(makeSandboxStatus({ net: 'inherit' }))).toBe('sandbox: fs');
  });

  test('2.2.2 colors the sandbox by health', () => {
    expect(pickSandboxColor(undefined)).toBe(theme.muted);
    expect(pickSandboxColor(makeSandboxStatus({ degraded: true }))).toBe(theme.warn);
    expect(pickSandboxColor(makeSandboxStatus({}))).toBe(theme.ok);
  });
});

describe('2.3 previewing tool input', () => {
  test('2.3.1 shows strings as-is and serializes objects', () => {
    expect(formatToolInput('ls -la')).toBe('ls -la');
    expect(formatToolInput({ path: 'a.txt' })).toBe('{"path":"a.txt"}');
  });

  test('2.3.2 truncates long previews with an ellipsis', () => {
    const TOOL_INPUT_PREVIEW_MAX_CHARS = 96;
    const LONG_INPUT_CHARS = 200;
    const preview = formatToolInput('x'.repeat(LONG_INPUT_CHARS));
    expect(preview.length).toBe(TOOL_INPUT_PREVIEW_MAX_CHARS);
    expect(preview.endsWith('…')).toBe(true);
  });

  test('2.3.3 falls back to a plain string for unserializable input', () => {
    const circular: { self?: unknown } = {};
    circular.self = circular;
    expect(formatToolInput(circular)).toBe('[object Object]');
  });
});

describe('2.4 exposing the agent controller to components', () => {
  test('2.4.1 returns the controller provided by the frontend root', () => {
    const { result } = renderUseController(stubController);
    expect(result.current).toBe(stubController);
  });

  test('2.4.2 refuses to render outside a controller provider', () => {
    expect(() => renderUseController()).toThrow('useController must be used within a ControllerContext provider');
  });
});
