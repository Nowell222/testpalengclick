import { Input } from "@/components/ui/input";
import { Search, User, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const CashierSearchVendor = () => {
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const { data: vendors = [], isLoading } = useQuery({
    queryKey: ["cashier-vendors"],
    queryFn: async () => {
      const { data: vendorList } = await supabase.from("vendors").select("id, user_id, stalls(stall_number, section, monthly_rate)");
      if (!vendorList) return [];
      const userIds = vendorList.map(v => v.user_id);
      const { data: profiles } = await supabase.from("profiles").select("user_id, first_name, last_name, contact_number, status").in("user_id", userIds);

      return vendorList.map(v => {
        const profile = profiles?.find(p => p.user_id === v.user_id);
        const stall = v.stalls as any;
        return {
          id: v.id, userId: v.user_id,
          name: `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim(),
          stall: stall?.stall_number || "—", section: stall?.section || "General",
          contact: profile?.contact_number || "—", status: profile?.status || "active",
          monthlyRate: stall?.monthly_rate || 1450,
        };
      });
    },
  });

  const filtered = vendors.filter((v: any) => v.name.toLowerCase().includes(search.toLowerCase()) || v.stall.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-foreground">Search Vendor</h1><p className="text-sm text-muted-foreground">Look up vendor information</p></div>
      <div className="relative max-w-md"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search by name or stall..." className="h-12 pl-10 rounded-xl" value={search} onChange={e => setSearch(e.target.value)} /></div>
      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((v: any) => (
            <div key={v.id} className="rounded-2xl border bg-card p-5 shadow-civic">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary"><User className="h-5 w-5 text-muted-foreground" /></div>
                <div className="flex-1"><p className="font-semibold text-foreground">{v.name}</p><p className="text-xs text-muted-foreground">Stall {v.stall} • {v.section}</p></div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${v.status === "active" ? "bg-success/10 text-success" : "bg-accent/10 text-accent"}`}>{v.status}</span>
                <Button size="sm" onClick={() => navigate(`/cashier/accept?vendorId=${v.id}`)}>Accept Payment</Button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <p className="col-span-full text-center text-muted-foreground py-8">No vendors found</p>}
        </div>
      )}
    </div>
  );
};

export default CashierSearchVendor;
