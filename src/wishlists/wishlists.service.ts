import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomBytes } from 'crypto';
import { Wishlist, WishlistDocument } from './wishlist.schema';
import { Property, PropertyDocument, ApprovalStatus } from '../properties/schemas/property.schema';
import { User, UserDocument } from '../users/schemas/user.schema';

const MAX_LISTS = 50;
const MAX_PER_LIST = 500;
/** Fields a listing card needs — nothing private */
const CARD_FIELDS =
  'title images price originalPrice currency city neighborhood listingType type pricingUnit averageRating reviewCount ' +
  'shortTermAmenities.maxGuests amenities.bedrooms isInstantBookable latitude longitude';

const oid = (v: string, what = 'ID') => {
  if (!Types.ObjectId.isValid(v)) throw new BadRequestException(`Invalid ${what}`);
  return new Types.ObjectId(v);
};

@Injectable()
export class WishlistsService {
  constructor(
    @InjectModel(Wishlist.name) private readonly wishlistModel: Model<WishlistDocument>,
    @InjectModel(Property.name) private readonly propertyModel: Model<PropertyDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  private webBase() {
    return (process.env.PUBLIC_WEB_URL || 'https://horohouse.com').replace(/\/+$/, '');
  }

  private shareLink(token?: string | null) {
    // Same path as the app screen (app/wishlists/shared/[token]) so a universal link opens it
    return token ? `${this.webBase()}/wishlists/shared/${token}` : null;
  }

  /** My lists with a cover photo (first listing that still has one) and a count */
  async myLists(userId: string) {
    const lists = await this.wishlistModel.find({ ownerId: oid(userId) }).sort({ updatedAt: -1 }).lean().exec();
    const firstIds = lists.flatMap((l) => l.propertyIds.slice(-4));
    const covers = await this.propertyModel
      .find({ _id: { $in: firstIds } })
      .select('images')
      .lean()
      .exec();
    const coverOf = new Map(covers.map((p: any) => [String(p._id), p.images?.[0]?.url ?? null]));
    return lists.map((l) => ({
      id: String(l._id),
      name: l.name,
      count: l.propertyIds.length,
      // Most recently added first
      coverUrls: [...l.propertyIds].reverse().map((id) => coverOf.get(String(id))).filter(Boolean).slice(0, 4),
      propertyIds: l.propertyIds.map(String),
      shareLink: this.shareLink(l.shareToken),
      updatedAt: l.updatedAt,
    }));
  }

  async create(userId: string, name: string, propertyId?: string) {
    const clean = String(name ?? '').trim().slice(0, 50);
    if (!clean) throw new BadRequestException('Give your wishlist a name');
    const count = await this.wishlistModel.countDocuments({ ownerId: oid(userId) });
    if (count >= MAX_LISTS) throw new BadRequestException(`You can have up to ${MAX_LISTS} wishlists`);
    const ids = propertyId ? [await this.assertListing(propertyId)] : [];
    const list = await this.wishlistModel.create({ ownerId: oid(userId), name: clean, propertyIds: ids });
    if (ids.length) await this.userModel.updateOne({ _id: userId }, { $addToSet: { favorites: ids[0] } });
    return { id: String(list._id), name: list.name, count: ids.length };
  }

  async rename(userId: string, id: string, name: string) {
    const clean = String(name ?? '').trim().slice(0, 50);
    if (!clean) throw new BadRequestException('Give your wishlist a name');
    const res = await this.wishlistModel.updateOne({ _id: oid(id), ownerId: oid(userId) }, { $set: { name: clean } });
    if (!res.matchedCount) throw new NotFoundException('Wishlist not found');
    return { id, name: clean };
  }

  async remove(userId: string, id: string) {
    const list = await this.wishlistModel.findOneAndDelete({ _id: oid(id), ownerId: oid(userId) }).lean().exec();
    if (!list) throw new NotFoundException('Wishlist not found');
    await this.unsaveOrphans(userId, list.propertyIds);
    return { deleted: true };
  }

  private async assertListing(propertyId: string) {
    const _id = oid(propertyId, 'listing ID');
    const ok = await this.propertyModel.exists({ _id });
    if (!ok) throw new NotFoundException('Listing not found');
    return _id;
  }

  async addProperty(userId: string, id: string, propertyId: string) {
    const pid = await this.assertListing(propertyId);
    const list = await this.wishlistModel.findOne({ _id: oid(id), ownerId: oid(userId) }).select('propertyIds').lean().exec();
    if (!list) throw new NotFoundException('Wishlist not found');
    if (list.propertyIds.length >= MAX_PER_LIST) throw new BadRequestException('This wishlist is full');
    // $pull then $push keeps the newest at the end (used for the cover)
    await this.wishlistModel.updateOne({ _id: list._id }, { $pull: { propertyIds: pid } });
    await this.wishlistModel.updateOne({ _id: list._id }, { $push: { propertyIds: pid } });
    await this.userModel.updateOne({ _id: userId }, { $addToSet: { favorites: pid } });
    return { added: true };
  }

  async removeProperty(userId: string, id: string, propertyId: string) {
    const pid = oid(propertyId, 'listing ID');
    const res = await this.wishlistModel.updateOne({ _id: oid(id), ownerId: oid(userId) }, { $pull: { propertyIds: pid } });
    if (!res.matchedCount) throw new NotFoundException('Wishlist not found');
    await this.unsaveOrphans(userId, [pid]);
    return { removed: true };
  }

  /** A place in no list anymore is no longer "saved" (the heart turns off) */
  private async unsaveOrphans(userId: string, ids: Types.ObjectId[]) {
    if (!ids.length) return;
    const stillListed = await this.wishlistModel
      .find({ ownerId: oid(userId), propertyIds: { $in: ids } })
      .select('propertyIds')
      .lean()
      .exec();
    const keep = new Set(stillListed.flatMap((l) => l.propertyIds.map(String)));
    const drop = ids.filter((i) => !keep.has(String(i)));
    if (drop.length) await this.userModel.updateOne({ _id: userId }, { $pull: { favorites: { $in: drop } } });
  }

  /** Which of my lists hold this listing (for the checkmarks in "Save to wishlist") */
  async listsContaining(userId: string, propertyId: string) {
    const pid = oid(propertyId, 'listing ID');
    const lists = await this.wishlistModel.find({ ownerId: oid(userId), propertyIds: pid }).select('_id').lean().exec();
    return lists.map((l) => String(l._id));
  }

  private async cards(ids: Types.ObjectId[], onlyPublic: boolean) {
    const q: any = { _id: { $in: ids } };
    if (onlyPublic) Object.assign(q, { isActive: true, approvalStatus: ApprovalStatus.APPROVED });
    const rows = await this.propertyModel.find(q).select(CARD_FIELDS).lean().exec();
    const byId = new Map(rows.map((r: any) => [String(r._id), r]));
    // Keep the list order, newest first; listings that disappeared are skipped
    return [...ids].reverse().map((i) => byId.get(String(i))).filter(Boolean);
  }

  async detail(userId: string, id: string) {
    const list = await this.wishlistModel.findOne({ _id: oid(id), ownerId: oid(userId) }).lean().exec();
    if (!list) throw new NotFoundException('Wishlist not found');
    return {
      id: String(list._id),
      name: list.name,
      shareLink: this.shareLink(list.shareToken),
      properties: await this.cards(list.propertyIds, true),
    };
  }

  async share(userId: string, id: string) {
    const list = await this.wishlistModel.findOne({ _id: oid(id), ownerId: oid(userId) }).select('shareToken').lean().exec();
    if (!list) throw new NotFoundException('Wishlist not found');
    let token = list.shareToken;
    if (!token) {
      token = randomBytes(16).toString('hex');
      await this.wishlistModel.updateOne({ _id: list._id }, { $set: { shareToken: token } });
    }
    return { shareLink: this.shareLink(token), token };
  }

  async stopSharing(userId: string, id: string) {
    const res = await this.wishlistModel.updateOne({ _id: oid(id), ownerId: oid(userId) }, { $unset: { shareToken: '' } });
    if (!res.matchedCount) throw new NotFoundException('Wishlist not found');
    return { shareLink: null };
  }

  /** Public: anyone with the link sees the list name, the owner's first name and the places */
  async shared(token: string) {
    if (!/^[a-f0-9]{32}$/.test(String(token))) throw new NotFoundException('Wishlist not found');
    const list = await this.wishlistModel.findOne({ shareToken: token }).lean().exec();
    if (!list) throw new NotFoundException('Wishlist not found');
    const owner: any = await this.userModel.findById(list.ownerId).select('name profilePicture').lean().exec();
    return {
      name: list.name,
      ownerFirstName: String(owner?.name ?? '').trim().split(/\s+/)[0] || null,
      ownerPicture: owner?.profilePicture ?? null,
      properties: await this.cards(list.propertyIds, true),
    };
  }
}
