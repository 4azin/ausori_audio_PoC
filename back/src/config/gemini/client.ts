/**
 * Gemini 클라이언트 싱글턴.
 * TODO: @google/generative-ai 패키지 설치 후 실제 클라이언트 인스턴스로 교체.
 */

export interface GeminiClient {
  embedContent(text: string): Promise<number[]>;
}

let client: GeminiClient | null = null;

export function getGeminiClient(): GeminiClient {
  if (client) return client;
  throw new Error("[gemini] client not initialized — call initGemini() at bootstrap");
}

export function initGemini(): void {
  // TODO: const gen = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  //       const model = gen.getGenerativeModel({ model: "gemini-embedding-001" });
  //       client = { embedContent: async (t) => (await model.embedContent(t)).embedding.values };
  throw new Error("[gemini] not implemented");
}
