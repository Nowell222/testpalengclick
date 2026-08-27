import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, Loader2, Search, User } from "lucide-react";
import ChatInterface from "@/components/ChatInterface";
import { Input } from "@/components/ui/input";

export default function AdminMessages() {
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [search, setSearch] = useState("");

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-messages-users"],
    queryFn: async () => {
      const { data: profiles } = await supabase.from("profiles").select("*");
      const { data: roles } = await supabase.from("user_roles").select("*");

      return (profiles || []).map(p => {
        const role = roles?.find(r => r.user_id === p.user_id)?.role || "vendor";
        return {
          id: p.user_id,
          name: `${p.first_name} ${p.last_name}`,
          role,
        };
      }).filter(u => u.role === "vendor"); // Admins only chat with vendors usually
    }
  });

  const filteredUsers = users?.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="h-[calc(100vh-140px)] flex gap-4">
      <div className="w-80 flex flex-col bg-card rounded-2xl border shadow-xs overflow-hidden shrink-0">
        <div className="p-3.5 border-b bg-gradient-to-r from-emerald-50/50 to-transparent">
          <div className="flex items-center gap-2 mb-2.5">
            <div className="h-2 w-2 rounded-full bg-emerald-600 shadow-xs" />
            <h2 className="font-bold text-xs text-foreground uppercase tracking-wider">
              Vendor Direct Messages
            </h2>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search vendors..."
              className="pl-8 h-8 rounded-xl bg-background text-xs border"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
            </div>
          ) : filteredUsers?.length === 0 ? (
            <div className="text-center p-6 text-xs text-muted-foreground">No vendors found</div>
          ) : (
            filteredUsers?.map(user => (
              <button
                key={user.id}
                onClick={() => setSelectedUser(user)}
                className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl transition-all text-left ${selectedUser?.id === user.id
                    ? "bg-emerald-50 text-emerald-900 border border-emerald-300 font-semibold shadow-xs"
                    : "hover:bg-secondary/60 text-foreground border border-transparent"
                  }`}
              >
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${selectedUser?.id === user.id ? "bg-emerald-600 text-white shadow-xs" : "bg-secondary text-muted-foreground"
                  }`}>
                  <User className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-xs truncate">{user.name}</p>
                  <p className={`text-[10px] uppercase tracking-wider font-semibold ${selectedUser?.id === user.id ? "text-emerald-700" : "text-muted-foreground"
                    }`}>{user.role}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        {selectedUser ? (
          <ChatInterface
            recipientId={selectedUser.id}
            recipientName={selectedUser.name}
            recipientRole={selectedUser.role}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center bg-card rounded-2xl border shadow-xs text-muted-foreground p-8">
            <div className="h-12 w-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 mb-3 border border-emerald-100">
              <MessageSquare className="h-6 w-6" />
            </div>
            <p className="text-base font-bold text-foreground">Direct Vendor Messages</p>
            <p className="text-xs text-muted-foreground mt-1 text-center max-w-sm">Select a vendor from the left list to view chat history and send direct communications.</p>
          </div>
        )}
      </div>
    </div>
  );
}
