import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Send, Loader2, MessageSquare, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ChatInterfaceProps {
  recipientId: string;
  recipientName: string;
  recipientRole?: string;
  onClose?: () => void;
}

// UUID v5 generator for deterministic thread_id between two users
async function generateThreadId(user1: string, user2: string) {
  // Simple deterministic approach for thread ID: sort the two UUIDs and hash them
  const sorted = [user1, user2].sort().join("");
  const msgUint8 = new TextEncoder().encode(sorted);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  // Format as UUID: 8-4-4-4-12
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export default function ChatInterface({ recipientId, recipientName, recipientRole, onClose }: ChatInterfaceProps) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [threadId, setThreadId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentUserId = session?.user?.id;

  // Initialize thread ID
  useEffect(() => {
    if (currentUserId && recipientId) {
      generateThreadId(currentUserId, recipientId).then(setThreadId);
    }
  }, [currentUserId, recipientId]);

  const { data: messages, isLoading } = useQuery({
    queryKey: ["messages", threadId],
    enabled: !!threadId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("thread_id", threadId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    refetchInterval: 5000, // Poll every 5s
  });

  // Mark as read when messages load
  useEffect(() => {
    if (messages && messages.length > 0 && currentUserId) {
      const unread = messages.filter(m => m.recipient_id === currentUserId && !m.read_at);
      if (unread.length > 0) {
        supabase
          .from("messages")
          .update({ read_at: new Date().toISOString() })
          .in("id", unread.map(m => m.id))
          .then(() => queryClient.invalidateQueries({ queryKey: ["messages", threadId] }));
      }
    }
  }, [messages, currentUserId, queryClient, threadId]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!message.trim() || !threadId || !currentUserId) throw new Error("Invalid message");
      const { error } = await supabase.from("messages").insert({
        thread_id: threadId,
        sender_id: currentUserId,
        recipient_id: recipientId,
        body: message.trim(),
        type: "message"
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["messages", threadId] });
    }
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !sendMutation.isPending) {
      sendMutation.mutate();
    }
  };

  return (
    <div className="flex flex-col h-full bg-card rounded-2xl border shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b bg-secondary/30">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
            {recipientName.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <h3 className="font-semibold text-foreground leading-tight">{recipientName}</h3>
            {recipientRole && (
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{recipientRole}</p>
            )}
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-2 hover:bg-secondary rounded-lg">
            <span className="sr-only">Close</span>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-muted-foreground"><path d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path></svg>
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4" style={{ minHeight: "300px" }}>
        {isLoading ? (
          <div className="flex justify-center items-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : messages?.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <MessageSquare className="h-10 w-10 mb-2 opacity-20" />
            <p className="text-sm">No messages yet.</p>
            <p className="text-xs mt-1">Start a conversation with {recipientName.split(" ")[0]}</p>
          </div>
        ) : (
          messages?.map((msg, index) => {
            const isMe = msg.sender_id === currentUserId;
            const showTime = index === 0 || new Date(msg.created_at).getTime() - new Date(messages[index - 1].created_at).getTime() > 10 * 60 * 1000;

            return (
              <div key={msg.id} className="space-y-1">
                {showTime && (
                  <p className="text-[10px] text-center text-muted-foreground my-3 uppercase tracking-wider">
                    {new Date(msg.created_at).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
                <div className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${isMe
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-secondary text-foreground rounded-tl-sm"
                    }`}>
                    {msg.body}
                  </div>
                </div>
                {isMe && msg.read_at && index === messages.length - 1 && (
                  <p className="text-[10px] text-right text-muted-foreground">Read</p>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-background border-t">
        <form onSubmit={handleSend} className="flex gap-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 rounded-full bg-secondary/50 border-transparent focus-visible:ring-primary focus-visible:bg-background"
          />
          <Button
            type="submit"
            size="icon"
            className="rounded-full h-10 w-10 shrink-0"
            disabled={!message.trim() || sendMutation.isPending}
          >
            {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 ml-0.5" />}
          </Button>
        </form>
      </div>
    </div>
  );
}
