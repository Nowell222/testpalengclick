import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Search, MoreHorizontal, Shield, Store, Banknote, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const roleIcons = { vendor: Store, cashier: Banknote, admin: Shield };

const AdminUserManagement = () => {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    first_name: "", middle_name: "", last_name: "", address: "",
    contact_number: "", stall_number: "", section: "General", role: "vendor" as "vendor" | "cashier",
    email: "", password: "",
  });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }, { data: vendors }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("vendors").select("user_id, stalls(stall_number)"),
      ]);

      if (!profiles) return [];

      return profiles.map(p => {
        const userRole = roles?.find(r => r.user_id === p.user_id);
        const vendorInfo = vendors?.find(v => v.user_id === p.user_id);
        return {
          id: p.user_id,
          name: `${p.first_name} ${p.last_name}`,
          role: userRole?.role || "vendor",
          stall: (vendorInfo?.stalls as any)?.stall_number || "—",
          contact: p.contact_number || "—",
          status: p.status,
        };
      });
    },
  });

  const createUser = useMutation({
    mutationFn: async () => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(form.email.trim())) throw new Error("Please enter a valid email address");
      if (form.password.length < 6) throw new Error("Password must be at least 6 characters");
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("create-user", {
        body: {
          email: form.email.trim(),
          password: form.password,
          first_name: form.first_name,
          middle_name: form.middle_name,
          last_name: form.last_name,
          contact_number: form.contact_number,
          address: form.address,
          role: form.role,
          stall_number: form.stall_number,
          section: form.section,
        },
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: async () => {
      toast.success("Account created successfully!");
      // Small delay to let the DB trigger complete profile/role creation
      await new Promise(r => setTimeout(r, 500));
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setShowCreate(false);
      setForm({ first_name: "", middle_name: "", last_name: "", address: "", contact_number: "", stall_number: "", section: "General", role: "vendor", email: "", password: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = users.filter((u: any) =>
    u.name.toLowerCase().includes(search.toLowerCase()) || u.stall.includes(search)
  );

  const toggleStatus = useMutation({
    mutationFn: async ({ userId, newStatus }: { userId: string; newStatus: string }) => {
      const { error } = await supabase.from("profiles").update({ status: newStatus }).eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Status updated");
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">User Management</h1>
          <p className="text-sm text-muted-foreground">Create, update, and manage vendor and cashier accounts</p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)}>
          <UserPlus className="mr-2 h-4 w-4" /> Create Account
        </Button>
      </div>

      {showCreate && (
        <div className="rounded-2xl border bg-card p-6 shadow-civic">
          <h3 className="mb-4 font-semibold text-foreground">Create New Account</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Email *</Label>
              <Input placeholder="email@example.com" className="h-11 rounded-xl" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Password *</Label>
              <Input type="password" placeholder="Min 6 characters" className="h-11 rounded-xl" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Role *</Label>
              <select className="h-11 w-full rounded-xl border bg-background px-3 text-sm" value={form.role} onChange={e => setForm({ ...form, role: e.target.value as any })}>
                <option value="vendor">Vendor</option>
                <option value="cashier">Cashier</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>First Name *</Label>
              <Input placeholder="First name" className="h-11 rounded-xl" value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Middle Name</Label>
              <Input placeholder="Middle name" className="h-11 rounded-xl" value={form.middle_name} onChange={e => setForm({ ...form, middle_name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Last Name *</Label>
              <Input placeholder="Last name" className="h-11 rounded-xl" value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Address</Label>
              <Input placeholder="Address" className="h-11 rounded-xl" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Contact Number</Label>
              <Input placeholder="09XX XXX XXXX" className="h-11 rounded-xl" value={form.contact_number} onChange={e => setForm({ ...form, contact_number: e.target.value })} />
            </div>
            {form.role === "vendor" && (
              <>
                <div className="space-y-1.5">
                  <Label>Stall Number *</Label>
                  <Input placeholder="e.g. A-042" className="h-11 rounded-xl" value={form.stall_number} onChange={e => setForm({ ...form, stall_number: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Section</Label>
                  <select className="h-11 w-full rounded-xl border bg-background px-3 text-sm" value={form.section} onChange={e => setForm({ ...form, section: e.target.value })}>
                    <option>General</option>
                    <option>Fish</option>
                    <option>Meat</option>
                    <option>Vegetables</option>
                    <option>Dry Goods</option>
                    <option>Bolante</option>
                  </select>
                </div>
              </>
            )}
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={() => createUser.mutate()} disabled={createUser.isPending}>
              {createUser.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Account
            </Button>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search by name or stall..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-11 pl-10 rounded-xl" />
      </div>

      <div className="rounded-2xl border bg-card shadow-civic overflow-x-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-secondary/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Role</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Stall</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Contact</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((u: any) => {
                const Icon = roleIcons[u.role as keyof typeof roleIcons] || Store;
                return (
                  <tr key={u.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{u.name}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground capitalize">
                        <Icon className="h-3.5 w-3.5" /> {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-foreground">{u.stall}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.contact}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleStatus.mutate({ userId: u.id, newStatus: u.status === "active" ? "suspended" : "active" })}
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold cursor-pointer ${u.status === "active" ? "bg-success/10 text-success" : "bg-accent/10 text-accent"}`}
                      >
                        {u.status === "active" ? "Active" : "Suspended"}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No users found</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default AdminUserManagement;
