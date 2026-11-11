import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { StudentProfile, StudentProfileDocument } from './schemas/student-profile.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { StudentProfilesService } from './student-profiles.service';
import { WalletService } from '../payments/services/wallet.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/schemas/notification.schema';

const DEFAULT_REWARD_XAF = 2000;

/**
 * Campus ambassadors' referrals. Someone enters an ambassador's code (at sign-up or later,
 * once); when that person becomes a tenant on an active lease, the ambassador earns a fixed
 * reward (AMBASSADOR_REWARD_XAF, 2,000 XAF by default) in their HoroHouse wallet. Each
 * referred person earns it once, claimed atomically so it can't be paid twice.
 * Before, codes could be checked but nobody recorded using one, and nothing was ever paid.
 */
@Injectable()
export class AmbassadorReferralsService {
  private readonly logger = new Logger(AmbassadorReferralsService.name);
  private readonly reward: number;

  constructor(
    @InjectModel(StudentProfile.name) private readonly profileModel: Model<StudentProfileDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly profiles: StudentProfilesService,
    private readonly wallet: WalletService,
    private readonly notifications: NotificationsService,
    config: ConfigService,
  ) {
    const set = Number(config.get('AMBASSADOR_REWARD_XAF'));
    this.reward = Number.isFinite(set) && set >= 0 && config.get('AMBASSADOR_REWARD_XAF') !== undefined ? set : DEFAULT_REWARD_XAF;
  }

  /** Use an ambassador's code. Once per person, never your own. */
  async useCode(userId: string, rawCode: string): Promise<{ ambassadorName: string }> {
    const code = String(rawCode ?? '').trim().toUpperCase();
    if (!/^[A-Z0-9-]{3,20}$/.test(code)) throw new BadRequestException('Enter a valid ambassador code.');
    const profile: any = await this.profileModel.findOne({ ambassadorCode: code, isAmbassador: true }).select('userId').lean().exec();
    if (!profile) throw new NotFoundException('No campus ambassador uses this code.');
    if (String(profile.userId) === String(userId)) throw new BadRequestException('You can’t use your own code.');

    const res = await this.userModel.updateOne(
      { _id: new Types.ObjectId(userId), referredByAmbassador: { $exists: false } },
      { $set: { referredByAmbassador: profile._id, referredAt: new Date() } },
    );
    if (!res.modifiedCount) throw new ConflictException('You’ve already used an ambassador code.');
    // (referralCount counts referrals that earned a reward; creditAmbassadorEarning adds those)

    const ambassador: any = await this.userModel.findById(profile.userId).select('name').lean().exec();
    return { ambassadorName: String(ambassador?.name ?? '').split(' ')[0] || 'your ambassador' };
  }

  /** The code this user used, if any */
  async myReferrer(userId: string): Promise<{ code: string; ambassadorName: string } | null> {
    const me: any = await this.userModel.findById(userId).select('referredByAmbassador').lean().exec();
    if (!me?.referredByAmbassador) return null;
    const profile: any = await this.profileModel.findById(me.referredByAmbassador).select('ambassadorCode userId').lean().exec();
    if (!profile) return null;
    const ambassador: any = await this.userModel.findById(profile.userId).select('name').lean().exec();
    return { code: profile.ambassadorCode, ambassadorName: String(ambassador?.name ?? '').split(' ')[0] };
  }

  /** An ambassador's referrals: first name, when, and whether they've earned the reward yet */
  async referralsOf(ambassadorUserId: string): Promise<{ name: string; joinedAt: Date; rewarded: boolean }[]> {
    const profile: any = await this.profileModel.findOne({ userId: new Types.ObjectId(ambassadorUserId) }).select('_id').lean().exec();
    if (!profile) return [];
    const users: any[] = await this.userModel
      .find({ referredByAmbassador: profile._id })
      .select('name referredAt referralRewardedAt')
      .sort({ referredAt: -1 })
      .limit(200)
      .lean()
      .exec();
    return users.map((u) => ({
      name: String(u.name ?? '').split(' ')[0] || '—',
      joinedAt: u.referredAt,
      rewarded: !!u.referralRewardedAt,
    }));
  }

  get rewardAmount(): number {
    return this.reward;
  }

  /** A lease became active: pay the ambassador of each tenant who was referred (once each). */
  async rewardTenants(leaseId: string, tenantUserIds: string[]): Promise<number> {
    if (this.reward <= 0) return 0;
    let paid = 0;
    for (const tenantId of tenantUserIds) {
      let claimedId: Types.ObjectId | null = null;
      try {
        const claimed: any = await this.userModel.findOneAndUpdate(
          { _id: new Types.ObjectId(tenantId), referredByAmbassador: { $exists: true }, referralRewardedAt: { $exists: false } },
          { $set: { referralRewardedAt: new Date() } },
          { new: true },
        ).select('referredByAmbassador name').lean().exec();
        if (!claimed) continue;
        claimedId = claimed._id;
        const profile: any = await this.profileModel.findById(claimed.referredByAmbassador).select('userId isAmbassador').lean().exec();
        if (!profile?.isAmbassador) continue;
        await this.wallet.creditWallet(
          String(profile.userId),
          this.reward,
          `Ambassador reward: ${String(claimed.name ?? '').split(' ')[0] || 'a referred student'} signed a lease`,
          `AMB-${leaseId}-${tenantId}`,
        );
        await this.profiles.creditAmbassadorEarning(String(profile._id), this.reward, 'student');
        paid++;
        await this.notifications.create(
          {
            userId: String(profile.userId),
            type: NotificationType.SYSTEM,
            title: 'You earned an ambassador reward',
            message: `${this.reward.toLocaleString('en-US')} XAF is in your wallet: someone you referred signed a lease.`,
            link: '/student/ambassador',
            metadata: { leaseId },
          } as any,
          {
            title: 'Vous avez gagné une récompense ambassadeur',
            message: `${this.reward.toLocaleString('fr-FR')} XAF sont dans votre portefeuille : une personne que vous avez parrainée a signé un bail.`,
          },
        ).catch(() => undefined);
      } catch (err: any) {
        this.logger.error(`Ambassador reward for tenant ${tenantId} (lease ${leaseId}) failed: ${err?.message}`);
        // Not paid: let the next lease try again
        if (claimedId) await this.userModel.updateOne({ _id: claimedId }, { $unset: { referralRewardedAt: 1 } }).catch(() => undefined);
      }
    }
    return paid;
  }
}
