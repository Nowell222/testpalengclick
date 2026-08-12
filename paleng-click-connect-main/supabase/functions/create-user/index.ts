// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Verify the caller is authenticated
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { data: { user: caller }, error: callerError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''))
    if (callerError || !caller) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const body = await req.json()
    const { _action, email, password, first_name, middle_name, last_name, contact_number, address, role, stall_number, section, location: stallLocation, monthly_rate, area_measurement, monthly_rate_2026, monthly_rate_2027, monthly_rate_2028, user_id, business_permit_number, award_receipt_number, award_payment_date } = body

    // ── Handle self-service updates (bypassing confirmation) ───────────
    if (_action === 'update-self' || _action === 'reset-password') {
      const targetId = _action === 'update-self' ? caller.id : user_id;

      // If it's update-self, caller must be the target
      // If it's reset-password, caller must be an admin
      if (_action === 'update-self' && targetId !== caller.id) {
        return new Response(JSON.stringify({ error: 'Unauthorized: You can only update your own account' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const { data: roleRes } = await supabaseAdmin.from('user_roles').select('role').eq('user_id', caller.id).single();
      const callerRole = roleRes?.role;

      if (_action === 'update-self' && callerRole === 'vendor' && email) {
        return new Response(JSON.stringify({ error: 'Vendors are not allowed to update their email address' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      if (_action === 'reset-password') {
        if (callerRole !== 'admin') {
          return new Response(JSON.stringify({ error: 'Unauthorized: Admin only' }), {
            status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
      }

      const updates: any = {};
      if (email) updates.email = email;
      if (password) updates.password = password;
      if (email) updates.email_confirm = true; // Bypasses SMTP confirmation

      const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(targetId, updates);

      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      return new Response(JSON.stringify({ success: true, user: updatedUser }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ── Handle BPLO/Admin updating user email ─────────────────────────
    if (_action === 'update-user-email') {
      const { data: roleRes } = await supabaseAdmin.from('user_roles').select('role').eq('user_id', caller.id).single();
      const callerRole = roleRes?.role;

      if (callerRole !== 'admin' && callerRole !== 'bplo') {
        return new Response(JSON.stringify({ error: 'Unauthorized: Admin or BPLO only' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      if (!user_id || !email) {
        return new Response(JSON.stringify({ error: 'User ID and Email are required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const updates: any = {
        email: email.trim().toLowerCase(),
        email_confirm: true, // Bypasses SMTP confirmation
      };

      const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user_id, updates);

      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      return new Response(JSON.stringify({ success: true, user: updatedUser }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ── Handle user deletion ───────────────────────────────────────────
    if (_action === 'delete-user') {
      const { data: adminRole } = await supabaseAdmin.from('user_roles').select('role').eq('user_id', caller.id).eq('role', 'admin').single();
      if (!adminRole) {
        return new Response(JSON.stringify({ error: 'Unauthorized: Admin only' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      if (!user_id) {
        return new Response(JSON.stringify({ error: 'User ID(s) required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const ids = Array.isArray(user_id) ? user_id : [user_id];
      const results = [];

      for (const id of ids) {
        if (id === caller.id) {
          results.push({ id, status: 'error', message: 'Cannot delete yourself' });
          continue;
        }

        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(id);
        if (deleteError) {
          results.push({ id, status: 'error', message: deleteError.message });
        } else {
          results.push({ id, status: 'success' });
        }
      }

      return new Response(JSON.stringify({ success: true, results }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ── Handle fetching stall ownership history ──────────────────────
    if (_action === 'get-stall-history') {
      const p_stall_id = body.p_stall_id || body.stall_id || null;
      const p_vendor_id = body.p_vendor_id || body.vendor_id || null;

      if (!p_stall_id && !p_vendor_id) {
        return new Response(JSON.stringify({ error: 'stall_id or vendor_id is required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      let result: any[] = [];

      // 1. Fetch from stall_ownership_history if stall_id is available
      if (p_stall_id) {
        const { data: historyData } = await supabaseAdmin
          .from('stall_ownership_history')
          .select(`
            id,
            stall_id,
            vendor_id,
            started_at,
            ended_at,
            status,
            vendors (
              id,
              user_id,
              business_permit_number,
              award_receipt_number,
              award_payment_date,
              award_date,
              qr_code,
              closed_at,
              closure_reason,
              closure_notes
            )
          `)
          .eq('stall_id', p_stall_id)
          .order('started_at', { ascending: false });

        result = historyData ? [...historyData] : [];

        // 2. Fallback to querying vendors table if history table is empty
        if (result.length === 0) {
          const { data: directVendors } = await supabaseAdmin
            .from('vendors')
            .select(`
              id,
              user_id,
              business_permit_number,
              award_receipt_number,
              award_payment_date,
              award_date,
              qr_code,
              closed_at,
              closure_reason,
              closure_notes
            `)
            .eq('stall_id', p_stall_id);

          if (directVendors && directVendors.length > 0) {
            result = directVendors.map((v: any) => ({
              id: `hist-direct-${v.id}`,
              stall_id: p_stall_id,
              vendor_id: v.id,
              started_at: v.award_date || new Date().toISOString(),
              ended_at: v.closed_at || null,
              status: v.closed_at ? 'closed' : 'active',
              vendors: v
            }));
          }
        }
      }

      // 3. Bolante vendor support (no stall_id): trace vendor transfer chain via p_vendor_id
      if (result.length === 0 && p_vendor_id) {
        const { data: currVendor } = await supabaseAdmin
          .from('vendors')
          .select(`
            id, user_id, business_permit_number, award_receipt_number,
            award_payment_date, award_date, qr_code, closed_at, closure_reason, closure_notes, transferred_to_vendor_id
          `)
          .eq('id', p_vendor_id)
          .maybeSingle();

        const vendorChain: any[] = [];
        if (currVendor) vendorChain.push(currVendor);

        // Fetch vendors that transferred to this vendor
        const { data: prevVendors } = await supabaseAdmin
          .from('vendors')
          .select(`
            id, user_id, business_permit_number, award_receipt_number,
            award_payment_date, award_date, qr_code, closed_at, closure_reason, closure_notes, transferred_to_vendor_id
          `)
          .eq('transferred_to_vendor_id', p_vendor_id);

        if (prevVendors && prevVendors.length > 0) {
          vendorChain.push(...prevVendors);
        }

        if (vendorChain.length > 0) {
          result = vendorChain.map((v: any) => ({
            id: `hist-bolante-${v.id}`,
            stall_id: null,
            vendor_id: v.id,
            started_at: v.award_date || new Date().toISOString(),
            ended_at: v.closed_at || null,
            status: v.closed_at ? 'closed' : 'active',
            vendors: v
          }));
        }
      }

      // 3. Attach profiles and last payment date
      const userIds = result.map((h: any) => h.vendors?.user_id).filter(Boolean);
      const vendorIds = result.map((h: any) => h.vendor_id).filter(Boolean);

      if (userIds.length > 0) {
        const [profilesRes, paymentsRes] = await Promise.all([
          supabaseAdmin
            .from('profiles')
            .select('user_id, first_name, middle_name, last_name, contact_number, address, status')
            .in('user_id', userIds),
          vendorIds.length > 0
            ? supabaseAdmin
              .from('payments')
              .select('vendor_id, created_at')
              .in('vendor_id', vendorIds)
              .eq('status', 'completed')
              .order('created_at', { ascending: false })
            : Promise.resolve({ data: [], error: null })
        ]);

        const profilesData = profilesRes.data || [];
        const paymentsData = paymentsRes.data || [];

        result = result.map((h: any) => {
          const vendorPayments = paymentsData.filter((p: any) => p.vendor_id === h.vendor_id);
          const lastPaymentDate = vendorPayments.length > 0 ? vendorPayments[0].created_at : null;

          if (h.vendors && h.vendors.user_id) {
            const pr = profilesData.find((p: any) => p.user_id === h.vendors.user_id);
            return {
              ...h,
              vendors: {
                ...h.vendors,
                profiles: pr || null,
                last_payment_date: lastPaymentDate
              }
            };
          }
          return {
            ...h,
            last_payment_date: lastPaymentDate
          };
        });
      }

      result.sort((a: any, b: any) => {
        const aCurrent = !a.ended_at && a.status === 'active';
        const bCurrent = !b.ended_at && b.status === 'active';
        if (aCurrent && !bCurrent) return -1;
        if (!aCurrent && bCurrent) return 1;
        const dateA = new Date(a.started_at || 0).getTime();
        const dateB = new Date(b.started_at || 0).getTime();
        return dateB - dateA;
      });

      return new Response(JSON.stringify({ success: true, history: result }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ── Handle account closure ─────────────────────────────────────────
    if (_action === 'close-user') {
      const { data: adminRole } = await supabaseAdmin.from('user_roles').select('role').eq('user_id', caller.id).eq('role', 'admin').single();
      if (!adminRole) {
        return new Response(JSON.stringify({ error: 'Unauthorized: Admin only' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      if (!user_id) {
        return new Response(JSON.stringify({ error: 'User ID is required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const { closure_reason, closure_notes, transferred_to_vendor_id, transferred_to_app_id } = body;

      // 1. Get vendor stall details to vacate it
      const { data: vendorData, error: fetchErr } = await supabaseAdmin
        .from('vendors')
        .select('id, stall_id')
        .eq('user_id', user_id)
        .maybeSingle();

      if (fetchErr) {
        return new Response(JSON.stringify({ error: fetchErr.message }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // 2. Set profiles status to closed
      const { error: profileErr } = await supabaseAdmin
        .from('profiles')
        .update({ status: 'closed' })
        .eq('user_id', user_id);

      if (profileErr) {
        return new Response(JSON.stringify({ error: profileErr.message }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      let targetVendorId = transferred_to_vendor_id || null;

      // If transferring to a pending application, approve it and create the vendor account first
      if (transferred_to_app_id) {
        // Fetch application details
        const { data: appData, error: appErr } = await supabaseAdmin
          .from('vendor_applications')
          .select('*')
          .eq('id', transferred_to_app_id)
          .single();

        if (appErr || !appData) {
          return new Response(JSON.stringify({ error: `Application not found: ${appErr?.message || 'No data'}` }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        // Create Auth User
        const tempPassword = 'PalengClick123';
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: appData.email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { first_name: appData.first_name, last_name: appData.last_name, role: 'vendor' }
        });

        if (createError) {
          const isEmailTaken = createError.message?.toLowerCase().includes('already registered') || createError.message?.toLowerCase().includes('already been registered')
          return new Response(JSON.stringify({ error: isEmailTaken ? 'Applicant email already exists as a registered user' : createError.message }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        // Insert role into user_roles since DB trigger handle_new_user no longer assigns roles automatically
        const { error: roleError } = await supabaseAdmin
          .from('user_roles')
          .insert({ user_id: newUser.user.id, role: 'vendor' })

        if (roleError) {
          await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
          return new Response(JSON.stringify({ error: `Failed to assign role: ${roleError.message}` }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        // Update profile details
        const { error: profileErr } = await supabaseAdmin
          .from('profiles')
          .update({
            contact_number: appData.phone_number || null,
            address: 'N/A'
          })
          .eq('user_id', newUser.user.id);

        if (profileErr) {
          // Cleanup
          await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
          return new Response(JSON.stringify({ error: `Failed to update profile: ${profileErr.message}` }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        // Create Vendor record (stall_id will be linked in the transfer step below)
        const { data: newVendorData, error: vendorInsertErr } = await supabaseAdmin
          .from('vendors')
          .insert({
            user_id: newUser.user.id,
            stall_id: null,
            award_date: new Date().toISOString().split('T')[0],
            business_permit_number: appData.business_permit_number || null,
            award_receipt_number: appData.award_receipt_number || null,
            award_payment_date: appData.award_payment_date || null
          })
          .select('id')
          .single();

        if (vendorInsertErr || !newVendorData) {
          // Cleanup
          await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
          return new Response(JSON.stringify({ error: `Failed to create vendor record: ${vendorInsertErr?.message || 'No data'}` }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        targetVendorId = newVendorData.id;

        // Update Application Status to approved
        const { error: appUpdateErr } = await supabaseAdmin
          .from('vendor_applications')
          .update({
            status: 'approved',
            reviewed_at: new Date().toISOString(),
            admin_notes: `Approved and registered via Transfer of Ownership from user ${user_id}`
          })
          .eq('id', transferred_to_app_id);

        if (appUpdateErr) {
          console.error("Failed to update application status:", appUpdateErr);
        }

        // Notify Vendor via Edge Function
        try {
          const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
          const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
          await fetch(`${supabaseUrl}/functions/v1/notify-vendor`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${anonKey}`, "apikey": anonKey },
            body: JSON.stringify({
              vendor_user_id: "system-approval",
              _email_only: true,
              _target_email: appData.email,
              _push_title: "Vendor Application Approved!",
              _push_body: `Congratulations! Your vendor application has been approved via Transfer of Ownership.\nTemporary Password: ${tempPassword}\nPlease login to the Vendor Portal to change your password and manage your stall.`
            }),
          });
        } catch (e) {
          console.error("Failed to send approval email", e);
        }
      }

      // 3. Update vendor closure fields and detach stall
      const { error: vendorErr } = await supabaseAdmin
        .from('vendors')
        .update({
          stall_id: null,
          closed_at: new Date().toISOString(),
          closure_reason: closure_reason || 'closed',
          closure_notes: closure_notes || null,
          transferred_to_vendor_id: targetVendorId
        })
        .eq('user_id', user_id);

      if (vendorErr) {
        return new Response(JSON.stringify({ error: vendorErr.message }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      if (vendorData?.stall_id) {
        // Update stall_ownership_history for the closing vendor to set ended_at and status closed
        await supabaseAdmin
          .from('stall_ownership_history')
          .update({ ended_at: new Date().toISOString(), status: 'closed' })
          .eq('vendor_id', vendorData.id)
          .is('ended_at', null);

        // If no history record existed yet for this vendor, insert one
        const { data: existingHist } = await supabaseAdmin
          .from('stall_ownership_history')
          .select('id')
          .eq('vendor_id', vendorData.id)
          .maybeSingle();

        if (!existingHist) {
          await supabaseAdmin
            .from('stall_ownership_history')
            .insert({
              stall_id: vendorData.stall_id,
              vendor_id: vendorData.id,
              started_at: new Date().toISOString(),
              ended_at: new Date().toISOString(),
              status: 'closed'
            });
        }
      }

      // 3.5. If transferring ownership, assign the stall to the new vendor record
      if (targetVendorId && vendorData?.stall_id) {
        const { error: transferErr } = await supabaseAdmin
          .from('vendors')
          .update({ stall_id: vendorData.stall_id })
          .eq('id', targetVendorId);

        if (transferErr) {
          return new Response(JSON.stringify({ error: `Transfer failed: ${transferErr.message}` }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        await supabaseAdmin
          .from('stall_ownership_history')
          .insert({
            stall_id: vendorData.stall_id,
            vendor_id: targetVendorId,
            started_at: new Date().toISOString(),
            status: 'active'
          });
      }

      // 4. Vacate the stall if they had one (only if not transferring to a new owner)
      if (vendorData?.stall_id && !targetVendorId) {
        const { error: stallErr } = await supabaseAdmin
          .from('stalls')
          .update({ status: 'vacant' })
          .eq('id', vendorData.stall_id);

        if (stallErr) {
          return new Response(JSON.stringify({ error: stallErr.message }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
      }

      // 5. Send notification to the user
      await supabaseAdmin.from('notifications').insert({
        user_id,
        title: "🔒 Account Closed",
        message: `Your account has been closed. Reason: ${closure_reason || "Administrative decision."}`,
        type: "overdue"
      });

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ── Check admin role for creation ──
    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id)
      .eq('role', 'admin')
      .single()

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Unauthorized: admin only' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Server-side validation: monthly_rate required for vendors
    const normalizedRate = monthly_rate !== undefined && monthly_rate !== null && monthly_rate !== ''
      ? String(monthly_rate).replace(/,/g, '.').trim()
      : null;
    const parsedRate = normalizedRate ? parseFloat(normalizedRate) : null;

    const parseYearRate = (val: any): number | null => {
      if (val === undefined || val === null || val === '') return null;
      const n = parseFloat(String(val).replace(/,/g, '.').trim());
      return isNaN(n) ? null : n;
    };
    const rate2026 = parseYearRate(monthly_rate_2026);
    const rate2027 = parseYearRate(monthly_rate_2027);
    const rate2028 = parseYearRate(monthly_rate_2028);

    const effectiveRate = parsedRate ?? rate2026;

    const hasStall = stall_number && stall_number.trim().length > 0;
    const isBolante = section && String(section).toLowerCase().includes('bolante');
    if (role === 'vendor' && hasStall && !isBolante && (effectiveRate === null || isNaN(effectiveRate) || effectiveRate <= 0)) {
      return new Response(JSON.stringify({ error: `Monthly fee is required for vendor accounts with an assigned stall (received: ${monthly_rate})` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Create auth user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name, last_name, role }
    })

    if (createError) {
      const isEmailTaken = createError.message?.toLowerCase().includes('already registered') || createError.message?.toLowerCase().includes('already been registered')
      return new Response(JSON.stringify({ error: isEmailTaken ? 'Email already exists' : createError.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Insert role into user_roles since DB trigger handle_new_user no longer assigns roles automatically
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({ user_id: newUser.user.id, role })

    if (roleError) {
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
      return new Response(JSON.stringify({ error: `Failed to assign role: ${roleError.message}` }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Update profile with extra fields
    await supabaseAdmin
      .from('profiles')
      .update({ middle_name, contact_number, address })
      .eq('user_id', newUser.user.id)

    // If vendor, create stall and vendor record
    if (role === 'vendor') {
      const cleanStallNumber = stall_number ? stall_number.trim() : ""
      let stallId: string | null = null

      if (cleanStallNumber) {
        // Case-insensitive lookup
        const { data: existingStall } = await supabaseAdmin
          .from('stalls')
          .select('id, stall_number')
          .ilike('stall_number', cleanStallNumber)
          .maybeSingle()

        if (existingStall) {
          stallId = existingStall.id
          await supabaseAdmin.from('stalls').update({ status: 'occupied', section: section || 'General', location: stallLocation || null, monthly_rate: effectiveRate, area_measurement: area_measurement || null, monthly_rate_2026: rate2026, monthly_rate_2027: rate2027, monthly_rate_2028: rate2028 }).eq('id', stallId)
        } else {
          const { data: newStall, error: insertError } = await supabaseAdmin
            .from('stalls')
            .insert({ stall_number: cleanStallNumber, section: section || 'General', location: stallLocation || null, status: 'occupied', monthly_rate: effectiveRate, area_measurement: area_measurement || null, monthly_rate_2026: rate2026, monthly_rate_2027: rate2027, monthly_rate_2028: rate2028 })
            .select('id')
            .single()

          if (insertError || !newStall) {
            await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
            return new Response(JSON.stringify({ error: `Failed to create stall: ${insertError?.message || 'Unknown error'}` }), {
              status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
          }
          stallId = newStall.id
        }

        await supabaseAdmin.from('stall_fee_schedules').delete().eq('stall_id', stallId)
      }

      const { data: newVendor } = await supabaseAdmin.from('vendors').insert({
        user_id: newUser.user.id,
        stall_id: stallId,
        award_date: new Date().toISOString().split('T')[0],
        business_permit_number: business_permit_number || null,
        award_receipt_number: award_receipt_number || null,
        award_payment_date: award_payment_date || null
      }).select('id').single()

      if (stallId && newVendor?.id) {
        await supabaseAdmin.from('stall_ownership_history').insert({
          stall_id: stallId,
          vendor_id: newVendor.id,
          started_at: new Date().toISOString(),
          status: 'active'
        })
      }

      if (section) {
        const { data: existingApp } = await supabaseAdmin
          .from('vendor_applications')
          .select('id')
          .eq('email', email)
          .maybeSingle();

        if (existingApp) {
          await supabaseAdmin.from('vendor_applications').update({
            applicant_user_id: newUser.user.id,
            preferred_section: section,
            status: 'approved'
          }).eq('id', existingApp.id);
        } else {
          await supabaseAdmin.from('vendor_applications').insert({
            applicant_user_id: newUser.user.id,
            first_name: first_name || '',
            last_name: last_name || '',
            email: email,
            phone_number: contact_number || null,
            preferred_section: section,
            status: 'approved',
            business_permit_number: business_permit_number || null,
            award_receipt_number: award_receipt_number || null,
            award_payment_date: award_payment_date || null
          });
        }
      }
    }

    return new Response(JSON.stringify({ success: true, user_id: newUser.user.id }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    const err = error as any;
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})