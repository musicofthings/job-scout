import {
  deleteSubscription,
  getSubscriptionByEmail,
  json,
  requireKv,
  type DigestEnv,
} from '../../lib/digest'

interface Body {
  email?: string
  token?: string
}

export const onRequestPost: PagesFunction<DigestEnv> = async (context) => {
  const kvOrErr = requireKv(context.env)
  if (kvOrErr instanceof Response) return kvOrErr

  let body: Body
  try {
    body = (await context.request.json()) as Body
  } catch {
    return json({ success: false, error: 'Invalid JSON body.' }, 400)
  }

  const email = (body.email || '').trim().toLowerCase()
  const token = (body.token || '').trim()
  if (!email || !token) {
    return json({ success: false, error: 'Email and unsubscribe token are required.' }, 400)
  }

  const sub = await getSubscriptionByEmail(kvOrErr, email)
  if (!sub || sub.unsubToken !== token) {
    return json({ success: false, error: 'Subscription not found or token mismatch.' }, 404)
  }

  await deleteSubscription(kvOrErr, sub)
  return json({ success: true, message: 'Unsubscribed. Your encrypted key was removed.' })
}

/** Allow one-click unsubscribe via GET ?email=&token= */
export const onRequestGet: PagesFunction<DigestEnv> = async (context) => {
  const kvOrErr = requireKv(context.env)
  if (kvOrErr instanceof Response) return kvOrErr

  const url = new URL(context.request.url)
  const email = (url.searchParams.get('email') || '').trim().toLowerCase()
  const token = (url.searchParams.get('token') || '').trim()
  if (!email || !token) {
    return new Response('Missing email or token.', { status: 400 })
  }

  const sub = await getSubscriptionByEmail(kvOrErr, email)
  if (!sub || sub.unsubToken !== token) {
    return new Response('Subscription not found or token mismatch.', { status: 404 })
  }

  await deleteSubscription(kvOrErr, sub)
  return new Response(
    `<!doctype html><html><body style="font-family:system-ui;padding:2rem;background:#fbf8f2;color:#221510">
      <h1 style="font-family:Georgia,serif">Unsubscribed</h1>
      <p>You will no longer receive Job Scout daily digests at <strong>${email}</strong>.</p>
    </body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  )
}
