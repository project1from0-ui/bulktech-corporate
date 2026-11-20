const TYPES = new Set(['service', 'partnership', 'careers', 'press', 'other']);
const HOSTS = new Set(['www.bulktech.co.jp', 'bulktech-corporate.pages.dev', 'forms-check.bulktech-corporate.pages.dev']);
const LIMIT = 24000;
const result = (status, code, extra = {}) => new Response(JSON.stringify({ code, ...extra }), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' }
});
const text = (v, max, required = true) => typeof v === 'string' && v.trim().length <= max && (!required || v.trim().length > 0) && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v);
const singleLine = v => !/[\r\n\t\u2028\u2029]/.test(v);
const email = v => text(v, 254) && /^[A-Za-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/.test(v);
const scriptUrl = value => typeof value === 'string' && /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(value);
const ready = env => env.FORMS_ENABLED === 'true' && Boolean(env.TURNSTILE_SITE_KEY) && scriptUrl(env.APPS_SCRIPT_URL);
async function limitedJson(request) {
  if (Number(request.headers.get('Content-Length')) > LIMIT) throw new Error('size');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('json');
  let size = 0; const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > LIMIT) { await reader.cancel(); throw new Error('size'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}
export async function handle(request, env, outbound = fetch) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
  if (!['/api/contact', '/api/form-config'].includes(url.pathname)) return result(404, 'not_found');
  const local = env.LOCAL_TEST === 'true' && ['localhost', '127.0.0.1'].includes(url.hostname);
  if (!HOSTS.has(url.hostname) && !local) return result(403, 'origin');
  if (url.pathname === '/api/form-config') {
    if (request.method !== 'GET') return result(405, 'method');
    return ready(env) ? result(200, 'ready', { siteKey: env.TURNSTILE_SITE_KEY }) : result(503, 'unavailable');
  }
  if (request.method !== 'POST') return result(405, 'method');
  if (request.headers.get('Origin') !== url.origin || request.headers.get('Sec-Fetch-Site') === 'cross-site') return result(403, 'origin');
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') || '')) return result(415, 'content_type');
  if (!ready(env)) return result(503, 'unavailable');
  let data;
  try { data = await limitedJson(request); } catch (error) { return result(error.message === 'size' ? 413 : 400, 'invalid'); }
  if (!data || typeof data !== 'object' || Array.isArray(data) || !Number.isSafeInteger(data.createdAt) || data.createdAt > Date.now() + 300000 || data.createdAt < Date.now() - 86400000) return result(400, 'invalid');
  if (!['contact', 'waitlist'].includes(data.kind) || !email(data.email) || data.consent !== true || data.website !== '' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.requestId || '') || !text(data.token, 2048)) return result(400, 'invalid');
  if (data.kind === 'contact' && (!text(data.name, 120) || !singleLine(data.name) || !text(data.company, 160, false) || !singleLine(data.company) || !TYPES.has(data.type) || !text(data.message, 5000))) return result(400, 'invalid');
  // The receiver validates Turnstile exactly once, including direct requests to its public URL.
  // A lost response may follow a successful send: never return a retry-safe error in that case.
  try {
    const signal = AbortSignal.timeout(25000);
    let response = await outbound(env.APPS_SCRIPT_URL, {
      method: 'POST', redirect: 'manual', signal, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, hostname: url.hostname })
    });
    if ([301, 302, 303].includes(response.status)) {
      const target = new URL(response.headers.get('Location') || '', env.APPS_SCRIPT_URL);
      if (target.protocol !== 'https:' || target.hostname !== 'script.googleusercontent.com' || target.port || target.username || target.password || target.pathname !== '/macros/echo') throw new Error('redirect');
      // ContentService redirects to a one-time URL; GET only, no POST or secrets.
      // Keep redirects manual on Workers; any further 3xx fails the response.ok check.
      response = await outbound(target.href, { method: 'GET', redirect: 'manual', signal });
    }
    if (!response.ok || !/^application\/json(?:\s*;|$)/i.test(response.headers.get('Content-Type') || '')) throw new Error('response');
    const value = await limitedJson(response);
    const expected = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data.requestId.toLowerCase())));
    const receipt = 'BULK-' + [...expected.slice(0, 10)].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
    if (!value || value.version !== 1 || typeof value.code !== 'string') throw new Error('schema');
    if (value.code === 'accepted' && value.receipt === receipt && Object.keys(value).length === 3) return result(200, 'accepted', { receipt });
    const errors = { invalid: 400, verification: 400, busy: 429, unavailable: 503, unknown: 503 };
    if (Object.hasOwn(errors, value.code) && Object.keys(value).length === 2) return result(errors[value.code], value.code);
    throw new Error('schema');
  } catch { return result(503, 'unknown'); }
}
export default { fetch: (request, env) => handle(request, env) };
