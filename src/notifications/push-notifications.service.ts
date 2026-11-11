import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Expo as ExpoType, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { DevicesService } from '../devices/devices.service';
import { pushImageUrl } from './push-image';

// Forces a genuine runtime dynamic import, bypassing TypeScript's
// CommonJS transpilation of `import()` into `require()`.
const dynamicImport = new Function('modulePath', 'return import(modulePath)') as (
  modulePath: string,
) => Promise<any>;

@Injectable()
export class PushNotificationsService implements OnModuleInit {
  private readonly logger = new Logger(PushNotificationsService.name);
  private expo: ExpoType;
  private ExpoClass: typeof ExpoType;

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private devicesService: DevicesService,
  ) {}

  async onModuleInit() {
    const { Expo } = await dynamicImport('expo-server-sdk');
    this.ExpoClass = Expo;

    const accessToken = process.env.EXPO_ACCESS_TOKEN;
    if (!accessToken) {
      this.logger.warn(
        '⚠️  EXPO_ACCESS_TOKEN is not set! Push notifications will likely fail. ' +
        'Generate one at https://expo.dev → Settings → Access Tokens',
      );
    }
    this.expo = new Expo({ accessToken: accessToken || undefined });
    this.logger.log(`Expo Push SDK initialised (accessToken: ${accessToken ? 'YES' : 'MISSING'})`);
  }

 async sendToUser(
  userId: string,
  payload: {
    title: string;
    body: string;
    data?: Record<string, any>;
    /** Big photo under the text (e.g. the listing's main photo) */
    image?: string;
  },
): Promise<void> {
  try {
      if (!userId) return;
      const userStr = userId.toString();
      this.logger.log(`📨 sendToUser called for user=${userStr}, title="${payload.title}"`);

      const user = await this.userModel.findById(userStr).lean().catch(() => null);

      if (!user) {
        this.logger.warn(`User ${userStr} not found in database — cannot send push`);
        return;
      }

      if (!user?.pushTokens?.length) {
        this.logger.warn(
          `🚫 No push tokens for user ${userStr}. ` +
          `The user must open the app on a real device and grant notification permission first.`,
        );
        return;
      }

      this.logger.log(`Found ${user.pushTokens.length} push token(s) for user ${userStr}: ${
        user.pushTokens.map((t: any) => `${t.platform}:${t.token.slice(0, 25)}...`).join(', ')
      }`);

      if (user.pushNotifications === false) {
        this.logger.debug(`User ${userStr} has push notifications disabled in preferences`);

        return;
      }

      // Photo: Android shows it directly; iPhone needs the app's notification
      // service extension (assets/NotificationService.m), which reads it from
      // richContent or data.image. Without the extension the push still
      // arrives, just without the photo.
      const image = pushImageUrl(payload.image);
      const data = { ...(payload.data ?? {}), ...(image ? { image } : {}) };

      const messages: ExpoPushMessage[] = [];
      for (const { token } of user.pushTokens) {
        if (!this.ExpoClass.isExpoPushToken(token)) {
          this.logger.warn(`Invalid Expo push token skipped: ${token}`);
          continue;
        }
        const message: ExpoPushMessage = {
          to: token,
          sound: 'default',
          title: payload.title,
          body: payload.body,
          data,
          channelId: 'default',
          priority: 'high',
        };
        if (image) {
          // richContent / mutableContent need expo-server-sdk 3.15+; the cast
          // keeps older typings compiling (older SDKs just pass the fields on)
          (message as any).richContent = { image };
          (message as any).mutableContent = true;
        }
        messages.push(message);
      }

     const chunks = this.expo.chunkPushNotifications(messages);
    const invalidTokens: string[] = [];
    const ticketIds: string[] = [];        // ← collect ticket ids
    const ticketTokenMap = new Map<string, string>(); // ticket id → token, for logging

    for (const chunk of chunks) {
      try {
        const tickets: ExpoPushTicket[] = await this.expo.sendPushNotificationsAsync(chunk);
        tickets.forEach((ticket, i) => {
          if (ticket.status === 'ok') {
            this.logger.log(`Ticket accepted by Expo (not yet confirmed delivered): ${ticket.id}`);
            ticketIds.push(ticket.id);
            ticketTokenMap.set(ticket.id, chunk[i].to as string);
          } else if (ticket.status === 'error') {
            this.logger.error(`❌ Push error: ${ticket.message}`);
            if (ticket.details?.error === 'DeviceNotRegistered') {
              invalidTokens.push(chunk[i].to as string);
            }
          }
        });
      } catch (err: any) {
        this.logger.error(`Push chunk failed: ${err?.message}`);
      }
    }

    if (invalidTokens.length) {
      await this.devicesService.removeInvalidTokens(invalidTokens);
    }

    // ← NEW: check receipts ~a few seconds later (Expo recommends waiting;
    // don't block the request thread on it — fire and forget is fine here)
    if (ticketIds.length) {
      setTimeout(() => this.checkReceipts(ticketIds, ticketTokenMap), 15_000);
    }
  } catch (err: any) {
    this.logger.error(`sendToUser error: ${err?.message}`);
  }
}

private async checkReceipts(ticketIds: string[], ticketTokenMap: Map<string, string>) {
  const receiptChunks = this.expo.chunkPushNotificationReceiptIds(ticketIds);
  for (const chunk of receiptChunks) {
    try {
      const receipts = await this.expo.getPushNotificationReceiptsAsync(chunk);
      for (const [ticketId, receipt] of Object.entries(receipts)) {
        if (receipt.status === 'error') {
          this.logger.error(
            `🚨 Delivery FAILED for token ${ticketTokenMap.get(ticketId)}: ` +
            `${receipt.message} (${receipt.details?.error ?? 'unknown'})`,
          );
          this.logger.error(`Full receipt: ${JSON.stringify(receipt)}`);
          if (receipt.details?.error === 'DeviceNotRegistered') {
            await this.devicesService.removeInvalidTokens([ticketTokenMap.get(ticketId)!]);
          }
        } else {
          this.logger.log(`✅ Confirmed delivered: ${ticketTokenMap.get(ticketId)}`);
        }
      }
    } catch (err: any) {
      this.logger.error(`Receipt check failed: ${err?.message}`);
    }
  }
  }
}
