// supabase/functions/ocr-receipt/index.ts
// Accepts a base64 image, sends to Claude Vision, extracts receipt data

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const { image_base64, media_type } = await req.json()

    if (!image_base64) {
      return new Response(JSON.stringify({ error: 'image_base64 is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
    if (!ANTHROPIC_KEY) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not set' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const prompt = `You are extracting data from a Philippine payment receipt screenshot (GCash, Maya, bank transfer, InstaPay, etc.).

Extract the following fields and return ONLY a valid JSON object, no other text:

{
  "reference_number": "the transaction/reference/confirmation number (string or null)",
  "amount": "the amount paid as a number without currency symbol (number or null)",
  "datetime": "date and time of transaction as a string (string or null)",
  "recipient": "recipient name, account name, or phone number that received the payment (string or null)",
  "sender": "sender name or account if visible (string or null)",
  "confidence": "your confidence level: high | medium | low"
}

Rules:
- Return ONLY the JSON, no markdown, no explanation
- If a field is not visible or unclear, set it to null
- For amount, extract the numeric value only (e.g. 1450.00 not ₱1,450.00)
- For reference_number, look for: Reference No., Ref No., Transaction ID, Confirmation No., Control No.
- For recipient, look for: "To", "Send To", "Recipient", account name, or phone number of the recipient`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: media_type || 'image/jpeg',
                data: image_base64,
              }
            },
            { type: 'text', text: prompt }
          ]
        }]
      })
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('Claude API error:', response.status, err)
      return new Response(JSON.stringify({ error: 'Claude API error', details: err }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const claudeData = await response.json()
    const rawText = claudeData.content?.[0]?.text ?? ''
    console.log('Claude raw response:', rawText)

    // Parse the JSON response from Claude
    let extracted: any = {}
    try {
      // Strip any accidental markdown fences
      const cleaned = rawText.replace(/```json|```/g, '').trim()
      extracted = JSON.parse(cleaned)
    } catch (e) {
      console.error('JSON parse failed:', e, rawText)
      extracted = { reference_number: null, amount: null, datetime: null, recipient: null, sender: null, confidence: 'low' }
    }

    return new Response(JSON.stringify({ success: true, extracted, raw: rawText }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (e: any) {
    console.error('ocr-receipt fatal:', e)
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})