import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const DVLA_URL = 'https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles'
const DVSA_BASE = 'https://history.mot.api.gov.uk/v1/trade/vehicles/registration'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Fetch a short-lived OAuth2 access token from Microsoft Entra
async function getDvsaToken(): Promise<string> {
  const tokenUrl = Deno.env.get('DVSA_TOKEN_URL')!
  const clientId = Deno.env.get('DVSA_CLIENT_ID')!
  const clientSecret = Deno.env.get('DVSA_CLIENT_SECRET')!
  const scope = Deno.env.get('DVSA_SCOPE') ?? 'https://tapi.dvsa.gov.uk/.default'

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope,
  })

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`DVSA token request failed (${res.status}): ${text}`)
  }

  const data = await res.json()
  return data.access_token as string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  try {
    const { registration } = await req.json()
    const plate = registration.replace(/\s/g, '').toUpperCase()

    const dvlaKey = Deno.env.get('DVLA_API_KEY')
    const dvsaApiKey = Deno.env.get('DVSA_API_KEY')
    const dvsaClientId = Deno.env.get('DVSA_CLIENT_ID')

    // ── DVLA: vehicle details (optional — only if key set) ───────────────────
    let vehicleInfo = null
    if (dvlaKey) {
      const dvlaRes = await fetch(DVLA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': dvlaKey },
        body: JSON.stringify({ registrationNumber: plate }),
      })

      if (dvlaRes.ok) {
        const dvla = await dvlaRes.json()
        vehicleInfo = {
          make: toTitle(dvla.make ?? ''),
          colour: toTitle(dvla.colour ?? ''),
          year: dvla.yearOfManufacture ?? null,
          registration: dvla.registrationNumber ?? plate,
          fuelType: dvla.fuelType ?? null,
          motStatus: dvla.motStatus ?? null,
          motExpiryDate: dvla.motExpiryDate ?? null,
          taxStatus: dvla.taxStatus ?? null,
        }
      }
    }

    // ── DVSA: MOT history (OAuth2) ───────────────────────────────────────────
    let motHistory: Record<string, unknown>[] = []

    if (dvsaClientId && dvsaApiKey) {
      const accessToken = await getDvsaToken()

      const dvsaRes = await fetch(`${DVSA_BASE}/${plate}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-API-Key': dvsaApiKey,
        },
      })

      if (dvsaRes.status === 404) {
        // Vehicle not found — return empty history
      } else if (!dvsaRes.ok) {
        const errText = await dvsaRes.text()
        return json({ error: `DVSA API error (${dvsaRes.status}): ${errText}` }, dvsaRes.status)
      } else {
        const dvsaData = await dvsaRes.json()
        const vehicle = Array.isArray(dvsaData) ? dvsaData[0] : dvsaData
        const tests = vehicle?.motTests ?? vehicle?.tests ?? []

        motHistory = tests.map((t: Record<string, unknown>) => ({
          test_date: t.completedDate ?? t.testDate ?? null,
          expiry_date: t.expiryDate ?? null,
          result: String(t.testResult ?? t.result ?? '').toLowerCase().includes('pass') ? 'pass' : 'fail',
          mileage: t.odometerValue ? parseInt(String(t.odometerValue), 10) : null,
          advisory_notes: Array.isArray(t.rfrAndComments)
            ? t.rfrAndComments
                .filter((c: Record<string, unknown>) => String(c.type).toUpperCase() === 'ADVISORY')
                .map((c: Record<string, unknown>) => c.text)
                .join('\n') || null
            : null,
          failure_reasons: Array.isArray(t.rfrAndComments)
            ? t.rfrAndComments
                .filter((c: Record<string, unknown>) => String(c.type).toUpperCase() === 'FAIL')
                .map((c: Record<string, unknown>) => c.text)
                .join('\n') || null
            : null,
        }))
      }
    } else {
      return json({ error: 'DVSA credentials not configured. Set DVSA_CLIENT_ID, DVSA_CLIENT_SECRET, DVSA_API_KEY, and DVSA_TOKEN_URL in Edge Function secrets.' }, 500)
    }

    return json({ vehicle: vehicleInfo, motHistory })

  } catch (err) {
    return json({ error: (err as Error).message }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

function toTitle(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}
