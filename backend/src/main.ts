import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { WinstonLogger } from './logger/winston-logger';

async function bootstrap() {
  const logger = new WinstonLogger();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger,
  });

  configureApp(app);

  const port = process.env.PORT || 3002;
  await app.listen(port);
  logger.log(`Porto backend listening on port ${port}`, 'Bootstrap');
}
void bootstrap();
