"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var PushNotificationsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PushNotificationsService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const user_schema_1 = require("../users/schemas/user.schema");
const devices_service_1 = require("../devices/devices.service");
const dynamicImport = new Function('modulePath', 'return import(modulePath)');
let PushNotificationsService = PushNotificationsService_1 = class PushNotificationsService {
    userModel;
    devicesService;
    logger = new common_1.Logger(PushNotificationsService_1.name);
    expo;
    ExpoClass;
    constructor(userModel, devicesService) {
        this.userModel = userModel;
        this.devicesService = devicesService;
    }
    async onModuleInit() {
        const { Expo } = await dynamicImport('expo-server-sdk');
        this.ExpoClass = Expo;
        const accessToken = process.env.EXPO_ACCESS_TOKEN;
        if (!accessToken) {
            this.logger.warn('⚠️  EXPO_ACCESS_TOKEN is not set! Push notifications will likely fail. ' +
                'Generate one at https://expo.dev → Settings → Access Tokens');
        }
        this.expo = new Expo({ accessToken: accessToken || undefined });
        this.logger.log(`Expo Push SDK initialised (accessToken: ${accessToken ? 'YES' : 'MISSING'})`);
    }
    async sendToUser(userId, payload) {
        try {
            if (!userId)
                return;
            const userStr = userId.toString();
            this.logger.log(`📨 sendToUser called for user=${userStr}, title="${payload.title}"`);
            const user = await this.userModel.findById(userStr).lean().catch(() => null);
            if (!user) {
                this.logger.warn(`User ${userStr} not found in database — cannot send push`);
                return;
            }
            if (!user?.pushTokens?.length) {
                this.logger.warn(`🚫 No push tokens for user ${userStr}. ` +
                    `The user must open the app on a real device and grant notification permission first.`);
                return;
            }
            this.logger.log(`Found ${user.pushTokens.length} push token(s) for user ${userStr}: ${user.pushTokens.map((t) => `${t.platform}:${t.token.slice(0, 25)}...`).join(', ')}`);
            if (user.pushNotifications === false) {
                this.logger.debug(`User ${userStr} has push notifications disabled in preferences`);
                return;
            }
            const messages = [];
            for (const { token } of user.pushTokens) {
                if (!this.ExpoClass.isExpoPushToken(token)) {
                    this.logger.warn(`Invalid Expo push token skipped: ${token}`);
                    continue;
                }
                messages.push({
                    to: token,
                    sound: 'default',
                    title: payload.title,
                    body: payload.body,
                    data: payload.data ?? {},
                    channelId: 'default',
                    priority: 'high',
                });
            }
            const chunks = this.expo.chunkPushNotifications(messages);
            const invalidTokens = [];
            const ticketIds = [];
            const ticketTokenMap = new Map();
            for (const chunk of chunks) {
                try {
                    const tickets = await this.expo.sendPushNotificationsAsync(chunk);
                    tickets.forEach((ticket, i) => {
                        if (ticket.status === 'ok') {
                            this.logger.log(`Ticket accepted by Expo (not yet confirmed delivered): ${ticket.id}`);
                            ticketIds.push(ticket.id);
                            ticketTokenMap.set(ticket.id, chunk[i].to);
                        }
                        else if (ticket.status === 'error') {
                            this.logger.error(`❌ Push error: ${ticket.message}`);
                            if (ticket.details?.error === 'DeviceNotRegistered') {
                                invalidTokens.push(chunk[i].to);
                            }
                        }
                    });
                }
                catch (err) {
                    this.logger.error(`Push chunk failed: ${err?.message}`);
                }
            }
            if (invalidTokens.length) {
                await this.devicesService.removeInvalidTokens(invalidTokens);
            }
            if (ticketIds.length) {
                setTimeout(() => this.checkReceipts(ticketIds, ticketTokenMap), 15_000);
            }
        }
        catch (err) {
            this.logger.error(`sendToUser error: ${err?.message}`);
        }
    }
    async checkReceipts(ticketIds, ticketTokenMap) {
        const receiptChunks = this.expo.chunkPushNotificationReceiptIds(ticketIds);
        for (const chunk of receiptChunks) {
            try {
                const receipts = await this.expo.getPushNotificationReceiptsAsync(chunk);
                for (const [ticketId, receipt] of Object.entries(receipts)) {
                    if (receipt.status === 'error') {
                        this.logger.error(`🚨 Delivery FAILED for token ${ticketTokenMap.get(ticketId)}: ` +
                            `${receipt.message} (${receipt.details?.error ?? 'unknown'})`);
                        this.logger.error(`Full receipt: ${JSON.stringify(receipt)}`);
                        if (receipt.details?.error === 'DeviceNotRegistered') {
                            await this.devicesService.removeInvalidTokens([ticketTokenMap.get(ticketId)]);
                        }
                    }
                    else {
                        this.logger.log(`✅ Confirmed delivered: ${ticketTokenMap.get(ticketId)}`);
                    }
                }
            }
            catch (err) {
                this.logger.error(`Receipt check failed: ${err?.message}`);
            }
        }
    }
};
exports.PushNotificationsService = PushNotificationsService;
exports.PushNotificationsService = PushNotificationsService = PushNotificationsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        devices_service_1.DevicesService])
], PushNotificationsService);
//# sourceMappingURL=push-notifications.service.js.map