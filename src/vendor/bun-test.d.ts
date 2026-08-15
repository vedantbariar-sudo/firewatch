/**
 * Ambient types for the Bun test runner globals used by `*.test.ts` files
 * (run with `bun test`). Type-only — the runtime globals are provided by Bun
 * itself, so this declaration never ships to the browser.
 */
declare function test(name: string, fn: () => void): void;
