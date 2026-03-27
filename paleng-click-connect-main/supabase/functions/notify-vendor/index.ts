import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const fmt = (n: number) => `₱${Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`

const MONTHS = ['January','February','March','April','May','June',
  'July','August','September','October','November','December']

// ── Build HTML receipt email ─────────────────────────────────────────────────
const buildEmailHTML = (data: {
  vendorName: string
  stallNumber: string
  section: string
  amount: number
  period: string
  paymentMethod: string
  paymentType: string
  receiptNumber: string
  referenceNumber: string
  cashierName: string
  dateTime: string
}) => `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Payment Receipt — PALENG-CLICK</title>
</head>
<body style="margin:0;padding:0;background:#f8f5f0;font-family:Georgia,'Times New Roman',serif;">
  <div style="max-width:560px;margin:32px auto;background:#ffffff;border:1px solid #ddd5c5;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(26,46,26,0.08);">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1a4a2e,#2d7a4f);padding:32px 40px;text-align:center;">
      <div style="height:3px;background:linear-gradient(90deg,transparent,#c9a84c,#e8c86e,#c9a84c,transparent);margin:-32px -40px 24px;"></div>
      <p style="color:rgba(240,230,200,0.7);font-size:10px;letter-spacing:3px;text-transform:uppercase;margin:0 0 6px;">Republic of the Philippines</p>
      <p style="color:#f0e6c8;font-size:14px;font-weight:700;margin:0 0 4px;">Municipality of San Juan, Batangas</p>
      <p style="color:rgba(240,230,200,0.6);font-size:10px;letter-spacing:1px;margin:0 0 16px;">Office of the Municipal Treasurer · Public Market Division</p>
      <h1 style="color:#e8c86e;font-size:22px;font-weight:700;letter-spacing:2px;margin:0;">OFFICIAL RECEIPT</h1>
      <p style="color:rgba(240,230,200,0.5);font-size:11px;margin:6px 0 0;">Payment Confirmation · PALENG-CLICK System</p>
    </div>

    <!-- Success banner -->
    <div style="background:#f0fdf4;border-bottom:1px solid #bbf7d0;padding:16px 40px;display:flex;align-items:center;gap:12px;">
      <div style="width:36px;height:36px;background:#22c55e;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        <span style="color:white;font-size:18px;">✓</span>
      </div>
      <div>
        <p style="color:#166534;font-weight:700;font-size:14px;margin:0;">Payment Successfully Confirmed!</p>
        <p style="color:#4ade80;font-size:12px;margin:4px 0 0;">Your stall fee has been received and processed.</p>
      </div>
    </div>

    <!-- Receipt details -->
    <div style="padding:32px 40px;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px;">
        ${[
          ['Receipt No.',    data.receiptNumber   || '—'],
          ['Reference No.',  data.referenceNumber || '—'],
          ['Date & Time',    data.dateTime],
          ['Vendor',         data.vendorName],
          ['Stall Number',   data.stallNumber],
          ['Section',        data.section],
          ['Billing Period', data.period],
          ['Payment Type',   data.paymentType],
          ['Method',         data.paymentMethod],
          ['Processed by',   data.cashierName],
        ].map(([label, value], i) => `
        <tr style="border-bottom:1px dashed #ede5d5;">
          <td style="padding:10px 0;color:#7a8a7a;width:45%;">${label}</td>
          <td style="padding:10px 0;color:#1a2e1a;font-weight:600;text-align:right;">${value}</td>
        </tr>`).join('')}
      </table>

      <!-- Amount box -->
      <div style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:2px solid #86efac;border-radius:10px;padding:24px;text-align:center;margin-bottom:24px;">
        <p style="color:#4a7a5a;font-size:11px;text-transform:uppercase;letter-spacing:2px;margin:0 0 8px;">Amount Paid</p>
        <p style="color:#166534;font-size:36px;font-weight:700;font-family:monospace;margin:0;">${fmt(data.amount)}</p>
      </div>

      <!-- Signature lines -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px;">
        <div style="text-align:center;border-top:1px solid #1a2e1a;padding-top:8px;">
          <p style="color:#1a2e1a;font-weight:700;font-size:12px;text-transform:uppercase;margin:0;">${data.vendorName}</p>
          <p style="color:#7a8a7a;font-size:11px;margin:4px 0 0;">Vendor / Payor</p>
        </div>
        <div style="text-align:center;border-top:1px solid #1a2e1a;padding-top:8px;">
          <p style="color:#1a2e1a;font-weight:700;font-size:12px;text-transform:uppercase;margin:0;">${data.cashierName}</p>
          <p style="color:#7a8a7a;font-size:11px;margin:4px 0 0;">Cashier / Collector</p>
        </div>
      </div>

      <p style="text-align:center;color:#b0a090;font-size:11px;border-top:1px solid #ede5d5;padding-top:16px;margin:0;">
        This is a computer-generated receipt. Please keep for your records.<br/>
        PALENG-CLICK · Municipality of San Juan, Batangas
      </p>
    </div>
  </div>

  <!-- Footer -->
  <div style="text-align:center;padding:20px;color:#b0a090;font-size:11px;">
    <p style="margin:0;">© 2026 Municipality of San Juan, Batangas · PALENG-CLICK System</p>
    <p style="margin:4px 0 0;">This email was sent to notify you of your market stall fee payment.</p>
  </div>
</body>
</html>`

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
      vendor_name,
      stall_number,
      section,
      amount,
      period_month,
      period_year,
      payment_method,
      payment_type,
      receipt_number,
      reference_number,
      cashier_name,
    } = body

    const period    = period_month ? `${MONTHS[period_month - 1]} ${period_year}` : '—'
    const dateTime  = new Date().toLocaleString('en-PH', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    })
    const methodLabel: Record<string, string> = {
      gcash: 'GCash', paymaya: 'Maya', instapay: 'InstaPay', cash: 'Cash at Cashier'
    }

    const receiptData = {
      vendorName:      vendor_name,
      stallNumber:     stall_number,
      section,
      amount:          Number(amount),
      period,
      paymentMethod:   methodLabel[payment_method] || payment_method,
      paymentType:     payment_type === 'staggered' ? 'Partial Payment' : 'Full Payment',
      receiptNumber:   receipt_number || '—',
      referenceNumber: reference_number || '—',
      cashierName:     cashier_name,
      dateTime,
    }

    const results: any = { email: null, push: null, errors: [] }

    // ── 1. Send email via Resend ────────────────────────────────────────────
    const RESEND_KEY = Deno.env.get('RESEND_API_KEY')
    if (RESEND_KEY) {
      // Get vendor email from auth
      const { data: { users } } = await supabase.auth.admin.listUsers()
      const vendorUser = users?.find(u => u.id === vendor_user_id)
      const vendorEmail = vendorUser?.email

      if (vendorEmail) {
        const emailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from:    'PALENG-CLICK <noreply@palengclick.com>',
            to:      [vendorEmail],
            subject: `✅ Payment Confirmed — ${fmt(Number(amount))} for ${period}`,
            html:    buildEmailHTML(receiptData),
          }),
        })
        const emailData = await emailRes.json()
        if (emailRes.ok) {
          results.email = { success: true, id: emailData.id, to: vendorEmail }
          console.log('Email sent:', emailData.id, 'to', vendorEmail)
        } else {
          results.errors.push(`Email failed: ${emailData.message}`)
          console.error('Email error:', emailData)
        }
      } else {
        results.errors.push('Vendor email not found')
      }
    } else {
      results.errors.push('RESEND_API_KEY not set')
    }

    // ── 2. Send push notification via Web Push ──────────────────────────────
    // Fetch all push subscriptions for this vendor
    const { data: subs } = await (supabase.from('push_subscriptions' as any) as any)
      .select('*')
      .eq('user_id', vendor_user_id)

    if (subs && subs.length > 0) {
      const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')
      const VAPID_PUBLIC  = Deno.env.get('VAPID_PUBLIC_KEY')

      if (VAPID_PRIVATE && VAPID_PUBLIC) {
        const pushPayload = JSON.stringify({
          title: `✅ Payment Confirmed — ${fmt(Number(amount))}`,
          body:  `${period} · ${stall_number} · ${methodLabel[payment_method] || payment_method} · Ref: ${reference_number || '—'}`,
          data:  {
            type:      'payment_confirmed',
            amount,
            period,
            receipt_number,
            reference_number,
            url:       '/vendor/notifications',
          },
        })

        let pushSent = 0
        for (const sub of subs) {
          try {
            // Use web-push compatible endpoint
            const subData = typeof sub.subscription === 'string'
              ? JSON.parse(sub.subscription)
              : sub.subscription

            const webpushRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/web-push-send`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              },
              body: JSON.stringify({
                subscription: subData,
                payload: pushPayload,
                vapidPublicKey: VAPID_PUBLIC,
                vapidPrivateKey: VAPID_PRIVATE,
              }),
            })
            if (webpushRes.ok) pushSent++
          } catch (e) {
            results.errors.push(`Push failed for sub: ${e}`)
          }
        }
        results.push = { success: true, sent: pushSent, total: subs.length }
      } else {
        results.errors.push('VAPID keys not configured')
      }
    } else {
      results.push = { success: false, reason: 'No push subscriptions found for vendor' }
    }

    // ── 3. Save in-app notification (always) ───────────────────────────────
    await supabase.from('notifications').insert({
      user_id: vendor_user_id,
      title:   `✅ Payment Confirmed — ${fmt(Number(amount))}`,
      message: `Your payment has been confirmed by the cashier.\n\nPayment Details:\n• Vendor: ${vendor_name}\n• Stall: ${stall_number} — ${section}\n• Amount Paid: ${fmt(Number(amount))}\n• Billing Period: ${period}\n• Payment Method: ${methodLabel[payment_method] || payment_method}\n• Payment Type: ${payment_type === 'staggered' ? 'Partial Payment' : 'Full Payment'}\n• Receipt No.: ${receipt_number || '—'}\n• Reference No.: ${reference_number || '—'}\n• Processed by: ${cashier_name}\n• Date & Time: ${dateTime}\n\nThank you for your payment!`,
      type:    'confirmation',
    })
    results.in_app = { success: true }

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('notify-vendor error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
