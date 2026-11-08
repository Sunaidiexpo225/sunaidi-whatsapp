import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { Logger } from "@nestjs/common";
import { AppModule } from "./app.module";
import type { Env } from "./config/env";

async function bootstrap(): Promise<void> {
  // rawBody: true keeps the exact bytes Meta signed, for webhook verification.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  // The web app runs on a different origin (Vercel); allow it to call the API.
  app.enableCors({ origin: true });

  const config = app.get(ConfigService<Env, true>);
  const port = config.get("API_PORT", { infer: true });

  await app.listen(port);
  Logger.log(`API listening on port ${port}`, "Bootstrap");
}

void bootstrap();
