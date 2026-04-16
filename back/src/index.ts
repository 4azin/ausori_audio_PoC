import { connectRedis } from "./config/redis";
import { initGemini } from "./config/gemini";
import { startJobConsumer } from "./jobs";
import app from "./app";

const PORT = process.env.PORT || 3000;

/** Redis 연결 후 서버 시작 */
async function bootstrap() {
  initGemini();
  await connectRedis();
  await startJobConsumer();

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

bootstrap();
