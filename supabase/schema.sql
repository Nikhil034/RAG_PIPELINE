create extension if not exists vector with schema extensions;

create table if not exists documents (
  id bigserial primary key,
  title text not null,
  created_at timestamptz not null default now()
);

create table if not exists document_chunks (
  id bigserial primary key,
  document_id bigint not null references documents on delete cascade,
  chunk_index int not null,
  content text not null,
  embedding extensions.vector(768) not null
);

grant select, insert on documents, document_chunks to anon;
grant usage on sequence documents_id_seq, document_chunks_id_seq to anon;

create table if not exists demo_queries (
  q text primary key,
  embedding extensions.vector(768) not null
);

grant select, insert, update on demo_queries to anon;

alter table document_chunks
  add column if not exists fts tsvector
  generated always as (to_tsvector('english', content)) stored;

create index if not exists document_chunks_fts_idx
  on document_chunks using gin (fts);

create index if not exists document_chunks_embedding_hnsw_idx
  on document_chunks using hnsw (embedding extensions.vector_cosine_ops);

create or replace function hybrid_search(
  query_text text,
  query_embedding extensions.vector(768),
  match_count int default 5,
  full_text_weight float default 1,
  semantic_weight float default 1,
  rrf_k int default 50
)
returns table (
  id bigint,
  document_id bigint,
  title text,
  content text,
  score float
)
language sql
stable
as $$
  with full_text as (
    select c.id,
           row_number() over (
             order by ts_rank_cd(c.fts, keywords) desc, c.id
           ) as rank_ix
    from document_chunks c,
         to_tsquery(
           'english',
           replace(websearch_to_tsquery('english', query_text)::text, ' & ', ' | ')
         ) as keywords
    where c.fts @@ keywords
    order by rank_ix
    limit match_count * 2
  ),
  semantic as (
    select c.id,
           row_number() over (order by c.embedding <=> query_embedding, c.id) as rank_ix
    from document_chunks c
    order by c.embedding <=> query_embedding
    limit match_count * 2
  )
  select c.id,
         c.document_id,
         d.title,
         c.content,
         coalesce(1.0 / (rrf_k + ft.rank_ix), 0.0) * full_text_weight
           + coalesce(1.0 / (rrf_k + sem.rank_ix), 0.0) * semantic_weight as score
  from full_text ft
  full outer join semantic sem on ft.id = sem.id
  join document_chunks c on c.id = coalesce(ft.id, sem.id)
  join documents d on d.id = c.document_id
  order by score desc
  limit match_count;
$$;

grant execute on function hybrid_search to anon;
