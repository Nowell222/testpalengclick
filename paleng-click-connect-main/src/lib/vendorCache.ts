import { supabase } from "@/integrations/supabase/client";

export interface CachedVendor {
  id: string; // vendor id
  user_id: string; // profile user_id
  vendor_name: string;
  first_name: string;
  last_name: string;
  contact_number: string;
  stall_id: string | null;
  stall_number: string;
  section: string;
  area_measurement: string;
  monthly_rate: number;
}

const CACHE_KEY = "palengclick_cached_vendors_directory";

/**
 * Preload and cache all vendors from Supabase into localStorage when online
 */
export const preloadVendorDirectory = async () => {
  if (typeof window === "undefined" || !navigator.onLine) return;

  try {
    const { data: vendors, error: vErr } = await supabase
      .from("vendors")
      .select("id, user_id, stall_id, stalls(id, stall_number, section, area_measurement, monthly_rate)");

    if (vErr || !vendors) return;

    const userIds = [...new Set(vendors.map(v => v.user_id))];
    const { data: profiles, error: pErr } = await supabase
      .from("profiles")
      .select("user_id, first_name, last_name, contact_number")
      .in("user_id", userIds);

    if (pErr) return;

    const cachedList: CachedVendor[] = vendors.map(v => {
      const p = profiles?.find(pr => pr.user_id === v.user_id);
      const st = (v.stalls || {}) as any;
      const firstName = p?.first_name || "";
      const lastName = p?.last_name || "";
      return {
        id: v.id,
        user_id: v.user_id,
        vendor_name: `${firstName} ${lastName}`.trim() || "Unknown Vendor",
        first_name: firstName,
        last_name: lastName,
        contact_number: p?.contact_number || "",
        stall_id: v.stall_id || null,
        stall_number: st?.stall_number || "—",
        section: st?.section || "General",
        area_measurement: st?.area_measurement || "—",
        monthly_rate: st?.monthly_rate || 1450,
      };
    });

    localStorage.setItem(CACHE_KEY, JSON.stringify(cachedList));
    return cachedList;
  } catch (err) {
    console.warn("Failed to cache vendor directory:", err);
  }
};

/**
 * Search vendors offline from localStorage cache
 */
export const searchCachedVendors = (term: string): CachedVendor[] => {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(CACHE_KEY);
  if (!raw) return [];

  try {
    const vendors: CachedVendor[] = JSON.parse(raw);
    const q = term.toLowerCase().trim();
    if (!q) return vendors;

    return vendors.filter(v => 
      v.vendor_name.toLowerCase().includes(q) ||
      v.first_name.toLowerCase().includes(q) ||
      v.last_name.toLowerCase().includes(q) ||
      v.stall_number.toLowerCase().includes(q) ||
      v.section.toLowerCase().includes(q) ||
      v.contact_number.includes(q)
    );
  } catch (e) {
    return [];
  }
};

/**
 * Get cached vendors directory
 */
export const getCachedVendorsDirectory = (): CachedVendor[] => {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(CACHE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
};
