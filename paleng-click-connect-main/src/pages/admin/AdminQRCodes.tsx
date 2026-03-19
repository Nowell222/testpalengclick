import { Button } from "@/components/ui/button";
import { QrCode, Download, Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";

const AdminQRCodes = () => {
  const [search, setSearch] = useState("");

  const { data: stalls = [], isLoading } = useQuery({
    queryKey: ["admin-qr-codes"],
    queryFn: async () => {
      const { data: vendors } = await supabase
        .from("vendors")
        .select("id, qr_code, user_id, stalls(stall_number, section, status), profiles:user_id(first_name, last_name)")
        .not("stall_id", "is", null);
      
      return (vendors || []).map((v: any) => ({
        stall: v.stalls?.stall_number || "—",
        vendor: `${v.profiles?.first_name || ""} ${v.profiles?.last_name || ""}`.trim(),
        section: v.stalls?.section || "General",
        status: v.stalls?.status === "occupied" ? "Active" : "Vacant",
        qr_code: v.qr_code || "",
      }));
    },
  });

  const filtered = stalls.filter((s: any) =>
    s.vendor.toLowerCase().includes(search.toLowerCase()) || s.stall.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">QR Code Management</h1>
          <p className="text-sm text-muted-foreground">Each vendor stall has a unique QR code for identification and payments</p>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search vendor or stall..." className="h-11 pl-10 rounded-xl" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s: any) => (
            <div key={s.stall} className="rounded-2xl border bg-card p-5 shadow-civic">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-mono text-lg font-bold text-foreground">{s.stall}</p>
                  <p className="text-sm text-muted-foreground">{s.vendor}</p>
                  <p className="text-xs text-muted-foreground">{s.section} Section</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${s.status === "Active" ? "bg-success/10 text-success" : "bg-accent/10 text-accent"}`}>{s.status}</span>
              </div>
              <div className="mt-4 flex items-center justify-center rounded-xl border-2 border-dashed border-muted py-4">
                {s.qr_code ? (
                  <QRCodeSVG value={s.qr_code} size={120} />
                ) : (
                  <QrCode className="h-20 w-20 text-muted-foreground/40" />
                )}
              </div>
              <p className="mt-2 text-center text-[10px] font-mono text-muted-foreground break-all">{s.qr_code}</p>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="col-span-full text-center text-muted-foreground py-8">No vendor QR codes found. Create vendor accounts first.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminQRCodes;
