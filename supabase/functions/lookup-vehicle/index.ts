import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const DVLA_URL = 'https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles'
const DVSA_URL = 'https://history.mot.api.gov.uk/v1/trade/vehicles/registration'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  try {
    const { registration } = await req.json()
    const plate = registration.replace(/\s/g, '').toUpperCase()

    const dvlaKey = Deno.env.get('DVLA_API_KEY')
    const dvsaKey = Deno.env.get('DVSA_API_KEY')

    if (!dvlaKey) {
      return json({ error: 'DVLA_API_KEY not configured in Edge Function secrets.' }, 500)
    }

    // ── DVLA: vehicle details ────────────────────────────────────────────────
    const dvlaRes = await fetch(DVLA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': dvlaKey },
      body: JSON.stringify({ registrationNumber: plate }),
    })

    if (!dvlaRes.ok) {
      const err = await dvlaRes.json().catch(() => ({}))
      const msg = err?.errors?.[0]?.detail ?? `DVLA returned ${dvlaRes.status}`
      return json({ error: msg }, dvlaRes.status)
    }

    const dvla = await dvlaRes.json()

    // ── DVSA: MOT history (optional — only if key is configured) ────────────
    let motHistory = []
    if (dvsaKey) {
      const dvsaRes = await fetch(`${DVSA_URL}/${plate}`, {
        headers: { 'x-api-key': dvsaKey },
      })
      if (dvsaRes.ok) {
        const dvsaData = await dvsaRes.json()
        // DVSA returns an array of vehicles; take the first match
        const vehicle = Array.isArray(dvsaData) ? dvsaData[0] : dvsaData
        motHistory = (vehicle?.motTests ?? []).map((t: Record<string, unknown>) => ({
          test_date: t.completedDate,
          expiry_date: t.expiryDate ?? null,
          result: String(t.testResult).toLowerCase() === 'passed' ? 'pass' : 'fail',
          mileage: t.odometerValue ? parseInt(String(t.odometerValue), 10) : null,
          advisory_notes: Array.isArray(t.rfrAndComments)
            ? t.rfrAndComments
                .filter((c: Record<string, unknown>) => c.type === 'ADVISORY')
                .map((c: Record<string, unknown>) => c.text)
                .join('\n')
            : null,
          failure_reasons: Array.isArray(t.rfrAndComments)
            ? t.rfrAndComments
                .filter((c: Record<string, unknown>) => c.type === 'FAIL')
                .map((c: Record<string, unknown>) => c.text)
                .join('\n')
            : null,
        }))
      }
    }

    return json({
      vehicle: {
        make: toTitle(dvla.make ?? ''),
        colour: toTitle(dvla.colour ?? ''),
        year: dvla.yearOfManufacture ?? null,
        registration: dvla.registrationNumber ?? plate,
        fuelType: dvla.fuelType ?? null,
        motStatus: dvla.motStatus ?? null,
        motExpiryDate: dvla.motExpiryDate ?? null,
        taxStatus: dvla.taxStatus ?? null,
      },
      motHistory,
    })
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
