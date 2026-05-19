/**
 * Script de migração única: importa todos os posts do posts.json para o Supabase.
 *
 * Pré-requisitos:
 *   1. Criar a tabela no Supabase executando supabase/schema.sql
 *   2. Definir as variáveis de ambiente:
 *      VITE_SUPABASE_URL=https://<project>.supabase.co
 *      SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
 *
 * Executar: npx tsx scripts/migrate-posts-to-supabase.ts
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("❌ Defina VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY antes de executar.");
  process.exit(1);
}

const supabase = createClient(url, key);
const postsPath = path.resolve(process.cwd(), "src/data/posts.json");
const posts = JSON.parse(fs.readFileSync(postsPath, "utf-8"));

console.log(`📦 Migrando ${posts.length} posts para o Supabase...`);

const BATCH_SIZE = 50;
let inserted = 0;
let skipped = 0;

for (let i = 0; i < posts.length; i += BATCH_SIZE) {
  const batch = posts.slice(i, i + BATCH_SIZE);

  const { error } = await supabase
    .from("posts")
    .upsert(
      batch.map((p: any) => ({
        id: p.id,
        title: p.title,
        date: p.date,
        excerpt: p.excerpt || "",
        content: p.content || "",
        tags: p.tags || [],
        category: p.category || "Cloud",
      })),
      { onConflict: "id", ignoreDuplicates: false }
    );

  if (error) {
    console.error(`❌ Erro no batch ${i / BATCH_SIZE + 1}:`, error.message);
    skipped += batch.length;
  } else {
    inserted += batch.length;
    console.log(`  ✅ Batch ${i / BATCH_SIZE + 1}: ${batch.length} posts inseridos.`);
  }
}

console.log(`\n🎉 Migração concluída: ${inserted} inseridos, ${skipped} com erro.`);
