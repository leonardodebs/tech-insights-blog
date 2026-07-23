/**
 * Publica o post mais recente (posts[0] de src/data/posts.json) no LinkedIn.
 * Roda como step separado no workflow, depois que "Generate AI Post" tiver
 * sucesso. Nunca deve derrubar o build/deploy do blog — o step no workflow
 * usa continue-on-error, igual ao padrão já usado para a geração de post.
 *
 * Dry-run local (sem publicar de verdade):
 *   LINKEDIN_DRY_RUN=true npx tsx scripts/post-to-linkedin.ts
 */
import fs from "fs";
import path from "path";
import { postToLinkedIn } from "../src/services/linkedin";
import { Post } from "../src/types";

const POSTS_PATH = path.resolve(process.cwd(), "src/data/posts.json");
const DRY_RUN = process.env.LINKEDIN_DRY_RUN === "true";

async function main() {
  if (!fs.existsSync(POSTS_PATH)) {
    throw new Error("src/data/posts.json não encontrado.");
  }

  const posts: Post[] = JSON.parse(fs.readFileSync(POSTS_PATH, "utf-8") || "[]");
  const latest = posts[0];

  if (!latest) {
    throw new Error("Nenhum post encontrado em posts.json.");
  }

  console.log(`📤 Preparando post para LinkedIn: [${latest.category}] ${latest.title}`);

  if (DRY_RUN) {
    console.log("🧪 DRY RUN — nada será publicado. Payload que seria enviado:");
    console.log("Legenda:", latest.linkedinCaption);
    console.log("Hashtags:", latest.linkedinHashtags);
    console.log(`Link: https://leonardodebs.github.io/tech-insights-blog/posts/${latest.id}/`);
    return;
  }

  const result = await postToLinkedIn(latest);
  console.log(`✅ Publicado no LinkedIn: ${result.postUrn}`);
}

main().catch(err => {
  console.error("❌ Falha ao publicar no LinkedIn:", err.message || err);
  process.exit(1);
});
