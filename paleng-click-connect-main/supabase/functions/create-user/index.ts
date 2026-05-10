import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
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
    const { _action, email, password, first_name, middle_name, last_name, contact_number, address, role, stall_number, section, location: stallLocation, monthly_rate, area_measurement, monthly_rate_2026, monthly_rate_2027, monthly_rate_2028, user_id } = body

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

      if (_action === 'reset-password') {
        const { data: adminRole } = await supabaseAdmin.from('user_roles').select('role').eq('user_id', caller.id).eq('role', 'admin').single();
        if (!adminRole) {
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

    if (role === 'vendor' && (effectiveRate === null || isNaN(effectiveRate) || effectiveRate <= 0)) {
      return new Response(JSON.stringify({ error: `Monthly fee is required for vendor accounts (received: ${monthly_rate})` }), {
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

    // Update profile with extra fields
    await supabaseAdmin
      .from('profiles')
      .update({ middle_name, contact_number, address })
      .eq('user_id', newUser.user.id)

    // If vendor, create stall and vendor record
    if (role === 'vendor') {
      if (!stall_number || !stall_number.trim()) {
        await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
        return new Response(JSON.stringify({ error: 'Stall number is required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const cleanStallNumber = stall_number.trim()
      let stallId: string | null = null

      const { data: existingStall } = await supabaseAdmin
        .from('stalls')
        .select('id')
        .eq('stall_number', cleanStallNumber)
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
          return new Response(JSON.stringify({ error: 'Failed to create stall' }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        stallId = newStall.id
      }

      await supabaseAdmin.from('stall_fee_schedules').delete().eq('stall_id', stallId)
      await supabaseAdmin.from('vendors').insert({ user_id: newUser.user.id, stall_id: stallId, award_date: new Date().toISOString().split('T')[0] })
    }

    return new Response(JSON.stringify({ success: true, user_id: newUser.user.id }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})