import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import * as os from 'os';

@Injectable()
export class AppService {
  constructor(@InjectConnection() private readonly connection: Connection) { }

  getHello(): string {
    return 'Hello World!';
  }

  async getHealthStatus() {
    const dbStatus = this.connection.readyState === 1 ? 'connected' : 'disconnected';

    // System metrics
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsage = ((usedMem / totalMem) * 100).toFixed(2);

    const cpus = os.cpus();
    const loadAvg = os.loadavg();

    return {
      status: dbStatus === 'connected' ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      service: 'HoroHouse API',
      version: '1.0.0',
      database: {
        status: dbStatus,
        details: {
          name: this.connection.name,
          host: this.connection.host,
        }
      },
      system: {
        uptime: os.uptime(),
        platform: os.platform(),
        cpus: cpus.length,
        loadAvg: loadAvg,
        memory: {
          total: (totalMem / (1024 * 1024 * 1024)).toFixed(2) + ' GB',
          used: (usedMem / (1024 * 1024 * 1024)).toFixed(2) + ' GB',
          usagePercent: memUsage + '%',
        }
      }
    };
  }
}
