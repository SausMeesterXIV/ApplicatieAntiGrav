import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { JWT } from "npm:google-auth-library@9"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const serviceAccountStr = Deno.env.get('GOOGLE_SERVICE_ACCOUNT')
    if (!serviceAccountStr) throw new Error('Secret GOOGLE_SERVICE_ACCOUNT not found')
    const serviceAccount = JSON.parse(serviceAccountStr)

    const client = new JWT({
      email: serviceAccount.client_email,
      key: serviceAccount.private_key,
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive'
      ],
    })

    const { command, payload } = await req.json()
    const token = await client.getAccessToken()
    const authHeader = { 'Authorization': `Bearer ${token.token}`, 'Content-Type': 'application/json' }

    let result: any = {}

    if (command === 'create_spreadsheet') {
      // 1. Create Spreadsheet
      const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: authHeader,
        body: JSON.stringify({ properties: { title: payload.title } })
      })
      const sheetData = await res.json()
      if (sheetData.error) throw new Error(`Sheets API (create): ${sheetData.error.message} | Details: ${JSON.stringify(sheetData.error)}`)
      
      const spreadsheetId = sheetData.spreadsheetId

      // 2. Share with user
      if (payload.shareWithEmail) {
        const driveRes = await fetch(`https://www.googleapis.com/drive/v3/files/${spreadsheetId}/permissions`, {
          method: 'POST',
          headers: authHeader,
          body: JSON.stringify({
            role: 'writer',
            type: 'user',
            emailAddress: payload.shareWithEmail
          })
        })
        const driveData = await driveRes.json()
        if (driveData.error) throw new Error(`Drive API (share): ${driveData.error.message} | Details: ${JSON.stringify(driveData.error)}`)
        
        result = { spreadsheetId, shared: true }
      } else {
        result = { spreadsheetId }
      }

    } else if (command === 'add_sheet') {
      const { spreadsheetId, title } = payload
      const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: authHeader,
        body: JSON.stringify({
          requests: [{ addSheet: { properties: { title } } }]
        })
      })
      result = await res.json()
      
      if (result.error) {
        if (result.error.message.includes('already exists')) {
          // If already exists, find the ID of the existing sheet with that title
          const getRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`, { headers: authHeader })
          const meta = await getRes.json()
          const sheet = meta.sheets?.find((s: any) => s.properties.title === title)
          result = { success: true, message: 'Sheet already exists', sheetId: sheet?.properties.sheetId }
        } else {
          throw new Error(`Sheets API (add_sheet): ${result.error.message} | Details: ${JSON.stringify(result.error)}`)
        }
      } else {
        // Return the new sheetId
        result = { success: true, sheetId: result.replies[0].addSheet.properties.sheetId }
      }

    } else if (command === 'update_values') {
      let { spreadsheetId, range, values, sheetId } = payload
      
      // If sheetId is provided, resolve the current title
      if (sheetId) {
        const getRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`, { headers: authHeader })
        const meta = await getRes.json()
        const sheet = meta.sheets?.find((s: any) => String(s.properties.sheetId) === String(sheetId))
        if (!sheet) throw new Error(`Sheet with ID ${sheetId} not found in spreadsheet`)
        const currentTitle = sheet.properties.title
        // Rebuild range with the current title (assuming A1 if not specified in range)
        range = `'${currentTitle}'!${range.includes('!') ? range.split('!')[1] : 'A1'}`
      }

      const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        headers: authHeader,
        body: JSON.stringify({ values })
      })
      result = await res.json()
      if (result.error) throw new Error(`Sheets API (update_values): ${result.error.message} | Details: ${JSON.stringify(result.error)}`)
    } else if (command === 'backup_spreadsheet') {
      const { spreadsheetId, title } = payload
      const backupTitle = title || `Backup_${new Date().toISOString().split('T')[0]}`
      
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${spreadsheetId}/copy`, {
        method: 'POST',
        headers: authHeader,
        body: JSON.stringify({ name: backupTitle })
      })
      
      result = await res.json()
      if (result.error) throw new Error(`Drive API (backup): ${result.error.message}`)
      console.log(`Backup created: ${result.id}`)
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    })
  }
})