import { withSupabase } from 'npm:@supabase/server@1'
import { GoogleGenAI } from 'npm:@google/genai'

const apiKey = Deno.env.get('GEMINI_API_KEY')
if (!apiKey) throw new Error('GEMINI_API_KEY is not configured')

const ai = new GoogleGenAI({ apiKey })

async function embed(text: string): Promise<number[]> {
  const res = await ai.models.embedContent({
    model: 'gemini-embedding-2',
    contents: [{ parts: [{ text }] }],
    config: { outputDimensionality: 768 },
  })
  const embedding = res.embeddings?.[0]?.values
  if (!embedding) throw new Error('Gemini returned no query embedding')
  return embedding
}

const systemPrompt = `You answer questions about the user's documents.
Use ONLY the numbered context below. Cite sources inline like [1] or [2].
If the answer is not in the context, say "I don't know based on your documents." Never guess.`

export default {
  fetch: withSupabase({ auth: 'publishable' }, async (req, ctx) => {
    const body: unknown = await req.json()
    if (
      typeof body !== 'object' ||
      body === null ||
      !('question' in body) ||
      typeof body.question !== 'string' ||
      !body.question.trim()
    ) {
      return Response.json({ error: 'question must be a non-empty string' }, { status: 400 })
    }

    const question = body.question.trim()
    const queryEmbedding = await embed(question)
    const { data: chunks, error } = await ctx.supabase.rpc('hybrid_search', {
      query_text: question,
      query_embedding: queryEmbedding,
      match_count: 5,
    })
    if (error) throw error

    const sources = chunks ?? []
    const context = sources
      .map((chunk, index) => `[${index + 1}] (${chunk.title})\n${chunk.content}`)
      .join('\n\n')

    const interaction = await ai.interactions.create({
      model: 'gemini-3.5-flash-lite',
      system_instruction: systemPrompt,
      generation_config: { max_output_tokens: 1024 },
      input: `Context:\n${context}\n\nQuestion: ${question}`,
    })

    return Response.json({ answer: interaction.output_text, sources })
  }),
}
