/** Gemensamma hjälpare för API:ts svar och förfrågningar. */

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers,
    },
  });
}

/**
 * Läser en JSON-kropp med storleksgräns. Returnerar ett färdigt felsvar om något är fel,
 * annars den tolkade kroppen.
 */
export async function readJson(request: Request, maxBytes: number): Promise<{ body: unknown } | { error: Response }> {
  const declared = Number(request.headers.get('Content-Length') ?? 0);
  if (declared > maxBytes) return { error: json({ error: 'För stor förfrågan.' }, 413) };
  const text = await request.text();
  if (text.length > maxBytes) return { error: json({ error: 'För stor förfrågan.' }, 413) };
  try {
    return { body: JSON.parse(text) };
  } catch {
    return { error: json({ error: 'Ogiltig JSON.' }, 400) };
  }
}

/**
 * Skydd mot CSRF: en webbläsare skickar alltid Origin på POST, så ett anrop från en annan sajt
 * (som skulle få med inloggningscookien) avvisas. Anrop utan Origin kommer inte från en
 * webbläsare och kan då inte heller bära någon annans cookie.
 */
export function isCrossOrigin(request: Request, url: URL): boolean {
  const origin = request.headers.get('Origin');
  return origin !== null && origin !== url.origin;
}

export function clientIp(request: Request): string {
  return request.headers.get('CF-Connecting-IP') ?? 'okänd';
}
