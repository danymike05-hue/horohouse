import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';

@Injectable()
export class DevicesService {
  private readonly logger = new Logger(DevicesService.name);

  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async registerToken(
    userId: string,
    token: string,
    platform: 'ios' | 'android',
    deviceId?: string,
  ) {
    const userObj = Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : userId;

    // Remove this exact token from any OTHER user first (device changed accounts)
    await this.userModel.updateMany(
      { _id: { $ne: userObj }, 'pushTokens.token': token },
      { $pull: { pushTokens: { token } } },
    );

    // Remove any existing entry for this token on THIS user, then push fresh
    await this.userModel.updateOne(
      { _id: userObj },
      { $pull: { pushTokens: { token } } },
    );

    await this.userModel.updateOne(
      { _id: userObj },
      {
        $push: {
          pushTokens: { token, platform, deviceId, updatedAt: new Date() },
        },
      },
    );

    this.logger.log(`Registered push token for user ${userId} (${platform})`);
    return { success: true };
  }

  async removeInvalidTokens(tokens: string[]) {
    if (!tokens.length) return;
    await this.userModel.updateMany(
      {},
      { $pull: { pushTokens: { token: { $in: tokens } } } },
    );
    this.logger.warn(`Removed ${tokens.length} invalid push token(s)`);
  }
}