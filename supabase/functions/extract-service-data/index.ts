import Anthropic from 'npm:@anthropic-ai/sdk'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SYSTEM_PROMPT = `You are a vehicle service record extractor. The user will provide one or more documents — receipts, invoices, service sheets, or MOT certificates.

Extract the following information and return ONLY a valid JSON object with these exact keys:
{
  "service_date": "YYYY-MM-DD or null",
  "service_type": "one of: Full Service, Interim Service, Oil & Filter Change, Tyres, Brakes, Clutch, Timing Belt, Battery, MOT, Other",
  "description": "concise summary of what was done, or null",
  "cost": numeric total cost (no currency symbol, e.g. 185.50) or null,
  "provider": "garage or company name, or null",
  "mileage": numeric mileage at time of service or null
}

Rules:
- If multiple documents are provided, merge the information (e.g. invoice + job sheet).
- If a field is not found or unclear, use null.
- For service_type, use your best judgement based on the work described.
- Return ONLY the JSON object — no explanation, no markdown, no code fences.`

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) {
      return json({ error: 'ANTHROPIC_API_KEY not configured in Edge Function secrets.' }, 500)
    }

    const body = await req.json()
    const files: Array<{ name: string; mediaType: string; data: string }> = body.files

    if (!files?.length) {
      return json({ error: 'No files provided.' }, 400)
    }

    // Build Claude message content — each file is an image or document block
    const content: Anthropic.MessageParam['content'] = []

    for (const file of files) {
      const isImage = file.mediaType.startsWith('image/')
      const isPdf = file.mediaType === 'application/pdf'

      if (isImage) {
        content.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: file.mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
            data: file.data,
          },
        })
      } else if (isPdf) {
        content.push({
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: file.data,
          },
        } as Anthropic.DocumentBlockParam)
      } else {
        // Unsupported type — skip
        continue
      }

      content.push({
        type: 'text',
        text: `File: ${file.name}`,
      })
    }

    if (content.length === 0) {
      return json({ error: 'No supported file types found. Use PDF, JPG, PNG, or WEBP.' }, 400)
    }

    content.push({
      type: 'text',
      text: 'Extract the vehicle service record details from the above document(s) and return as JSON.',
    })

    const client = new Anthropic({ apiKey })

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content }],
    })

    const raw = (message.content[0] as Anthropic.TextBlock).text.trim()

    // Parse and validate the JSON response
    let extracted: Record<string, unknown>
    try {
      extracted = JSON.parse(raw)
    } catch {
      return json({ error: 'Could not parse extraction response. Try again.' }, 500)
    }

    return json({ extracted })
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

// Deno serve shim
function serve(handler: (req: Request) => Promise<Response>) {
  Deno.serve(handler)
}
