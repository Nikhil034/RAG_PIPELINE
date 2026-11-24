// Everything the browser sends to the backend lives in this file.
// In the video we connect each function to Supabase: look for TODO(06) and TODO(08).

import { createClient } from "@supabase/supabase-js";

const supabase=createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
)

export type Doc = { id: number; title: string; chunks: number }
export type Source = { title: string; content: string; similarity: number }
export type ChatReply = { answer: string; sources: Source[] }

// TODO(06): read the documents, with how many chunks each one has, from the `documents` table
export async function listDocuments(): Promise<Doc[]> {
  const {data}=await supabase.from("documents").select("id,title,document_chunks(count)").order("id");

  return (data??[]).map((d)=>({
    id:d.id,
    title:d.title,
    chunks:d.document_chunks[0].count??0,
  }));
}

// TODO(06): send the file's name and text to the `ingest` Edge Function
// src/api.ts
export async function uploadDocument(file: File): Promise<void> {
  const { error } = await supabase.functions.invoke('ingest', {
    body: { title: file.name, content: await file.text() },
  })
  if (error) throw error
}

// TODO(08): send the question to the `chat` Edge Function. It returns { answer, sources }.
// src/api.ts
export async function askQuestion(question: string): Promise<ChatReply> {
  const { data, error } = await supabase.functions.invoke<ChatReply>('chat', { body: { question } })
  if (error) throw error
  return data!
}