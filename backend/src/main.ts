import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { WinstonLogger } from './logger/winston-logger';

async function bootstrap() {
  const logger = new WinstonLogger();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger,
  });

  // Behind Railway's proxy — needed so rate limiting sees the real client IP
  app.set('trust proxy', 1);

  // Set global prefix for API routes
  app.setGlobalPrefix('api');

  // Enable validation globally
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // CORS: prod serves the SPA same-origin, so only allow explicitly configured
  // origins there; dev allows the Vite dev server.
  const allowedOrigins =
    process.env.NODE_ENV === 'production'
      ? (process.env.CORS_ORIGINS ?? '').split(',').filter(Boolean)
      : ['http://localhost:5174'];
  app.enableCors({
    origin: allowedOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  });

  const port = process.env.PORT || 3002;
  await app.listen(port);
  logger.log(`Porto backend listening on port ${port}`, 'Bootstrap');
}
bootstrap();
