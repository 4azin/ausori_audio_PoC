import { GoogleGenAI } from "@google/genai";

/**
 * Gemini 싱글턴. gemini-embedding-2-preview 전용.
 * 3072 dim → pgvector vector(3072)와 동일.
 *
 * v2에는 taskType enum이 없다. 대신 프롬프트 앞에 task 지시를 직접 붙인다:
 *   "task: retrieval query | query: {text}"
 *   "task: retrieval document | query: {text}"
 */
export const GEMINI_EMBED_MODEL = "gemini-embedding-2-preview";
export const GEMINI_EMBED_DIM = 3072;

export type EmbedTask = "query" | "document";

export interface GeminiClient {
  embedOne(text: string, task: EmbedTask): Promise<number[]>;
  embedBatch(texts: string[], task: EmbedTask): Promise<number[][]>;
}

let client: GeminiClient | null = null;

function wrapWithTask(text: string, task: EmbedTask): string {
  const label = task === "query" ? "retrieval query" : "retrieval document";
  return `task: ${label} | query: ${text}`;
}

export function initGemini(): void {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("[gemini] GEMINI_API_KEY not set");

  const ai = new GoogleGenAI({ apiKey });

  client = {
    async embedOne(text, task) {
      const res = await ai.models.embedContent({
        model: GEMINI_EMBED_MODEL,
        contents: wrapWithTask(text, task),
        config: { outputDimensionality: GEMINI_EMBED_DIM },
      });
      const values = res.embeddings?.[0]?.values;
      if (!values) throw new Error("[gemini] empty embedding response");
      return values;
    },

    async embedBatch(texts, task) {
      if (texts.length === 0) return [];
      const res = await ai.models.embedContent({
        model: GEMINI_EMBED_MODEL,
        contents: texts.map((t) => wrapWithTask(t, task)),
        config: { outputDimensionality: GEMINI_EMBED_DIM },
      });
      const out = res.embeddings?.map((e) => e.values);
      if (!out || out.some((v) => !v)) {
        throw new Error("[gemini] batch embedding response malformed");
      }
      return out as number[][];
    },
  };
}

export function getGeminiClient(): GeminiClient {
  if (client) return client;
  throw new Error("[gemini] not initialized — call initGemini() at bootstrap");
}
