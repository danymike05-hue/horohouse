import { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
export declare class FastifySocketIOAdapter extends IoAdapter {
    private app;
    constructor(app: INestApplicationContext);
    createIOServer(port: number, options?: ServerOptions): any;
}
