import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const AdminNews = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const { data: news = [], isLoading } = useQuery({
    queryKey: ["announcements"],
    queryFn: async () => {
      const { data } = await supabase.from("announcements").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const createNews = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("announcements").insert({
        title, content, published_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Announcement published!");
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      setShowCreate(false);
      setTitle("");
      setContent("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteNews = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("announcements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Announcement deleted");
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">News & Updates</h1>
          <p className="text-sm text-muted-foreground">Publish announcements visible to all vendors</p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)}>
          <Plus className="mr-2 h-4 w-4" /> New Announcement
        </Button>
      </div>

      {showCreate && (
        <div className="rounded-2xl border bg-card p-6 shadow-civic max-w-xl space-y-4">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input placeholder="Announcement title" className="h-11 rounded-xl" value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Content</Label>
            <Textarea placeholder="Write your announcement..." className="min-h-[120px] rounded-xl" value={content} onChange={e => setContent(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button onClick={() => createNews.mutate()} disabled={createNews.isPending}>
              {createNews.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Publish
            </Button>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-4">
          {news.map((n: any) => (
            <div key={n.id} className="rounded-2xl border bg-card p-5 shadow-civic">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-foreground">{n.title}</h3>
                  <p className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleDateString()}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteNews.mutate(n.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{n.content}</p>
            </div>
          ))}
          {news.length === 0 && <p className="text-center text-muted-foreground py-8">No announcements yet</p>}
        </div>
      )}
    </div>
  );
};

export default AdminNews;
