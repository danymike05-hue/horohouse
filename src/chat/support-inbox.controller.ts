import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import { Area } from '../auth/team-areas';
import { UserRole } from '../users/schemas/user.schema';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { GetMessagesQueryDto } from './dto/chat.dto';
import { MessageType } from './schemas/message.schema';

class SupportReplyDto {
  @IsString() @Length(1, 4000) content: string;
}

/**
 * The HoroHouse support inbox, for admins and team members with "support".
 * They read and answer as the support account: guests see "HoroHouse support",
 * and the team's activity log records who wrote.
 */
@ApiTags('Support inbox')
@ApiBearerAuth()
@Controller('chat/support-inbox')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Area('support')
export class SupportInboxController {
  constructor(
    private readonly chat: ChatService,
    private readonly gateway: ChatGateway,
  ) {}

  private async supportId(): Promise<string> {
    const id = await this.chat.supportAccount();
    if (!id) throw new NotFoundException('Support chat is not set up');
    return id;
  }

  @Get()
  @ApiOperation({ summary: 'Support chats, newest first' })
  async list(@Query('page') page?: string) {
    const id = await this.supportId();
    return this.chat.getConversations(id, {
      page: Math.max(1, Number(page) || 1),
      limit: 30,
      onlySupport: true,
    } as any);
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'Messages of one support chat' })
  async messages(
    @Param('id') conversationId: string,
    @Query() query: GetMessagesQueryDto,
  ) {
    const id = await this.supportId();
    await this.chat.assertSupportConversation(conversationId);
    const page = await this.chat.getMessages(conversationId, id, query);
    await this.chat.clearUnread(conversationId, id);
    return { supportId: id, ...(page as any) };
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Answer as HoroHouse support' })
  async reply(
    @Param('id') conversationId: string,
    @Body() dto: SupportReplyDto,
    @Req() req: any,
  ) {
    const id = await this.supportId();
    await this.chat.assertSupportConversation(conversationId);
    const message = await this.chat.sendMessage(id, {
      conversationId,
      content: dto.content.trim(),
      type: MessageType.TEXT,
    } as any);
    await this.gateway.announce(conversationId, message, id);
    await this.chat.clearUnread(conversationId, id);
    return { message, answeredBy: String(req.user?.userId ?? '') };
  }
}
