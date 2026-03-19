import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

// Firebase setup would go here if using Admin SDK, 
// but for a simple scaffold, we'll show how to fetch tokens and trigger.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { record } = await req.json()
    const { ontvanger_id, title, bericht } = record

    // 1. Zoek tokens van de ontvanger
    let tokens: string[] = []
    
    if (ontvanger_id === 'all') {
      const { data } = await supabaseClient.from('user_push_tokens').select('token')
      tokens = data?.map(d => d.token) || []
    } else {
      const { data } = await supabaseClient
        .from('user_push_tokens')
        .select('token')
        .eq('user_id', ontvanger_id)
      tokens = data?.map(d => d.token) || []
    }

    if (tokens.length === 0) {
      return new Response(JSON.stringify({ message: 'No tokens found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Verstuur via FCM (Hier zou de echte FCM fetch call komen)
    // De gebruiker moet hiervoor hun Firebase Service Account Key instellen in Supabase secrets.
    
    console.log(`Sending notification to ${tokens.length} devices...`)

    return new Response(JSON.stringify({ success: true, devicesCount: tokens.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
