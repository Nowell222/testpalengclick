import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
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

    // Get date boundaries for 3 days from now
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 3);
    
    // Start of the target day
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    // End of the target day
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // 1. Find all payment schedules that are pending and due in exactly 3 days
    const { data: upcomingSchedules, error: fetchError } = await supabaseClient
      .from("payment_schedules")
      .select("*, stalls(stall_number, vendors(user_id))")
      .eq("status", "pending")
      .gte("due_date", startOfDay.toISOString())
      .lte("due_date", endOfDay.toISOString());

    if (fetchError) throw fetchError;

    if (!upcomingSchedules || upcomingSchedules.length === 0) {
      return new Response(JSON.stringify({ message: "No upcoming schedules found for reminders." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    let sentCount = 0;

    for (const schedule of upcomingSchedules) {
      const vendorUserId = schedule.stalls?.vendors?.user_id;
      const stallNumber = schedule.stalls?.stall_number;
      const amountDue = Number(schedule.amount_due).toFixed(2);
      const dueDateStr = new Date(schedule.due_date).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });

      if (vendorUserId) {
        // Create an in-app notification
        const { error: notifError } = await supabaseClient.from("notifications").insert({
          user_id: vendorUserId,
          title: "Payment Reminder",
          message: `Friendly reminder: Your stall fee of ₱${amountDue} for Stall ${stallNumber} is due in 3 days on ${dueDateStr}.`,
          type: "reminder"
        });

        if (!notifError) sentCount++;
      }
    }

    return new Response(JSON.stringify({ 
      message: `Successfully sent ${sentCount} reminders.`,
      count: sentCount 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: any) {
    console.error("Error sending reminders:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
