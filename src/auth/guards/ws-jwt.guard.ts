import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { AuthService } from '../auth.service';

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly authService: AuthService, // inject this
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: Socket = context.switchToWs().getClient<Socket>();
    const token = client.handshake?.auth?.token;
    if (!token) throw new WsException('Unauthorized: No token provided');

    try {
      const payload = await this.jwtService.verifyAsync(token);
      const user = await this.authService.validateUser(payload); // checks isActive + session
      client.data.user = user;
      return true;
    } catch (error) {
      throw new WsException('Unauthorized: Invalid or revoked token');
    }
  }
}