#!/usr/bin/env bun
/**
 * Script: import-insect12c.ts
 *
 * Importa o dataset INSECT12C para a tabela pest_reference_vectors do Supabase.
 * Para cada imagem:
 *   1. Lê o XML para extrair a(s) espécie(s) anotada(s) (bounding boxes).
 *   2. Faz upload da imagem para o bucket "pest-images/insect12c/".
 *   3. Chama o ChatGPT (Vision) para gerar descricao_visual + caracteristicas_chave.
 *   4. Gera embedding via text-embedding-3-small.
 *   5. Insere na tabela pest_reference_vectors (fazenda_id = null = referência global).
 *
 * Uso:
 *   bun run scripts/import-insect12c.ts --user-id <uuid> [--dry-run] [--skip-ai] [--limit 10]
 *
 * Flags:
 *   --user-id   UUID do usuário autenticado (created_by). Obrigatório.
 *   --dry-run   Só lista o que seria importado, sem gravar.
 *   --skip-ai   Pula ChatGPT Vision e embedding. Insere só com dados do XML.
 *   --limit N   Importa apenas N imagens (útil para teste).
 *   --batch N   Tamanho do batch para inserção (default: 5).
 *   --start N   Começar a partir da imagem N (para retomar).
 */

import { createClient } from "@supabase/supabase-js";
import { readdir, readFile, stat } from "fs/promises";
import { join, basename, extname } from "path";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://rlkwdgyzbvpodteyyuqk.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";

const DATASET_ROOT = join(import.meta.dir, "..", "INSECT12C-Dataset-main");

const PART_DIRS = [
  "part-01-12-img-1-150",
  "part-02-12-img-151-300",
  "part-03-12-img-301-450",
  "part-04-12-img-451-600",
  "part-05-12-img-601-750",
  "part-06-12-img-751-900",
];

const SPECIES_MAP: Record<string, { nome: string; cientifico: string; tipo: string }> = {
  Anticarsia_gemmatalis: { nome: "Lagarta-da-soja", cientifico: "Anticarsia gemmatalis", tipo: "INSETO" },
  Chrysodeixis_includens: { nome: "Lagarta-falsa-medideira", cientifico: "Chrysodeixis includens", tipo: "INSETO" },
  Diabrotica_speciosa: { nome: "Vaquinha-verde-amarela", cientifico: "Diabrotica speciosa", tipo: "INSETO" },
  Edessa_meditabunda: { nome: "Percevejo-asa-preta-de-soja", cientifico: "Edessa meditabunda", tipo: "INSETO" },
  Euschistus_heros_adulto: { nome: "Percevejo-marrom (adulto)", cientifico: "Euschistus heros", tipo: "INSETO" },
  Euschistus_heros_ninfa: { nome: "Percevejo-marrom (ninfa)", cientifico: "Euschistus heros", tipo: "INSETO" },
  Nezara_viridula_adulto: { nome: "Percevejo-verde (adulto)", cientifico: "Nezara viridula", tipo: "INSETO" },
  Nezara_viridula_ninfa: { nome: "Percevejo-verde (ninfa)", cientifico: "Nezara viridula", tipo: "INSETO" },
  Piezodorus_guildinii: { nome: "Percevejo-verde-pequeno", cientifico: "Piezodorus guildinii", tipo: "INSETO" },
  Spodoptera_cosmioides: { nome: "Lagarta-preta", cientifico: "Spodoptera cosmioides", tipo: "INSETO" },
  Spodoptera_eridania: { nome: "Lagarta-das-vagens", cientifico: "Spodoptera eridania", tipo: "INSETO" },
  Spodoptera_frugiperda: { nome: "Lagarta-do-cartucho", cientifico: "Spodoptera frugiperda", tipo: "INSETO" },
  Spodoptera_albula: { nome: "Lagarta-das-folhas", cientifico: "Spodoptera albula", tipo: "INSETO" },
  Lagria_villosa: { nome: "Besouro-da-soja", cientifico: "Lagria villosa", tipo: "INSETO" },
  Coccinellidae: { nome: "Joaninha", cientifico: "Coccinellidae spp.", tipo: "INSETO" },
  Gastropoda: { nome: "Lesma/Caracol", cientifico: "Gastropoda spp.", tipo: "INSETO" },
  Rhammatocerus_schistocercoides: { nome: "Gafanhoto-do-cerrado", cientifico: "Rhammatocerus schistocercoides", tipo: "INSETO" },
};

function parseArgs() {
  const args = process.argv.slice(2);
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dry-run") flags.dryRun = true;
    else if (args[i] === "--skip-ai") flags.skipAi = true;
    else if (args[i] === "--user-id" && args[i + 1]) flags.userId = args[++i];
    else if (args[i] === "--limit" && args[i + 1]) flags.limit = args[++i];
    else if (args[i] === "--batch" && args[i + 1]) flags.batch = args[++i];
    else if (args[i] === "--start" && args[i + 1]) flags.start = args[++i];
  }
  return flags;
}

function extractSpeciesFromXml(xmlContent: string): { name: string; bndbox: { xmin: number; ymin: number; xmax: number; ymax: number } }[] {
  const objects: { name: string; bndbox: { xmin: number; ymin: number; xmax: number; ymax: number } }[] = [];
  const regex = /<object>([\s\S]*?)<\/object>/g;
  let match;
  while ((match = regex.exec(xmlContent)) !== null) {
    const block = match[1];
    const nameMatch = block.match(/<name>([^<]+)<\/name>/);
    const xminMatch = block.match(/<xmin>(\d+)<\/xmin>/);
    const yminMatch = block.match(/<ymin>(\d+)<\/ymin>/);
    const xmaxMatch = block.match(/<xmax>(\d+)<\/xmax>/);
    const ymaxMatch = block.match(/<ymax>(\d+)<\/ymax>/);
    if (nameMatch) {
      objects.push({
        name: nameMatch[1],
        bndbox: {
          xmin: parseInt(xminMatch?.[1] ?? "0"),
          ymin: parseInt(yminMatch?.[1] ?? "0"),
          xmax: parseInt(xmaxMatch?.[1] ?? "0"),
          ymax: parseInt(ymaxMatch?.[1] ?? "0"),
        },
      });
    }
  }
  return objects;
}

async function analyzeWithChatGPT(imageBase64: string, speciesName: string, scientificName: string): Promise<{ descricao: string; caracteristicas: object }> {
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Você é um entomologista agrícola. Analise a imagem do inseto e gere:
1. Uma descrição visual detalhada para ajudar na identificação futura (cores, formato, tamanho relativo, padrões, texturas).
2. Características-chave em JSON: { "cor_principal", "cor_secundaria", "formato_corpo", "tamanho_mm_aprox", "asas", "patas", "antenas", "habitat_tipico", "dano_causado", "estagio" }.
Responda APENAS em JSON: { "descricao_visual": "...", "caracteristicas_chave": { ... } }`,
        },
        {
          role: "user",
          content: [
            { type: "text", text: `Espécie: ${speciesName} (${scientificName}). Descreva visualmente este inseto para treinar um sistema de identificação.` },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: "low" } },
          ],
        },
      ],
      max_tokens: 500,
      temperature: 0.2,
    }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`OpenAI Vision error ${resp.status}: ${err}`);
  }
  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content ?? "";
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`No JSON in OpenAI response: ${content.slice(0, 200)}`);
  const parsed = JSON.parse(jsonMatch[0]);
  return {
    descricao: parsed.descricao_visual ?? "",
    caracteristicas: parsed.caracteristicas_chave ?? {},
  };
}

async function generateEmbedding(text: string): Promise<number[]> {
  const resp = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({ model: "text-embedding-3-small", input: text }),
  });
  if (!resp.ok) throw new Error(`Embedding error ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  return data.data[0].embedding;
}

async function main() {
  const flags = parseArgs();
  const userId = flags.userId as string;
  const dryRun = !!flags.dryRun;
  const skipAi = !!flags.skipAi;
  const limit = flags.limit ? parseInt(flags.limit as string) : Infinity;
  const batchSize = flags.batch ? parseInt(flags.batch as string) : 5;
  const startFrom = flags.start ? parseInt(flags.start as string) : 0;

  if (!userId) {
    console.error("Erro: --user-id <uuid> é obrigatório.");
    console.error("Uso: bun run scripts/import-insect12c.ts --user-id ace4d519-13a3-4092-9a04-ed04949d6ecf");
    process.exit(1);
  }

  const useServiceKey = !!SUPABASE_SERVICE_KEY;
  const supabaseKey = useServiceKey ? SUPABASE_SERVICE_KEY : SUPABASE_ANON_KEY;
  if (!supabaseKey) {
    console.error("Erro: Defina SUPABASE_SERVICE_ROLE_KEY ou NEXT_PUBLIC_SUPABASE_ANON_KEY no .env");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`\n=== INSECT12C Dataset Importer ===`);
  console.log(`Supabase: ${SUPABASE_URL}`);
  console.log(`Auth: ${useServiceKey ? "Service Role Key" : "Anon Key"}`);
  console.log(`User ID: ${userId}`);
  console.log(`Dry run: ${dryRun}`);
  console.log(`Skip AI: ${skipAi}`);
  console.log(`Limit: ${limit === Infinity ? "sem limite" : limit}`);
  console.log(`Start from: ${startFrom}`);
  console.log(`Batch size: ${batchSize}\n`);

  if (!skipAi && !OPENAI_API_KEY) {
    console.error("Erro: OPENAI_API_KEY não definida. Use --skip-ai para pular análise por IA.");
    process.exit(1);
  }

  type ImageEntry = { dir: string; imgBase: string; xmlPath: string; imgPath: string };
  const allEntries: ImageEntry[] = [];

  for (const partDir of PART_DIRS) {
    const fullDir = join(DATASET_ROOT, partDir);
    try {
      const files = await readdir(fullDir);
      const xmlFiles = files.filter((f) => f.endsWith(".xml"));
      for (const xmlFile of xmlFiles) {
        const imgBase = xmlFile.replace(".xml", "");
        const jpgLower = join(fullDir, imgBase + ".jpg");
        const jpgUpper = join(fullDir, imgBase + ".JPG");
        let imgPath: string | null = null;
        try { await stat(jpgLower); imgPath = jpgLower; } catch {}
        if (!imgPath) { try { await stat(jpgUpper); imgPath = jpgUpper; } catch {} }
        if (imgPath) {
          allEntries.push({ dir: partDir, imgBase, xmlPath: join(fullDir, xmlFile), imgPath });
        }
      }
    } catch (err) {
      console.warn(`Aviso: diretório ${partDir} não encontrado, pulando.`);
    }
  }

  allEntries.sort((a, b) => {
    const numA = parseInt(a.imgBase.replace("img", ""));
    const numB = parseInt(b.imgBase.replace("img", ""));
    return numA - numB;
  });

  const filtered = allEntries.slice(startFrom, startFrom + limit);
  console.log(`Total de imagens encontradas: ${allEntries.length}`);
  console.log(`Processando: ${filtered.length} (de ${startFrom} a ${startFrom + filtered.length - 1})\n`);

  const speciesCount: Record<string, number> = {};
  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < filtered.length; i += batchSize) {
    const batch = filtered.slice(i, i + batchSize);
    const batchPromises = batch.map(async (entry) => {
      try {
        const xmlContent = await readFile(entry.xmlPath, "utf-8");
        const objects = extractSpeciesFromXml(xmlContent);

        if (objects.length === 0) {
          console.log(`  [SKIP] ${entry.imgBase}: sem objetos anotados`);
          skipped++;
          return;
        }

        const uniqueSpecies = [...new Set(objects.map((o) => o.name))];

        for (const speciesKey of uniqueSpecies) {
          const speciesInfo = SPECIES_MAP[speciesKey];
          if (!speciesInfo) {
            console.log(`  [SKIP] ${entry.imgBase}: espécie desconhecida "${speciesKey}"`);
            skipped++;
            continue;
          }

          speciesCount[speciesKey] = (speciesCount[speciesKey] ?? 0) + 1;

          if (dryRun) {
            console.log(`  [DRY] ${entry.imgBase} -> ${speciesInfo.nome} (${speciesInfo.cientifico})`);
            imported++;
            continue;
          }

          const imgBuffer = await readFile(entry.imgPath);
          const storagePath = `insect12c/${entry.imgBase}_${speciesKey}.jpg`;

          const { error: uploadErr } = await supabase.storage
            .from("pest-images")
            .upload(storagePath, imgBuffer, {
              contentType: "image/jpeg",
              cacheControl: "31536000",
              upsert: true,
            });

          if (uploadErr && !uploadErr.message?.includes("already exists")) {
            console.error(`  [ERR] Upload ${storagePath}: ${uploadErr.message}`);
            errors++;
            continue;
          }

          const { data: urlData } = supabase.storage.from("pest-images").getPublicUrl(storagePath);
          const imageUrl = urlData?.publicUrl ?? null;

          let descricaoVisual: string | null = null;
          let caracteristicasChave: object = {};
          let embedding: number[] | null = null;

          if (!skipAi) {
            try {
              const imgBase64 = imgBuffer.toString("base64");
              const aiResult = await analyzeWithChatGPT(imgBase64, speciesInfo.nome, speciesInfo.cientifico);
              descricaoVisual = aiResult.descricao;
              caracteristicasChave = aiResult.caracteristicas;

              const embeddingText = `${speciesInfo.nome} (${speciesInfo.cientifico}): ${descricaoVisual}`;
              embedding = await generateEmbedding(embeddingText);
            } catch (aiErr: any) {
              console.warn(`  [WARN] AI falhou para ${entry.imgBase}/${speciesKey}: ${aiErr.message}`);
            }
          }

          const bboxes = objects.filter((o) => o.name === speciesKey).map((o) => o.bndbox);
          const insertData: Record<string, any> = {
            fazenda_id: null,
            nome_praga: speciesInfo.nome,
            nome_cientifico: speciesInfo.cientifico,
            tipo: speciesInfo.tipo,
            descricao_visual: descricaoVisual,
            caracteristicas_chave: {
              ...caracteristicasChave,
              bounding_boxes: bboxes,
              dataset: "INSECT12C",
              image_file: `${entry.imgBase}.jpg`,
            },
            imagem_referencia_url: imageUrl,
            fonte: skipAi ? "MANUAL" : "CHATGPT",
            confianca: skipAi ? 0.95 : 0.9,
            created_by: userId,
          };

          if (embedding) {
            insertData.embedding = JSON.stringify(embedding);
          }

          const { error: insertErr } = await supabase.from("pest_reference_vectors").insert(insertData);
          if (insertErr) {
            console.error(`  [ERR] Insert ${entry.imgBase}/${speciesKey}: ${insertErr.message}`);
            errors++;
          } else {
            imported++;
            console.log(`  [OK] ${entry.imgBase} -> ${speciesInfo.nome} (${imageUrl ? "com imagem" : "sem imagem"}${embedding ? " + embedding" : ""})`);
          }
        }
      } catch (err: any) {
        console.error(`  [ERR] ${entry.imgBase}: ${err.message}`);
        errors++;
      }
    });

    await Promise.all(batchPromises);
    const progress = Math.min(i + batchSize, filtered.length);
    console.log(`\n--- Progresso: ${progress}/${filtered.length} ---\n`);
  }

  console.log(`\n=== RESULTADO FINAL ===`);
  console.log(`Importados: ${imported}`);
  console.log(`Pulados:    ${skipped}`);
  console.log(`Erros:      ${errors}`);
  console.log(`\nEspécies encontradas:`);
  for (const [key, count] of Object.entries(speciesCount).sort((a, b) => b[1] - a[1])) {
    const info = SPECIES_MAP[key];
    console.log(`  ${info?.nome ?? key} (${info?.cientifico ?? "?"}) = ${count}`);
  }
}

main().catch((err) => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
