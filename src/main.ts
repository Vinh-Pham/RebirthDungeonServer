import { readScalarAsset } from './openapi/read-scalar-asset.js';
import { configureApp } from './configure-app.js';
import { NestFactory } from '@nestjs/core';
import {
  ExpressAdapter,
  NestExpressApplication,
} from '@nestjs/platform-express';
import { AppModule, ObserveInstrument } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
    new ExpressAdapter(),
    { instrument: ObserveInstrument },
  );
  configureApp(app, await readScalarAsset());
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
