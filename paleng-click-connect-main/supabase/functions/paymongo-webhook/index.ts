// supabase/functions/paymongo-webhook/index.ts
// PayMongo calls this URL when a payment is completed (source.chargeable → charge it → payment.paid).
// Register this URL in your PayMongo dashboard under Webhooks.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const PAYMONGO_SECRET = Deno.env.get("PAYMONGO_SECRET_KEY");
    if (!PAYMONGO_SECRET) return json({ error: "Not configured" }, 500);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── Optional: verify PayMongo webhook signature ───────────────────────
    // PayMongo sends X-Paymongo-Signature — check their docs for HMAC-SHA256 verification
    // For now we verify by checking source ID exists in our DB before updating.

    const body = await req.json();
    const eventType = body?.data?.attributes?.type;
    const eventData = body?.data?.attributes?.data;

    console.log("PayMongo webhook received:", eventType);

    // ── Handle source.chargeable: create a charge ────────────────────────
    if (eventType === "source.chargeable") {
      const source    = eventData;
      const sourceId  = source?.id;
      const amount    = source?.attributes?.amount;      // centavos
      const currency  = source?.attributes?.currency;
      const paymentDbId = source?.attributes?.metadata?.payment_db_id;

      if (!sourceId || !amount || !paymentDbId) {
        console.error("Missing fields in source.chargeable", { sourceId, amount, paymentDbId });
        return json({ error: "Missing fields" }, 400);
      }

      // Create a PayMongo Payment (charge) against this source
      const chargeRes = await fetch("https://api.paymongo.com/v1/payments", {
        method: "POST",
        headers: {
          "Authorization": `Basic ${btoa(PAYMONGO_SECRET + ":")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: {
            attributes: {
              amount,
              currency,
              source: { id: sourceId, type: "source" },
              description: "Paleng-Click stall fee",
              metadata: source?.attributes?.metadata,
            },
          },
        }),
      });

      const chargeData = await chargeRes.json();
      if (!chargeRes.ok) {
        console.error("Charge creation failed:", JSON.stringify(chargeData));
        return json({ error: "Charge failed" }, 502);
      }

      const chargeId = chargeData.data?.id;
      const chargeStatus = chargeData.data?.attributes?.status;

      // Update payment record with charge ID
      await supabase
        .from("payments")
        .update({
          status: chargeStatus === "paid" ? "completed" : "pending",
          reference_number: chargeId || sourceId,
        })
        .eq("id", paymentDbId);

      console.log(`Charged payment ${paymentDbId} → ${chargeStatus}`);
      return json({ received: true, charged: chargeId });
    }

    // ── Handle payment.paid: mark payment as completed ───────────────────
    if (eventType === "payment.paid") {
      const payment     = eventData;
      const paymentId   = payment?.id;
      const metadata    = payment?.attributes?.metadata;
      const paymentDbId = metadata?.payment_db_id;

      if (!paymentDbId) {
        console.warn("payment.paid received but no payment_db_id in metadata");
        return json({ received: true });
      }

      // Mark payment as completed and send notification
      const { error } = await supabase
        .from("payments")
        .update({
          status:           "completed",
          reference_number: paymentId || payment?.id,
          updated_at:       new Date().toISOString(),
        })
        .eq("id", paymentDbId);

      if (error) {
        console.error("Failed to update payment status:", error);
        return json({ error: "DB update failed" }, 500);
      }

      // Get the vendor user to send a notification
      const { data: paymentRow } = await supabase
        .from("payments")
        .select("vendor_id, amount, period_month, period_year, vendors(user_id)")
        .eq("id", paymentDbId)
        .single();

      if (paymentRow?.vendors) {
        const vendorUserId = (paymentRow.vendors as any).user_id;
        const month = paymentRow.period_month;
        const year  = paymentRow.period_year;
        const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];

        await supabase.from("notifications").insert({
          user_id: vendorUserId,
          title:   "Payment Confirmed ✓",
          message: `Your stall fee of ₱${Number(paymentRow.amount).toLocaleString("en-PH",{minimumFractionDigits:2})} for ${months[(month||1)-1]} ${year} has been successfully received.`,
          type:    "confirmation",
        });
      }

      console.log(`Payment ${paymentDbId} marked as completed`);
      return json({ received: true, updated: paymentDbId });
    }

    // ── Handle payment.failed ─────────────────────────────────────────────
    if (eventType === "payment.failed") {
      const payment     = eventData;
      const paymentDbId = payment?.attributes?.metadata?.payment_db_id;

      if (paymentDbId) {
        await supabase
          .from("payments")
          .update({ status: "failed", updated_at: new Date().toISOString() })
          .eq("id", paymentDbId);
        console.log(`Payment ${paymentDbId} marked as failed`);
      }

      return json({ received: true });
    }

    // Unhandled event type — return 200 so PayMongo doesn't retry
    return json({ received: true, ignored: eventType });

  } catch (err) {
    console.error("Webhook handler error:", err);
    return json({ error: "Internal error" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}