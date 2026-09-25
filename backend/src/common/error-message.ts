/**
 * Message for logging a caught value. `catch (e)` is untyped, and not every
 * thrown value is an Error (fetch/JSON failures are, but a rejected promise
 * can carry anything).
 */
export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
