"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const platform_fastify_1 = require("@nestjs/platform-fastify");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const swagger_1 = require("@nestjs/swagger");
const helmet_1 = require("@fastify/helmet");
const cors_1 = require("@fastify/cors");
const multipart_1 = require("@fastify/multipart");
const cookie_1 = require("@fastify/cookie");
const mongoose_1 = require("mongoose");
const app_module_1 = require("./app.module");
const crypto_1 = require("crypto");
if (!globalThis.crypto) {
    globalThis.crypto = crypto_1.webcrypto;
}
function getAllowedOrigins(isProduction, customOrigins) {
    if (customOrigins) {
        return customOrigins.split(',').map((o) => o.trim());
    }
    const prodOrigins = [
        'https://horohouse.com',
        'https://www.horohouse.com',
        'https://backend-horohouse.up.railway.app',
    ];
    if (isProduction) {
        return prodOrigins;
    }
    const devOrigins = [
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
function setupSwagger(app) {
    const config = new swagger_1.DocumentBuilder()
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
    const document = swagger_1.SwaggerModule.createDocument(app, config);
    swagger_1.SwaggerModule.setup('api/docs', app, document, {
        swaggerOptions: { persistAuthorization: true },
    });
}
function setupMongoEvents(logger) {
    mongoose_1.default.connection.on('connected', () => logger.log('✅ Successfully connected to MongoDB'));
    mongoose_1.default.connection.on('error', (err) => logger.error('❌ MongoDB connection error: ' + err));
    mongoose_1.default.connection.on('disconnected', () => logger.warn('⚠️ MongoDB disconnected'));
}
async function bootstrap() {
    const logger = new common_1.Logger('Bootstrap');
    const fastifyAdapter = new platform_fastify_1.FastifyAdapter({
        logger: false,
    });
    const app = await core_1.NestFactory.create(app_module_1.AppModule, fastifyAdapter, { rawBody: true });
    const configService = app.get(config_1.ConfigService);
    const port = configService.get('PORT', 3000);
    const isProduction = configService.get('NODE_ENV') === 'production';
    const customOrigins = configService.get('ALLOWED_ORIGINS');
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
    await app.register(helmet_1.default, HELMET_OPTIONS);
    await app.register(cors_1.default, corsOptions);
    await app.register(multipart_1.default, MULTIPART_OPTIONS);
    await app.register(cookie_1.default, {
        secret: configService.get('JWT_SECRET', 'horohouse_cookie_secret'),
    });
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
        exceptionFactory: (errors) => {
            logger.error('Validation errors:', JSON.stringify(errors, null, 2));
            const messages = errors.flatMap((err) => err.constraints ? Object.values(err.constraints) : [err.toString()]);
            return new common_1.BadRequestException(messages);
        },
    }));
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
//# sourceMappingURL=main.js.map