/**
 * Response helper utilities
 */

// JSON response helper
export const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

// Error response helper
export const error = (message: string, status = 400) =>
  json({ error: message }, status);
