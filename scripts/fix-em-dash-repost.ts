/**
 * ONE-OFF: remove o post específico que tinha travessão (blog + Supabase +
 * LinkedIn) e gera um substituto limpo para a mesma categoria, já publicando
 * no LinkedIn. Script temporário, apagar depois de rodar uma vez.
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { runAutomation } from "../src/services/automation";
import { postToLinkedIn } from "../src/services/linkedin";
import { Post } from "../src/types";

const POSTS_PATH = path.resolve(process.cwd(), "src/data/posts.json");
const OLD_POST_ID = "post-1784773229834";
const OLD_LINKEDIN_URN = "urn:li:share:7485882282558427139";
const CATEGORY_TO_REGENERATE = "Security";

async function deleteOldLinkedInPost() {
  const accessToken = (process.env.LINKEDIN_ACCESS_TOKEN || "").trim();
  const encoded = encodeURIComponent(OLD_LINKEDIN_URN);
  const res = await fetch(`https://api.linkedin.com/rest/posts/${encoded}`, {
    method: "DELETE",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "X-Restli-Protocol-Version": "2.0.0",
      "Linkedin-Version": "202607",
    },
  });
  if (res.status !== 204 && res.status !== 200) {
    const text = await res.text();
    throw new Error(`Falha ao deletar post antigo do LinkedIn (${res.status}): ${text}`);
  }
  console.log("🗑️ Post antigo removido do LinkedIn.");
}

async function deleteOldFromSupabase() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.warn("⚠️ Supabase não configurado, pulando remoção lá.");
    return;
  }
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { error } = await supabase.from("posts").delete().eq("id", OLD_POST_ID);
  if (error) {
    console.warn(`⚠️ Falha ao remover post antigo do Supabase: ${error.message}`);
  } else {
    console.log("🗑️ Post antigo removido do Supabase.");
  }
}

function removeOldFromPostsJson() {
  const posts: Post[] = JSON.parse(fs.readFileSync(POSTS_PATH, "utf-8") || "[]");
  const filtered = posts.filter(p => p.id !== OLD_POST_ID);
  if (filtered.length === posts.length) {
    console.warn(`⚠️ Post ${OLD_POST_ID} não encontrado em posts.json (já removido?).`);
  }
  fs.writeFileSync(POSTS_PATH, JSON.stringify(filtered, null, 2));
  console.log("🗑️ Post antigo removido de posts.json.");
}

async function main() {
  await deleteOldLinkedInPost();
  await deleteOldFromSupabase();
  removeOldFromPostsJson();

  console.log(`🔄 Regenerando novo post para categoria: ${CATEGORY_TO_REGENERATE}...`);
  const newPost = await runAutomation(CATEGORY_TO_REGENERATE);
  console.log(`✅ Novo post gerado: ${newPost.title}`);

  console.log("📤 Publicando novo post no LinkedIn...");
  const result = await postToLinkedIn(newPost);
  console.log(`✅ Publicado no LinkedIn: ${result.postUrn}`);
}

main().catch(err => {
  console.error("❌ Erro:", err.message || err);
  process.exit(1);
});
