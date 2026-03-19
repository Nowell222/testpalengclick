import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Send, Users, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const AdminSMS = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"send" | "bulk" | "logs">("send");
  const [recipient, setRecipient] = useState("");
  const [messageType, setMessageType] = useState("reminder");
  const [message, setMessage] = useState("");

  const { data: logs = [] } = useQuery({
    queryKey: ["sms-logs"],
    queryFn: async () => {
      const { data } = await supabase.from("sms_logs").select("*").order("sent_at", { ascending: false }).limit(50);
      return data || [];
    },
  });

  const sendSMS = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("sms_logs").insert({
        recipient,
        message,
        type: messageType as any,
        status: "delivered",
        sent_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("SMS logged successfully!");
      queryClient.invalidateQueries({ queryKey: ["sms-logs"] });
      setRecipient("");
      setMessage("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">SMS Management</h1>
        <p className="text-sm text-muted-foreground">Send reminders, confirmations, and announcements to vendors</p>
      </div>

      <div className="flex rounded-xl bg-secondary p-1 max-w-md">
        {(["send", "bulk", "logs"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 rounded-lg py-2 text-sm font-medium capitalize transition-all ${tab === t ? "bg-card text-foreground shadow-civic" : "text-muted-foreground"}`}>
            {t === "send" ? "Single SMS" : t === "bulk" ? "Bulk SMS" : "SMS Logs"}
          </button>
        ))}
      </div>

      {(tab === "send" || tab === "bulk") && (
        <div className="rounded-2xl border bg-card p-6 shadow-civic max-w-lg space-y-4">
          <div className="space-y-1.5">
            <Label>Recipient</Label>
            <Input placeholder="Phone number or vendor name..." className="h-11 rounded-xl" value={recipient} onChange={e => setRecipient(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Message Type</Label>
            <select className="h-11 w-full rounded-xl border bg-background px-3 text-sm" value={messageType} onChange={e => setMessageType(e.target.value)}>
              <option value="reminder">Payment Reminder</option>
              <option value="overdue">Overdue Alert</option>
              <option value="confirmation">Payment Confirmation</option>
              <option value="announcement">Announcement</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Message</Label>
            <Textarea placeholder="Type your message..." className="min-h-[100px] rounded-xl" value={message} onChange={e => setMessage(e.target.value)} />
          </div>
          <Button size="lg" onClick={() => sendSMS.mutate()} disabled={sendSMS.isPending}>
            {sendSMS.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Send SMS
          </Button>
        </div>
      )}

      {tab === "logs" && (
        <div className="rounded-2xl border bg-card shadow-civic overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-secondary/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Recipient</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Sent At</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {logs.map((l: any) => (
                <tr key={l.id} className="hover:bg-secondary/30">
                  <td className="px-4 py-3 font-medium text-foreground">{l.recipient}</td>
                  <td className="px-4 py-3 text-muted-foreground capitalize">{l.type}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${l.status === "delivered" ? "text-success" : "text-accent"}`}>
                      {l.status === "delivered" ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                      {l.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(l.sent_at).toLocaleString()}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No SMS logs yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminSMS;
