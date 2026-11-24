// try.js (in the starter folder): call our Edge Functions without the app
import { createClient } from '@supabase/supabase-js'

// try.js: add at the top
import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
 
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY)
 
// Calls an Edge Function by name, at <project URL>/functions/v1/<name>
async function call(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (error) {
    // error.context is the function's HTTP response; its body says what went wrong
    const details = (await error.context?.text?.()) ?? error.message
    throw new Error(`${name} failed (${error.context?.status}): ${details}`)
  }
  return data
}
 
const [command, arg] = process.argv.slice(2)
 
// text → 768 numbers
if (command === 'embeded') {
  const { embedding } = await call('embeded', { input: arg })
  console.log(`${embedding.length} numbers: [${embedding.slice(0, 5).join(', ')}, ...]`)
}

// try.js: add at the bottom
// a file → chunks saved in the database
if (command === 'ingest') {
  const result = await call('ingest', { title: basename(arg), content: await readFile(arg, 'utf8') })
  console.log(result)
}

// try.js: add at the bottom
// a question → an answer, plus the chunks it used
if (command === 'chat') {
  const { answer, sources } = await call('chat', { question: arg })
  console.log(answer)
  sources.forEach((s, i) => console.log(`[${i + 1}] ${s.title}`))
}
