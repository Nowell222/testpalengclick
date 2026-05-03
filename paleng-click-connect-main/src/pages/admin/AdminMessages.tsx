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
    <div className="h-[calc(100vh-120px)] flex gap-4">
      <div className="w-80 flex flex-col bg-card rounded-2xl border shadow-sm overflow-hidden shrink-0">
        <div className="p-4 border-b bg-secondary/30">
          <h2 className="font-bold text-foreground mb-3 flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Messages
          </h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search vendors..."
              className="pl-9 h-9 rounded-xl bg-background border-transparent focus-visible:ring-primary"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filteredUsers?.length === 0 ? (
            <div className="text-center p-4 text-sm text-muted-foreground">No users found</div>
          ) : (
            filteredUsers?.map(user => (
              <button
                key={user.id}
                onClick={() => setSelectedUser(user)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left ${selectedUser?.id === user.id
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-secondary/50 text-foreground"
                  }`}
              >
                <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${selectedUser?.id === user.id ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                  }`}>
                  <User className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{user.name}</p>
                  <p className={`text-[10px] uppercase tracking-wider font-semibold ${selectedUser?.id === user.id ? "text-primary/70" : "text-muted-foreground"
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
          <div className="h-full flex flex-col items-center justify-center bg-card rounded-2xl border shadow-sm text-muted-foreground">
            <MessageSquare className="h-12 w-12 mb-4 opacity-20" />
            <p className="text-lg font-medium text-foreground">Your Messages</p>
            <p className="text-sm mt-1">Select a vendor from the sidebar to start chatting</p>
          </div>
        )}
      </div>
    </div>
  );
}
