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

    // Verify the caller is an admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { data: { user: caller } } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''))
    if (!caller) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check admin role
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

    const body = await req.json()
    const { email, password, first_name, middle_name, last_name, contact_number, address, role, stall_number, section, location: stallLocation, monthly_rate } = body

    // Debug: log what was received
    console.log('create-user received:', { role, stall_number, monthly_rate, monthly_rate_type: typeof monthly_rate })

    // Server-side validation: monthly_rate required for vendors
    // monthly_rate may come as string, number, or undefined from the form
    const parsedRate = monthly_rate !== undefined && monthly_rate !== null && monthly_rate !== '' 
      ? Number(monthly_rate) 
      : null;
    if (role === 'vendor' && (!parsedRate || parsedRate <= 0)) {
      return new Response(JSON.stringify({ error: 'Monthly fee is required for vendor accounts' }), {
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
      return new Response(JSON.stringify({ error: createError.message }), {
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
      // Stall number is required for vendors
      if (!stall_number || !stall_number.trim()) {
        // Cleanup: delete the auth user we just created
        await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
        return new Response(JSON.stringify({ error: 'Stall number is required for vendor accounts' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const cleanStallNumber = stall_number.trim()
      let stallId: string | null = null

      // Check if stall already exists
      const { data: existingStall, error: stallFetchError } = await supabaseAdmin
        .from('stalls')
        .select('id')
        .eq('stall_number', cleanStallNumber)
        .maybeSingle()

      console.log('stall fetch:', { cleanStallNumber, existingStall, stallFetchError })

      if (existingStall) {
        // Update existing stall
        stallId = existingStall.id
        const { error: updateError } = await supabaseAdmin
          .from('stalls')
          .update({ status: 'occupied', section: section || 'General', location: stallLocation || null, monthly_rate: parsedRate })
          .eq('id', stallId)
        if (updateError) {
          await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
          return new Response(JSON.stringify({ error: 'Failed to update stall: ' + updateError.message }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
      } else {
        // Create new stall
        const { data: newStall, error: insertError } = await supabaseAdmin
          .from('stalls')
          .insert({ stall_number: cleanStallNumber, section: section || 'General', location: stallLocation || null, status: 'occupied', monthly_rate: parsedRate })
          .select('id')
          .single()

        console.log('stall insert:', { newStall, insertError, parsedRate })

        if (insertError || !newStall) {
          await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
          return new Response(JSON.stringify({ error: 'Failed to create stall: ' + (insertError?.message || 'unknown error') }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        stallId = newStall.id
      }

      // Create vendor record linking user to stall
      const { error: vendorError } = await supabaseAdmin
        .from('vendors')
        .insert({ user_id: newUser.user.id, stall_id: stallId, award_date: new Date().toISOString().split('T')[0] })

      console.log('vendor insert:', { stallId, vendorError })

      if (vendorError) {
        await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
        return new Response(JSON.stringify({ error: 'Failed to create vendor record: ' + vendorError.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
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
