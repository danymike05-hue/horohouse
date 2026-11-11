import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import cookie from '@fastify/cookie';
import mongoose from 'mongoose';
import { AppModule } from './app.module';
import { webcrypto } from 'crypto';

if (!globalThis.crypto) {
  globalThis.crypto = webcrypto as Crypto;
}

function getAllowedOrigins(isProduction: boolean, customOrigins?: string): (string | RegExp)[] {
  if (customOrigins) {
    return customOrigins.split(',').map((o) => o.trim());
  }

  const prodOrigins: (string | RegExp)[] = [
    'https://horohouse.com',
    'https://www.horohouse.com',
    'https://backend-horohouse.up.railway.app',
  ];

  if (isProduction) {
    return prodOrigins;
  }

  const devOrigins: (string | RegExp)[] = [
    'http://localhost:3000',
    'http://localhost:8081',
    'http://localhost:8082',
    'http://localhost:4000',
    /^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/,
    /^http:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/,
  ];

  return [...prodOrigins, ...devOrigins];
}

const HELMET_OPTIONS = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: [`'self'`],
      styleSrc: [`'self'`, `'unsafe-inline'`],
      fontSrc: [`'self'`],
      objectSrc: [`'none'`],
      scriptSrc: [`'self'`],
      workerSrc: [`'self'`, `blob:`],
    },
  },
};

const MULTIPART_OPTIONS = {
  limits: {
    fieldNameSize: 100,
    fieldSize: 1024 * 1024 * 10,
    fields: 20,
    fileSize: 1024 * 1024 * 100,
    files: 50,
    headerPairs: 2000,
  },
};

function setupSwagger(app: NestFastifyApplication) {
  const config = new DocumentBuilder()
    .setTitle('HoroHouse API')
    .setDescription('Real Estate Platform API for Cameroon and African Countries')
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'JWT-auth')
    .addTag('Authentication', 'User authentication and authorization')
    .addTag('Users', 'User management operations')
    .addTag('Properties', 'Property management operations')
    .addTag('History', 'User activity tracking')
    .addTag('Analytics', 'Dashboard and analytics')
    .addTag('AI Chat', 'AI-powered chat and property search')
    .addTag('Chat', 'Real-time chat and messaging')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });
}

function setupMongoEvents(logger: Logger) {
  mongoose.connection.on('connected', () => logger.log('✅ Successfully connected to MongoDB'));
  mongoose.connection.on('error', (err) => logger.error('❌ MongoDB connection error: ' + err));
  mongoose.connection.on('disconnected', () => logger.warn('⚠️ MongoDB disconnected'));
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // ✅ rawBody: true tells Nest's FastifyAdapter to capture the exact raw
  //    bytes of the request body (as req.rawBody) *while still* registering
  //    its own normal JSON content-type parser. This avoids ever calling
  //    fastify.addContentTypeParser('application/json', ...) ourselves,
  //    which was colliding with Nest's own internal registration and
  //    crashing the server with FST_ERR_CTP_ALREADY_PRESENT.
  const fastifyAdapter = new FastifyAdapter({
    logger: false,
  });

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    fastifyAdapter,
    { rawBody: true },
  );

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);
  const isProduction = configService.get('NODE_ENV') === 'production';
  const customOrigins = configService.get<string>('ALLOWED_ORIGINS');
  const allowedOrigins = getAllowedOrigins(isProduction, customOrigins);

  const corsOptions = {
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'Origin',
      'X-Requested-With',
      'X-CamerPay-Signature',
    ],
  };

  // Plugins
  await app.register(helmet as any, HELMET_OPTIONS);
  await app.register(cors as any, corsOptions);
  await app.register(multipart as any, MULTIPART_OPTIONS);
  await app.register(cookie as any, {
    secret: configService.get<string>('JWT_SECRET', 'horohouse_cookie_secret'),
  });

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      exceptionFactory: (errors) => {
        logger.error('Validation errors:', JSON.stringify(errors, null, 2));
        const messages = errors.flatMap((err) =>
          err.constraints ? Object.values(err.constraints) : [err.toString()]
        );
        return new BadRequestException(messages);
      },
    }),
  );

  // Swagger — dev/staging only
  if (!isProduction) {
    setupSwagger(app);
    logger.log('📚 Swagger enabled');
  }

  app.setGlobalPrefix('api/v1');

  setupMongoEvents(logger);

  await app.listen(port, '0.0.0.0');

  logger.log(`🚀 HoroHouse Backend running on port ${port}`);
  logger.log(`🔌 WebSocket ready`);
  logger.log(`🌍 Allowed origins: ${allowedOrigins.map(o => o.toString()).join(', ')}`);
  logger.log(`🔑 JWT Secret configured: ${!!configService.get('JWT_SECRET')}`);
  logger.log(`💳 CamerPay webhook: POST /api/v1/payments/webhook/camerpay`);
}

bootstrap().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});