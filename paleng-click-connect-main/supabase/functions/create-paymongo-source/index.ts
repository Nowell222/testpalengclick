// supabase/functions/create-paymongo-source/index.ts
// Called by the frontend to create a PayMongo payment source.
// Returns: { id, checkout_url, status }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    // ── Auth: verify the calling user is a vendor ──────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    // ── Parse request body ─────────────────────────────────────────────────
    const body = await req.json();
    const { amount, currency = "PHP", type, payment_db_id, description, redirect } = body;

    if (!amount || !type || !payment_db_id) {
      return json({ error: "Missing required fields: amount, type, payment_db_id" }, 400);
    }

    const PAYMONGO_SECRET = Deno.env.get("PAYMONGO_SECRET_KEY");
    if (!PAYMONGO_SECRET) return json({ error: "PayMongo not configured" }, 500);

    // ── Create PayMongo Source ─────────────────────────────────────────────
    // Amount in PayMongo is in centavos (multiply by 100)
    const amountCentavos = Math.round(Number(amount) * 100);

    const pmRes = await fetch("https://api.paymongo.com/v1/sources", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${btoa(PAYMONGO_SECRET + ":")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: {
          attributes: {
            amount:   amountCentavos,
            currency,
            type,
            description: description || "Paleng-Click stall fee",
            redirect: {
              success: redirect?.success || "https://palengclick.vercel.app/vendor/pay?status=success",
              failed:  redirect?.failed  || "https://palengclick.vercel.app/vendor/pay?status=failed",
            },
            metadata: {
              payment_db_id,
              user_id: user.id,
            },
          },
        },
      }),
    });

    const pmData = await pmRes.json();

    if (!pmRes.ok) {
      console.error("PayMongo error:", JSON.stringify(pmData));
      return json({ error: pmData.errors?.[0]?.detail || "PayMongo API error" }, 502);
    }

    const source = pmData.data;
    const checkoutUrl = source.attributes.redirect?.checkout_url;

    // ── Store the PayMongo source ID in the payment row ───────────────────
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    await supabaseAdmin
      .from("payments")
      .update({ reference_number: source.id })
      .eq("id", payment_db_id);

    return json({
      id:           source.id,
      checkout_url: checkoutUrl,
      status:       source.attributes.status,
    });

  } catch (err) {
    console.error("create-paymongo-source error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}