"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FastifySocketIOAdapter = void 0;
const platform_socket_io_1 = require("@nestjs/platform-socket.io");
class FastifySocketIOAdapter extends platform_socket_io_1.IoAdapter {
    app;
    constructor(app) {
        super(app);
        this.app = app;
    }
    createIOServer(port, options) {
        const server = super.createIOServer(port, {
            ...options,
            cors: {
                origin: process.env.FRONTEND_URL || 'http://localhost:3000',
                credentials: true,
                methods: ['GET', 'POST'],
            },
            transports: ['websocket', 'polling'],
            allowEIO3: true,
        });
        return server;
    }
}
exports.FastifySocketIOAdapter = FastifySocketIOAdapter;
//# sourceMappingURL=fastify-socket.adapter.js.map