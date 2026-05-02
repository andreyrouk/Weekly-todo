import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  let body: { type: string; payload: { messages: unknown[]; system?: string } };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const { type, payload } = body;
  if (!type || !payload?.messages) {
    return new Response(JSON.stringify({ error: 'Missing type or payload.messages' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const maxTokens = type === 'report' ? 1000 : 200;

  const anthropicBody: Record<string, unknown> = {
    model: 'claude-sonnet-4-20250514',
    max_tokens: maxTokens,
    messages: payload.messages,
  };
  if (payload.system) anthropicBody.system = payload.system;

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(anthropicBody),
    });

    const json = await resp.json();
    if (!resp.ok) {
      return new Response(JSON.stringify({ error: json.error?.message || `API error ${resp.status}` }), {
        status: resp.status, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const result = json.content?.[0]?.text || '';
    return new Response(JSON.stringify({ result }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
