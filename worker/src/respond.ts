// Every answer is JSON; every error is `{code, message}` (account.md §5).

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

export function refuse(status: number, code: string, message: string): Response {
  return json({ code, message }, status);
}
