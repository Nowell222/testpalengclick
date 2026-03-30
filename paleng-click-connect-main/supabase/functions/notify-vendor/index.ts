// @ts-ignore — web-push runs fine in Deno via esm.sh
import webpush from 'https://esm.sh/web-push@3.6.7'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const fmt = (n: number) => `₱${Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

// ── Email HTML ───────────────────────────────────────────────────────────────
const buildEmailHTML = (data: {
  vendorName: string; stallNumber: string; section: string; amount: number
  period: string; paymentMethod: string; paymentType: string
  receiptNumber: string; referenceNumber: string; cashierName: string; dateTime: string
}) => {
  const rows = [
    ['Receipt No.',    data.receiptNumber  || '—'],
    ['Reference No.',  data.referenceNumber || '—'],
    ['Date & Time',    data.dateTime],
    ['Vendor',         data.vendorName],
    ['Stall Number',   data.stallNumber],
    ['Section',        data.section],
    ['Billing Period', data.period],
    ['Payment Type',   data.paymentType],
    ['Method',         data.paymentMethod],
    ['Processed by',   data.cashierName],
  ].map(([l, v]) =>
    `<tr style="border-bottom:1px dashed #ede5d5">
      <td style="padding:10px 0;color:#7a8a7a;width:45%">${l}</td>
      <td style="padding:10px 0;color:#1a2e1a;font-weight:600;text-align:right">${v}</td>
    </tr>`
  ).join('')

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Receipt</title></head>
<body style="margin:0;padding:0;background:#f8f5f0;font-family:Georgia,serif">
<div style="max-width:560px;margin:32px auto;background:#fff;border:1px solid #ddd5c5;border-radius:12px;overflow:hidden">
  <div style="background:linear-gradient(135deg,#1a4a2e,#2d7a4f);padding:32px 40px;text-align:center">
    <p style="color:rgba(240,230,200,0.7);font-size:10px;letter-spacing:3px;text-transform:uppercase;margin:0 0 6px">Republic of the Philippines</p>
    <p style="color:#f0e6c8;font-size:14px;font-weight:700;margin:0 0 4px">Municipality of San Juan, Batangas</p>
    <p style="color:rgba(240,230,200,0.6);font-size:10px;margin:0 0 16px">Office of the Municipal Treasurer</p>
    <h1 style="color:#e8c86e;font-size:22px;font-weight:700;letter-spacing:2px;margin:0">OFFICIAL RECEIPT</h1>
  </div>
  <div style="background:#f0fdf4;border-bottom:1px solid #bbf7d0;padding:16px 40px">
    <p style="color:#166534;font-weight:700;font-size:14px;margin:0">Payment Successfully Confirmed!</p>
    <p style="color:#15803d;font-size:12px;margin:4px 0 0">Your stall fee has been received and processed.</p>
  </div>
  <div style="padding:32px 40px">
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px">${rows}</table>
    <div style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:2px solid #86efac;border-radius:10px;padding:24px;text-align:center;margin-bottom:24px">
      <p style="color:#4a7a5a;font-size:11px;text-transform:uppercase;letter-spacing:2px;margin:0 0 8px">Amount Paid</p>
      <p style="color:#166534;font-size:36px;font-weight:700;font-family:monospace;margin:0">${fmt(data.amount)}</p>
    </div>
    <p style="text-align:center;color:#b0a090;font-size:11px;border-top:1px solid #ede5d5;padding-top:16px;margin:0">
      Computer-generated receipt. PALENG-CLICK · Municipality of San Juan, Batangas
    </p>
  </div>
</div>
<div style="text-align:center;padding:16px;color:#b0a090;font-size:11px">
  © 2026 Municipality of San Juan, Batangas · PALENG-CLICK
</div></body></html>`
}

// ── Send one push notification using web-push library ────────────────────────
async function sendPush(
  sub: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string
): Promise<{ ok: boolean; status: number; body: string }> {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

  try {
    const result = await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys:     { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
      },
      payload,
      { TTL: 86400 }
    )
    return { ok: true, status: result.statusCode, body: result.body || '' }
  } catch (err: any) {
    const status = err.statusCode || 500
    const body   = err.body || err.message || String(err)
    return { ok: false, status, body }
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const body = await req.json()
    const {
      vendor_user_id,
      vendor_name, stall_number, section, amount,
      period_month, period_year, payment_method, payment_type,
      receipt_number, reference_number, cashier_name,
      // Push-only mode (for announcements)
      _push_only, _push_title, _push_body,
    } = body

    const VP = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
    const VK = Deno.env.get('VAPID_PUBLIC_KEY')  ?? ''
    const VAPID_SUBJECT = 'mailto:nowellandal71@gmail.com'

    // ── Push-only mode (announcements) ────────────────────────────────────────
    if (_push_only && _push_title) {
      console.log('push-only for:', vendor_user_id, _push_title)
      const { data: subs } = await (supabase.from('push_subscriptions' as any) as any)
        .select('*').eq('user_id', vendor_user_id)

      if (subs?.length && VP && VK) {
        const pp = JSON.stringify({
          title: _push_title,
          body:  _push_body || '',
          data:  { type: 'announcement', url: '/vendor/news' },
        })
        for (const sub of subs) {
          try {
            const sd = typeof sub.subscription === 'string'
              ? JSON.parse(sub.subscription) : sub.subscription
            if (!sd?.endpoint || !sd?.keys?.p256dh || !sd?.keys?.auth) continue
            const r = await sendPush({ endpoint: sd.endpoint, keys: sd.keys }, pp, VK, VP, VAPID_SUBJECT)
            console.log('push-only result:', r.status, r.body)
            if (!r.ok && (r.status === 410 || r.status === 404)) {
              await (supabase.from('push_subscriptions' as any) as any).delete().eq('id', sub.id)
            }
          } catch(e) { console.error('push-only err:', e) }
        }
      }
      return new Response(
        JSON.stringify({ success: true, mode: 'push_only' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── Standard payment notification flow ────────────────────────────────────
    console.log('notify-vendor:', vendor_user_id, amount)

    const period   = period_month ? `${MONTHS[period_month - 1]} ${period_year}` : '—'
    const dateTime = new Date().toLocaleString('en-PH', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    })
    const ML: Record<string, string> = {
      gcash: 'GCash', paymaya: 'Maya', instapay: 'InstaPay', cash: 'Cash at Cashier'
    }
    const results: any = { errors: [] }

    // 1. In-app notification ──────────────────────────────────────────────────
    const { error: ne } = await supabase.from('notifications').insert({
      user_id: vendor_user_id,
      title:   `✅ Payment Confirmed — ${fmt(Number(amount))}`,
      message: `Your payment has been confirmed.
• Stall: ${stall_number} — ${section}
• Amount: ${fmt(Number(amount))}
• Period: ${period}
• Method: ${ML[payment_method] || payment_method}
• Receipt: ${receipt_number || '—'}
• Ref: ${reference_number || '—'}
• By: ${cashier_name}
• Date: ${dateTime}

Thank you!`,
      type: 'confirmation',
    })
    results.in_app = ne ? { success: false, error: ne.message } : { success: true }
    if (ne) console.error('in-app error:', ne)

    // 2. Email via Resend ─────────────────────────────────────────────────────
    const RKEY = Deno.env.get('RESEND_API_KEY')
    if (RKEY) {
      const { data: ud } = await supabase.auth.admin.getUserById(vendor_user_id)
      const email = ud?.user?.email
      console.log('vendor email:', email)
      if (email) {
        const er = await fetch('https://api.resend.com/emails', {
          method:  'POST',
          headers: { 'Authorization': `Bearer ${RKEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from:    'PALENG-CLICK <onboarding@resend.dev>',
            to:      [email],
            subject: `✅ Payment Confirmed — ${fmt(Number(amount))} for ${period}`,
            html:    buildEmailHTML({
              vendorName:    vendor_name,
              stallNumber:   stall_number,
              section,
              amount:        Number(amount),
              period,
              paymentMethod: ML[payment_method] || payment_method,
              paymentType:   payment_type === 'staggered' ? 'Partial Payment' : 'Full Payment',
              receiptNumber:   receipt_number  || '—',
              referenceNumber: reference_number || '—',
              cashierName:   cashier_name,
              dateTime,
            }),
          }),
        })
        const ed = await er.json()
        console.log('resend:', er.status, JSON.stringify(ed))
        results.email = er.ok
          ? { success: true, id: ed.id, to: email }
          : { success: false, error: JSON.stringify(ed) }
        if (!er.ok) results.errors.push(`Email: ${JSON.stringify(ed)}`)
      } else {
        results.errors.push('vendor email not found')
      }
    } else {
      results.errors.push('RESEND_API_KEY missing')
    }

    // 3. Web Push via web-push library ────────────────────────────────────────
    const { data: subs } = await (supabase.from('push_subscriptions' as any) as any)
      .select('*').eq('user_id', vendor_user_id)
    console.log('push subs found:', subs?.length ?? 0)

    if (!VP || !VK) {
      results.push = { success: false, reason: !VP ? 'VAPID_PRIVATE_KEY not set' : 'VAPID_PUBLIC_KEY not set' }
    } else if (!subs?.length) {
      results.push = { success: false, reason: 'no push subscriptions — vendor has not enabled push notifications' }
    } else {
      const payload = JSON.stringify({
        title: `✅ Payment Confirmed — ${fmt(Number(amount))}`,
        body:  `${period} · Stall ${stall_number} · ${ML[payment_method] || payment_method}`,
        data: {
          type:             'payment_confirmed',
          amount,
          period,
          receipt_number,
          reference_number,
          url:              '/vendor/notifications',
        },
      })

      let sent = 0
      for (const sub of subs) {
        try {
          const sd = typeof sub.subscription === 'string'
            ? JSON.parse(sub.subscription) : sub.subscription

          if (!sd?.endpoint || !sd?.keys?.p256dh || !sd?.keys?.auth) {
            console.error('bad sub keys for sub id:', sub.id)
            continue
          }

          const r = await sendPush(
            { endpoint: sd.endpoint, keys: sd.keys },
            payload,
            VK, VP,
            VAPID_SUBJECT
          )
          console.log('push result:', r.status, r.body.slice(0, 100))

          if (r.ok) {
            sent++
          } else {
            results.errors.push(`push ${r.status}: ${r.body}`)
            // Auto-clean expired/invalid subscriptions
            if (r.status === 410 || r.status === 404) {
              await (supabase.from('push_subscriptions' as any) as any)
                .delete().eq('id', sub.id)
              console.log('removed expired subscription:', sub.id)
            }
          }
        } catch(e) {
          console.error('push send err:', e)
          results.errors.push(`push exception: ${String(e)}`)
        }
      }
      results.push = { success: sent > 0, sent, total: subs.length }
    }

    console.log('done:', JSON.stringify(results))
    return new Response(
      JSON.stringify({ success: true, results }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch(e: any) {
    console.error('fatal:', e)
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})