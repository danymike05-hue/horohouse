import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    Request,
    UseInterceptors,
    UploadedFiles,
    BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt.auth.guard';

import { ChatService } from './chat.service';
import { CallService } from './call.service';
import {
    CreateConversationDto,
    SendMessageDto,
    GetMessagesQueryDto,
    GetConversationsQueryDto,
    EditMessageDto,
    MarkAsReadDto,
    ArchiveConversationDto,
} from './dto/chat.dto';
import { uploadBufferToCloudinary } from '../utils/cloudinary';
import { MessageType } from './schemas/message.schema';
import { InitiateCallDto } from './dto/call.dto';
import { ChatGateway } from './chat.gateway';

@ApiTags('Chat')
@ApiBearerAuth()
@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
    constructor(
        private readonly chatService: ChatService,
        private readonly callService: CallService,
        private readonly chatGateway: ChatGateway,
    ) { }

    /**
     * Create or get conversation
     */
    @Post('conversations')
    @ApiOperation({ summary: 'Create or get existing conversation' })
    async createConversation(
        @Request() req,
        @Body() dto: CreateConversationDto,
    ) {
        return this.chatService.createConversation(req.user.userId, dto);
    }

    /**
     * Get user's conversations
     */
    @Get('conversations')
    @ApiOperation({ summary: 'Get user conversations with pagination' })
    async getConversations(
        @Request() req,
        @Query() query: GetConversationsQueryDto,
    ): Promise<any> {
        return this.chatService.getConversations(req.user.userId, query);
    }

    /**
     * Get single conversation
     */
    @Get('conversations/:id')
    @ApiOperation({ summary: 'Get conversation by ID' })
    async getConversation(
        @Request() req,
        @Param('id') id: string,
    ) {
        return this.chatService.getConversation(id, req.user.userId);
    }

    /**
     * Archive/unarchive conversation
     */
    @Put('conversations/:id/archive')
    @ApiOperation({ summary: 'Archive or unarchive conversation' })
    async archiveConversation(
        @Request() req,
        @Param('id') id: string,
        @Body() dto: ArchiveConversationDto,
    ) {
        return this.chatService.archiveConversation(id, req.user.userId, dto.archive);
    }

    /**
     * Delete conversation
     */
    @Delete('conversations/:id')
    @ApiOperation({ summary: 'Delete conversation (archive for user)' })
    async deleteConversation(
        @Request() req,
        @Param('id') id: string,
    ) {
        await this.chatService.deleteConversation(id, req.user.userId);
        return { message: 'Conversation deleted successfully' };
    }

    /**
     * Send message (REST endpoint - for non-realtime clients)
     */
    @Post('messages')
    @ApiOperation({ summary: 'Send a message' })
    async sendMessage(
        @Request() req,
        @Body() dto: SendMessageDto,
    ) {
        return this.chatService.sendMessage(req.user.userId, dto);
    }

    /**
     * Send message with attachments
     */
    @Post('messages/with-attachments')
    @ApiOperation({ summary: 'Send message with file attachments' })
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(FilesInterceptor('files', 5)) // Max 5 files
    async sendMessageWithAttachments(@Request() req, @Body() dto: SendMessageDto, @UploadedFiles() files: Express.Multer.File[]) {
        if (!files || files.length === 0) {
            throw new BadRequestException('No files uploaded');
        }

        // Upload files to Cloudinary
        const attachments = await Promise.all(
            files.map(async (file, index) => {
                const publicId = `chat_${dto.conversationId}_${Date.now()}_${index}`;
                const folder = file.mimetype.startsWith('image/')
                    ? 'horohouse/chat/images'
                    : file.mimetype.startsWith('video/')
                        ? 'horohouse/chat/videos'
                        : 'horohouse/chat/documents';

                const resourceType = file.mimetype.startsWith('image/')
                    ? 'image'
                    : file.mimetype.startsWith('video/')
                        ? 'video'
                        : 'raw';

                const result = await uploadBufferToCloudinary(file.buffer, {
                    publicId,
                    folder,
                    resourceType: resourceType as 'image' | 'video' | 'raw',
                });

                return {
                    url: result.secure_url,
                    publicId: result.public_id,
                    filename: file.originalname,
                    size: file.size,
                    mimeType: file.mimetype,
                };
            }),
        );

        let messageType: MessageType = MessageType.DOCUMENT;

        if (files[0].mimetype.startsWith('image/')) {
            messageType = MessageType.IMAGE;
        } else if (files[0].mimetype.startsWith('video/')) {
            messageType = MessageType.VIDEO;
        } else if (files[0].mimetype.startsWith('audio/')) {
            messageType = MessageType.AUDIO;
        }

        const messageDto = { ...dto, type: messageType, attachments };
        const message = await this.chatService.sendMessage(req.user.userId, messageDto as any);

        this.chatGateway.broadcastNewMessage(dto.conversationId, message);

        return message;
    }

    /**
     * Get messages in conversation
     */
    @Get('conversations/:id/messages')
    @ApiOperation({ summary: 'Get messages in conversation with pagination' })
    async getMessages(
        @Request() req,
        @Param('id') conversationId: string,
        @Query() query: GetMessagesQueryDto,
    ) {
        return this.chatService.getMessages(conversationId, req.user.userId, query);
    }

    /**
     * Mark messages as read
     */
    @Post('messages/mark-read')
    @ApiOperation({ summary: 'Mark messages as read' })
    async markMessagesAsRead(
        @Request() req,
        @Body() dto: MarkAsReadDto & { conversationId: string },
    ) {
        await this.chatService.markMessagesAsRead(
            dto.conversationId,
            req.user.userId,
            dto.messageIds,
        );
        return { message: 'Messages marked as read' };
    }

    /**
     * Edit message
     */
    @Put('messages/:id')
    @ApiOperation({ summary: 'Edit a message' })
    async editMessage(
        @Request() req,
        @Param('id') messageId: string,
        @Body() dto: EditMessageDto,
    ) {
        return this.chatService.editMessage(messageId, req.user.userId, dto);
    }

    /**
     * Delete message
     */
    @Delete('messages/:id')
    @ApiOperation({ summary: 'Delete a message' })
    async deleteMessage(
        @Request() req,
        @Param('id') messageId: string,
    ) {
        await this.chatService.deleteMessage(messageId, req.user.userId);
        return { message: 'Message deleted successfully' };
    }

    /**
     * Get unread messages count
     */
    @Get('unread-count')
    @ApiOperation({ summary: 'Get total unread messages count' })
    async getUnreadCount(@Request() req) {
        const count = await this.chatService.getUnreadCount(req.user.userId);
        return { unreadCount: count };
    }

    /**
   * Get call history for conversation
   */
    @Get('conversations/:id/calls')
    @ApiOperation({ summary: 'Get call history for conversation' })
    async getConversationCallHistory(
        @Request() req,
        @Param('id') conversationId: string,
        @Query('limit') limit?: number,
    ) {
        return this.callService.getCallHistory(conversationId, req.user.userId, limit);
    }

    /**
     * Get user's call history
     */
    @Get('calls/history')
    @ApiOperation({ summary: 'Get user call history' })
    async getUserCallHistory(
        @Request() req,
        @Query('limit') limit?: number,
    ) {
        return this.callService.getUserCallHistory(req.user.userId, limit);
    }

    /**
     * Get call by ID
     */
    @Get('calls/:id')
    @ApiOperation({ summary: 'Get call by ID' })
    async getCall(@Param('id') id: string) {
        return this.callService.getCall(id);
    }

    /**
     * Initiate call (REST endpoint - mainly for testing)
     */
    @Post('calls/initiate')
    @ApiOperation({ summary: 'Initiate a call (use WebSocket for real-time)' })
    async initiateCall(@Request() req, @Body() dto: InitiateCallDto) {
        return this.callService.initiateCall(req.user.userId, dto);
    }
}