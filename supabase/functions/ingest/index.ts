import { withSupabase } from 'npm:@supabase/server@1'
import { GoogleGenAI } from 'npm:@google/genai'

const apiKey = Deno.env.get('GEMINI_API_KEY')
if (!apiKey) throw new Error('GEMINI_API_KEY is not configured')

const ai = new GoogleGenAI({ apiKey })

async function embed(texts: string[]): Promise<number[][]> {
  const res = await ai.models.embedContent({
    model: 'gemini-embedding-2',
    contents: texts.map((text) => ({ parts: [{ text }] })),
    config: { outputDimensionality: 768 },
  })
  const embeddings: number[][] = []
  for (const result of res.embeddings ?? []) {
    if (!result.values) throw new Error('Gemini returned an empty chunk embedding')
    embeddings.push(result.values)
  }
  if (embeddings.length !== texts.length) {
    throw new Error('Gemini did not return an embedding for every chunk')
  }
  return embeddings
}

function chunkMarkdown(text: string, maxLen = 1000, overlap = 150): string[] {
  const sections = text.split(/\n(?=#{1,3} )/)
  const chunks: string[] = []
  for (const section of sections) {
    for (let start = 0; start < section.length; start += maxLen - overlap) {
      chunks.push(section.slice(start, start + maxLen).trim())
      if (start + maxLen >= section.length) break
    }
  }
  return chunks.filter((chunk) => chunk.length > 0)
}

export default {
  fetch: withSupabase({ auth: 'publishable' }, async (req, ctx) => {
    const body: unknown = await req.json()
    if (
      typeof body !== 'object' ||
      body === null ||
      !('title' in body) ||
      typeof body.title !== 'string' ||
      !body.title.trim() ||
      !('content' in body) ||
      typeof body.content !== 'string' ||
      !body.content.trim()
    ) {
      return Response.json({ error: 'title and non-empty content are required' }, { status: 400 })
    }

    const { data: doc, error: documentError } = await ctx.supabase
      .from('documents')
      .insert({ title: body.title.trim() })
      .select()
      .single()
    if (documentError) throw documentError

    const chunks = chunkMarkdown(body.content)
    const embeddings = await embed(chunks)
    const rows = chunks.map((content, index) => ({
      document_id: doc.id,
      chunk_index: index,
      content,
      embedding: embeddings[index],
    }))
    const { error: chunkError } = await ctx.supabase.from('document_chunks').insert(rows)
    if (chunkError) throw chunkError

    return Response.json({ document_id: doc.id, chunks: rows.length })
  }),
}
