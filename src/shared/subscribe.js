/**
 * Newsletter sign-up handler. Pure apart from the injected `fetchImpl`, so it is unit-tested.
 *
 * The browser posts a form; the Buttondown API key stays on the server. Buttondown sends the
 * double opt-in confirmation email itself. Abuse protection is deliberately light: same-origin
 * check, a honeypot field, and strict input validation. Add Cloudflare Turnstile if spam appears.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const isValidEmail = (value) =>
  typeof value === 'string' && value.length <= 254 && EMAIL.test(value);

/**
 * @param {Request} request
 * @param {{EMAIL_API_KEY?: string}} env
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<Response>}
 */
export async function handleSubscribe(request, env, fetchImpl = fetch) {
  const url = new URL(request.url);
  const wantsJson = request.headers.get('Accept')?.includes('application/json');
  const reply = (ok, message, status = ok ? 200 : 400) =>
    wantsJson
      ? Response.json({ ok, message }, { status, headers: { 'Cache-Control': 'no-store' } })
      : new Response(null, {
          status: 303,
          headers: { Location: new URL(ok ? '/subscribed/' : '/subscribe-error/', url).toString() },
        });

  const origin = request.headers.get('Origin');
  if (origin && new URL(origin).host !== url.host) return reply(false, 'Not allowed.', 403);

  let form;
  try {
    form = await request.formData();
  } catch {
    return reply(false, 'Please enter a valid email address.');
  }
  // Bots fill the hidden "website" field. Pretend it worked so they learn nothing.
  if (form.get('website')) return reply(true, 'Check your email to confirm.');

  const email = String(form.get('email') ?? '').trim();
  if (!isValidEmail(email)) return reply(false, 'Please enter a valid email address.');
  if (!env.EMAIL_API_KEY) return reply(false, 'Sign-up is not available right now.', 503);

  let response;
  try {
    response = await fetchImpl('https://api.buttondown.com/v1/subscribers', {
      method: 'POST',
      headers: { Authorization: `Token ${env.EMAIL_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email_address: email, tags: ['website'] }),
    });
  } catch {
    return reply(false, 'Could not reach the email service. Please try again.', 502);
  }

  if (response.status === 201) return reply(true, 'Check your email to confirm.');
  // 400 means the address already exists. Say the same thing as for a new one, so the form cannot
  // be used to find out who is on the list.
  if (response.status === 400) return reply(true, 'Check your email to confirm.');
  if (response.status === 429)
    return reply(false, 'Too many sign-ups right now. Please try again soon.', 429);
  return reply(false, 'Something went wrong. Please try again.', 502);
}
