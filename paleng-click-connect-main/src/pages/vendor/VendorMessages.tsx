import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, Loader2 } from "lucide-react";
import ChatInterface from "@/components/ChatInterface";

export default function VendorMessages() {
  const { data: admin, isLoading } = useQuery({
    queryKey: ["admin-contact"],
    queryFn: async () => {
      // Find an admin user
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "admin").limit(1);
      if (!roles || roles.length === 0) return null;

      const adminId = roles[0].user_id;
      const { data: profile } = await supabase.from("profiles").select("*").eq("user_id", adminId).single();

      if (!profile) return { id: adminId, name: "Admin" };
      return { id: adminId, name: `${profile.first_name} ${profile.last_name}` };
    }
  });

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!admin) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center">
        <MessageSquare className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
        <h2 className="text-xl font-bold">Admin Contact Unavailable</h2>
        <p className="text-muted-foreground mt-2">There is currently no admin registered to receive messages.</p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-160px)] lg:h-[calc(100vh-120px)] max-w-4xl mx-auto">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-foreground">Support & Disputes</h1>
        <p className="text-sm text-muted-foreground mt-1">Directly message the admin for concerns or inquiries.</p>
      </div>

      <div className="h-full">
        <ChatInterface
          recipientId={admin.id}
          recipientName={admin.name}
          recipientRole="Admin"
        />
      </div>
    </div>
  );
}
