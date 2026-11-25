import { withSupabase } from 'npm:@supabase/server@1'
import { GoogleGenAI } from 'npm:@google/genai'

const apiKey = Deno.env.get('GEMINI_API_KEY')
if (!apiKey) throw new Error('GEMINI_API_KEY is not configured')

const ai = new GoogleGenAI({ apiKey })

export default {
  fetch: withSupabase({ auth: 'publishable' }, async (req, ctx) => {
    const body: unknown = await req.json()
    if (
      typeof body !== 'object' ||
      body === null ||
      !('input' in body) ||
      typeof body.input !== 'string' ||
      !body.input.trim()
    ) {
      return Response.json({ error: 'input must be a non-empty string' }, { status: 400 })
    }

    const res = await ai.models.embedContent({
      model: 'gemini-embedding-2',
      contents: [{ parts: [{ text: body.input }] }],
      config: { outputDimensionality: 768 },
    })
    const embedding = res.embeddings?.[0]?.values
    if (!embedding) throw new Error('Gemini returned no embedding')

    const { error } = await ctx.supabase
      .from('demo_queries')
      .upsert({ q: body.input, embedding })
    if (error) throw error

    return Response.json({ embedding })
  }),
}
