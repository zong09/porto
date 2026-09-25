import axios from 'axios';

/**
 * The server's error message from a failed API call, or `fallback`.
 * NestJS validation errors carry an array of messages; those are joined.
 */
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError<{ message?: string | string[] }>(err)) {
    const message = err.response?.data?.message;
    if (Array.isArray(message)) return message.join(', ') || fallback;
    if (message) return message;
  }
  return fallback;
}
