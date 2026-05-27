import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://testpalengclick.vercel.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 1. Find all payment schedules that are overdue and haven't had a penalty applied
    // (due_date < now() and status = 'pending')
    const { data: overdueSchedules, error: fetchError } = await supabaseClient
      .from("payment_schedules")
      .select("*, stalls(monthly_rate, vendor_id, vendors(user_id, profiles(first_name, email)))")
      .eq("status", "pending")
      .lt("due_date", new Date().toISOString());

    if (fetchError) throw fetchError;

    if (!overdueSchedules || overdueSchedules.length === 0) {
      return new Response(JSON.stringify({ message: "No overdue schedules to process." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    let processedCount = 0;

    for (const schedule of overdueSchedules) {
      // Calculate 25% penalty on the amount due
      const amountDue = Number(schedule.amount_due);
      const penaltyAmount = Number((amountDue * 0.25).toFixed(2));

      // Update the schedule
      const { error: updateError } = await supabaseClient
        .from("payment_schedules")
        .update({
          status: "overdue",
          penalty_amount: penaltyAmount,
          penalty_applied_at: new Date().toISOString(),
        })
        .eq("id", schedule.id);

      if (!updateError) {
        processedCount++;

        // Send a notification to the vendor
        const vendorUserId = schedule.stalls?.vendors?.user_id;
        if (vendorUserId) {
          await supabaseClient.from("notifications").insert({
            user_id: vendorUserId,
            title: "Overdue Payment Notice & Penalty",
            message: `Your payment for ${new Date(schedule.due_date).toLocaleDateString('en-PH', {month: 'long', year: 'numeric'})} is overdue. A penalty of ₱${penaltyAmount} has been applied. Please settle your balance immediately.`,
            type: "overdue"
          });
        }
      }
    }

    return new Response(JSON.stringify({ 
      message: `Successfully processed ${processedCount} overdue schedules.`,
      count: processedCount 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: any) {
    console.error("Error processing penalties:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
