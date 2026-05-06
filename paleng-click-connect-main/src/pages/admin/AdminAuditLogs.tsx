import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import {
  Loader2, Search, ClipboardList, Shield, Filter, Eye, ChevronRight, X
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const AdminAuditLogs = () => {
  const [search, setSearch] = useState("");
  const [tableFilter, setTableFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [selectedLog, setSelectedLog] = useState<any>(null);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["admin-audit-logs"],
    queryFn: async () => {
      // 1. Fetch the latest 100 audit logs
      const { data: auditData, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      
      if (error) throw error;
      if (!auditData?.length) return [];

      // 2. Extract unique user IDs
      const userIds = [...new Set(auditData.map((log: any) => log.user_id).filter(Boolean))];

      // 3. Fetch profiles for these users
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name")
        .in("user_id", userIds);

      // 4. Map them together
      return auditData.map((log: any) => {
        const pr = profiles?.find((p) => p.user_id === log.user_id);
        return {
          ...log,
          user_name: pr ? `${pr.first_name} ${pr.last_name}` : "System / Unknown",
        };
      });
    },
  });

  const filteredLogs = logs.filter((log: any) => {
    const matchSearch =
      !search ||
      log.user_name.toLowerCase().includes(search.toLowerCase()) ||
      log.record_id.toLowerCase().includes(search.toLowerCase());
    
    const matchTable = tableFilter === "all" || log.table_name === tableFilter;
    const matchAction = actionFilter === "all" || log.action === actionFilter;

    return matchSearch && matchTable && matchAction;
  });

  const getActionColor = (action: string) => {
    switch (action) {
      case "INSERT": return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "UPDATE": return "bg-blue-100 text-blue-700 border-blue-200";
      case "DELETE": return "bg-red-100 text-red-700 border-red-200";
      default: return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  return (
    <div className="space-y-5">
      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl p-6 relative overflow-hidden" style={{background:"linear-gradient(135deg,#0f6e56 0%,#0d5a47 100%)",boxShadow:"0 20px 48px rgba(15,110,86,0.15)"}}>
        {[[200,"-60px","-60px","top","right"],[250,"-100px","-60px","bottom","left"]].map(([sz,a,b,v,h],i)=>(
          <div key={i} style={{position:"absolute",[v as string]:a,[h as string]:b,width:sz,height:sz,borderRadius:"50%",border:"1.5px solid rgba(255,255,255,0.08)",pointerEvents:"none"}}/>
        ))}
        <div style={{position:"absolute",inset:0,pointerEvents:"none",opacity:0.04,backgroundImage:"radial-gradient(circle,#fff 1px,transparent 1px)",backgroundSize:"22px 22px"}}/>
        <div className="relative flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 border border-white/20">
              <Shield className="h-6 w-6 text-emerald-100" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] mb-1" style={{color:"rgba(255,255,255,0.6)"}}>System Security</p>
              <h1 className="text-2xl font-bold text-white">Audit Logs</h1>
              <p className="text-xs mt-1" style={{color:"rgba(255,255,255,0.6)"}}>Track all critical changes made to system data in real-time</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/>
          <Input placeholder="Search by user or record ID…" className="h-10 pl-10 rounded-xl" value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <select className="h-10 rounded-xl border bg-background px-3 text-sm min-w-[150px]" value={tableFilter} onChange={e=>setTableFilter(e.target.value)}>
          <option value="all">All Tables</option>
          <option value="payments">Payments</option>
          <option value="stalls">Stalls</option>
          <option value="vendors">Vendors</option>
          <option value="payment_schedules">Payment Schedules</option>
        </select>
        <select className="h-10 rounded-xl border bg-background px-3 text-sm min-w-[150px]" value={actionFilter} onChange={e=>setActionFilter(e.target.value)}>
          <option value="all">All Actions</option>
          <option value="INSERT">Inserts</option>
          <option value="UPDATE">Updates</option>
          <option value="DELETE">Deletes</option>
        </select>
      </div>

      {/* ── Logs Table ─────────────────────────────────────────────────── */}
      <div className="rounded-2xl border bg-card shadow-civic overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="h-10 w-10 rounded-full flex items-center justify-center bg-emerald-100">
              <Loader2 className="h-5 w-5 animate-spin text-emerald-600"/>
            </div>
            <p className="text-sm text-muted-foreground">Fetching audit trail…</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="px-4 py-3 text-left font-semibold text-slate-500 text-xs uppercase tracking-wider whitespace-nowrap">Timestamp</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-500 text-xs uppercase tracking-wider whitespace-nowrap">User</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-500 text-xs uppercase tracking-wider whitespace-nowrap">Action</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-500 text-xs uppercase tracking-wider whitespace-nowrap">Table</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-500 text-xs uppercase tracking-wider whitespace-nowrap">Record ID</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-500 text-xs uppercase tracking-wider whitespace-nowrap">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredLogs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {format(new Date(log.created_at), "MMM d, yyyy h:mm a")}
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">{log.user_name}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wider ${getActionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">{log.table_name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {log.record_id.substring(0, 8)}...
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-lg" onClick={() => setSelectedLog(log)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-3 text-muted-foreground">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
                          <ClipboardList className="h-7 w-7 text-slate-400"/>
                        </div>
                        <p className="font-semibold text-foreground">No audit logs found</p>
                        <p className="text-xs">Adjust your filters or wait for system activity.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {filteredLogs.length > 0 && (
          <div className="border-t bg-secondary/30 px-5 py-3 text-xs text-muted-foreground text-center">
            Showing latest {filteredLogs.length} events
          </div>
        )}
      </div>

      {/* ── JSON Viewer Modal ────────────────────────────────────────────── */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => setSelectedLog(null)}>
          <div className="bg-card rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b bg-slate-50">
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wider ${getActionColor(selectedLog.action)}`}>
                  {selectedLog.action}
                </span>
                <span className="font-mono font-semibold text-sm">{selectedLog.table_name}</span>
              </div>
              <button onClick={() => setSelectedLog(null)} className="rounded-xl p-2 hover:bg-slate-200 transition-colors"><X className="h-4 w-4 text-slate-500"/></button>
            </div>
            <div className="p-4 overflow-y-auto bg-slate-100 flex-1 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="bg-white p-3 rounded-xl border shadow-sm">
                  <p className="font-bold text-slate-400 mb-1 uppercase tracking-wider text-[10px]">Log ID</p>
                  <p className="font-mono text-slate-700">{selectedLog.id}</p>
                </div>
                <div className="bg-white p-3 rounded-xl border shadow-sm">
                  <p className="font-bold text-slate-400 mb-1 uppercase tracking-wider text-[10px]">Record ID</p>
                  <p className="font-mono text-slate-700">{selectedLog.record_id}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-[300px]">
                {/* Old Data */}
                <div className="flex flex-col border rounded-xl overflow-hidden shadow-sm bg-white">
                  <div className="bg-red-50 text-red-700 px-3 py-2 text-xs font-bold border-b border-red-100 flex items-center justify-between">
                    <span>OLD DATA</span>
                    {selectedLog.action === "INSERT" && <span className="opacity-60 font-normal">Not Applicable</span>}
                  </div>
                  <div className="p-3 flex-1 overflow-auto">
                    <pre className="text-[11px] font-mono text-slate-600">
                      {selectedLog.old_data ? JSON.stringify(selectedLog.old_data, null, 2) : "null"}
                    </pre>
                  </div>
                </div>

                {/* New Data */}
                <div className="flex flex-col border rounded-xl overflow-hidden shadow-sm bg-white">
                  <div className="bg-emerald-50 text-emerald-700 px-3 py-2 text-xs font-bold border-b border-emerald-100 flex items-center justify-between">
                    <span>NEW DATA</span>
                    {selectedLog.action === "DELETE" && <span className="opacity-60 font-normal">Not Applicable</span>}
                  </div>
                  <div className="p-3 flex-1 overflow-auto">
                    <pre className="text-[11px] font-mono text-slate-600">
                      {selectedLog.new_data ? JSON.stringify(selectedLog.new_data, null, 2) : "null"}
                    </pre>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAuditLogs;
