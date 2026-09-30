export async function jget<T = any>(url: string): Promise<T> {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`GET ${url} failed: ${r.status}`);
  return r.json();
}
export async function jsend<T = any>(url: string, method: string, body?: any): Promise<T> {
  const r = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    // `status` and `body` let callers react to specific failures (e.g. show field errors inline).
    throw Object.assign(new Error(e.error || `${method} ${url} failed: ${r.status}`), {
      status: r.status,
      body: e,
    });
  }
  return r.json();
}
