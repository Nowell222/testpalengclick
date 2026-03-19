import { Bell, CreditCard, Megaphone, AlertTriangle, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const typeIcons: Record<string, any> = { reminder: Bell, confirmation: CreditCard, announcement: Megaphone, overdue: AlertTriangle, info: Bell };
const typeStyles: Record<string, string> = { reminder: "bg-primary/10 text-primary", confirmation: "bg-success/10 text-success", announcement: "bg-secondary text-muted-foreground", overdue: "bg-accent/10 text-accent", info: "bg-primary/10 text-primary" };

const VendorNotifications = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["vendor-notifications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("notifications").select("*").eq("user_id", user!.id).order("created_at", { ascending: false });
      return data || [];
    },
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("notifications").update({ read_status: true }).eq("id", id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vendor-notifications"] }),
  });

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
        <p className="text-sm text-muted-foreground">Due reminders, payment confirmations, and announcements</p>
      </div>
      <div className="space-y-3">
        {notifications.map((n: any) => {
          const Icon = typeIcons[n.type] || Bell;
          return (
            <div key={n.id} onClick={() => !n.read_status && markRead.mutate(n.id)}
              className={`rounded-2xl border bg-card p-4 shadow-civic transition-colors cursor-pointer ${!n.read_status ? "border-l-4 border-l-primary" : ""}`}>
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${typeStyles[n.type] || typeStyles.info}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className={`text-sm font-semibold ${!n.read_status ? "text-foreground" : "text-muted-foreground"}`}>{n.title}</h3>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{new Date(n.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{n.message}</p>
                </div>
              </div>
            </div>
          );
        })}
        {notifications.length === 0 && <p className="text-center text-muted-foreground py-8">No notifications yet</p>}
      </div>
    </div>
  );
};

export default VendorNotifications;
