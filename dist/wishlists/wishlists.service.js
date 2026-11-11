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
Object.defineProperty(exports, "__esModule", { value: true });
exports.WishlistsService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const crypto_1 = require("crypto");
const wishlist_schema_1 = require("./wishlist.schema");
const property_schema_1 = require("../properties/schemas/property.schema");
const user_schema_1 = require("../users/schemas/user.schema");
const MAX_LISTS = 50;
const MAX_PER_LIST = 500;
const CARD_FIELDS = 'title images price originalPrice currency city neighborhood listingType type pricingUnit averageRating reviewCount ' +
    'shortTermAmenities.maxGuests amenities.bedrooms isInstantBookable latitude longitude';
const oid = (v, what = 'ID') => {
    if (!mongoose_2.Types.ObjectId.isValid(v))
        throw new common_1.BadRequestException(`Invalid ${what}`);
    return new mongoose_2.Types.ObjectId(v);
};
let WishlistsService = class WishlistsService {
    wishlistModel;
    propertyModel;
    userModel;
    constructor(wishlistModel, propertyModel, userModel) {
        this.wishlistModel = wishlistModel;
        this.propertyModel = propertyModel;
        this.userModel = userModel;
    }
    webBase() {
        return (process.env.PUBLIC_WEB_URL || 'https://horohouse.com').replace(/\/+$/, '');
    }
    shareLink(token) {
        return token ? `${this.webBase()}/wishlists/shared/${token}` : null;
    }
    async myLists(userId) {
        const lists = await this.wishlistModel.find({ ownerId: oid(userId) }).sort({ updatedAt: -1 }).lean().exec();
        const firstIds = lists.flatMap((l) => l.propertyIds.slice(-4));
        const covers = await this.propertyModel
            .find({ _id: { $in: firstIds } })
            .select('images')
            .lean()
            .exec();
        const coverOf = new Map(covers.map((p) => [String(p._id), p.images?.[0]?.url ?? null]));
        return lists.map((l) => ({
            id: String(l._id),
            name: l.name,
            count: l.propertyIds.length,
            coverUrls: [...l.propertyIds].reverse().map((id) => coverOf.get(String(id))).filter(Boolean).slice(0, 4),
            propertyIds: l.propertyIds.map(String),
            shareLink: this.shareLink(l.shareToken),
            updatedAt: l.updatedAt,
        }));
    }
    async create(userId, name, propertyId) {
        const clean = String(name ?? '').trim().slice(0, 50);
        if (!clean)
            throw new common_1.BadRequestException('Give your wishlist a name');
        const count = await this.wishlistModel.countDocuments({ ownerId: oid(userId) });
        if (count >= MAX_LISTS)
            throw new common_1.BadRequestException(`You can have up to ${MAX_LISTS} wishlists`);
        const ids = propertyId ? [await this.assertListing(propertyId)] : [];
        const list = await this.wishlistModel.create({ ownerId: oid(userId), name: clean, propertyIds: ids });
        if (ids.length)
            await this.userModel.updateOne({ _id: userId }, { $addToSet: { favorites: ids[0] } });
        return { id: String(list._id), name: list.name, count: ids.length };
    }
    async rename(userId, id, name) {
        const clean = String(name ?? '').trim().slice(0, 50);
        if (!clean)
            throw new common_1.BadRequestException('Give your wishlist a name');
        const res = await this.wishlistModel.updateOne({ _id: oid(id), ownerId: oid(userId) }, { $set: { name: clean } });
        if (!res.matchedCount)
            throw new common_1.NotFoundException('Wishlist not found');
        return { id, name: clean };
    }
    async remove(userId, id) {
        const list = await this.wishlistModel.findOneAndDelete({ _id: oid(id), ownerId: oid(userId) }).lean().exec();
        if (!list)
            throw new common_1.NotFoundException('Wishlist not found');
        await this.unsaveOrphans(userId, list.propertyIds);
        return { deleted: true };
    }
    async assertListing(propertyId) {
        const _id = oid(propertyId, 'listing ID');
        const ok = await this.propertyModel.exists({ _id });
        if (!ok)
            throw new common_1.NotFoundException('Listing not found');
        return _id;
    }
    async addProperty(userId, id, propertyId) {
        const pid = await this.assertListing(propertyId);
        const list = await this.wishlistModel.findOne({ _id: oid(id), ownerId: oid(userId) }).select('propertyIds').lean().exec();
        if (!list)
            throw new common_1.NotFoundException('Wishlist not found');
        if (list.propertyIds.length >= MAX_PER_LIST)
            throw new common_1.BadRequestException('This wishlist is full');
        await this.wishlistModel.updateOne({ _id: list._id }, { $pull: { propertyIds: pid } });
        await this.wishlistModel.updateOne({ _id: list._id }, { $push: { propertyIds: pid } });
        await this.userModel.updateOne({ _id: userId }, { $addToSet: { favorites: pid } });
        return { added: true };
    }
    async removeProperty(userId, id, propertyId) {
        const pid = oid(propertyId, 'listing ID');
        const res = await this.wishlistModel.updateOne({ _id: oid(id), ownerId: oid(userId) }, { $pull: { propertyIds: pid } });
        if (!res.matchedCount)
            throw new common_1.NotFoundException('Wishlist not found');
        await this.unsaveOrphans(userId, [pid]);
        return { removed: true };
    }
    async unsaveOrphans(userId, ids) {
        if (!ids.length)
            return;
        const stillListed = await this.wishlistModel
            .find({ ownerId: oid(userId), propertyIds: { $in: ids } })
            .select('propertyIds')
            .lean()
            .exec();
        const keep = new Set(stillListed.flatMap((l) => l.propertyIds.map(String)));
        const drop = ids.filter((i) => !keep.has(String(i)));
        if (drop.length)
            await this.userModel.updateOne({ _id: userId }, { $pull: { favorites: { $in: drop } } });
    }
    async listsContaining(userId, propertyId) {
        const pid = oid(propertyId, 'listing ID');
        const lists = await this.wishlistModel.find({ ownerId: oid(userId), propertyIds: pid }).select('_id').lean().exec();
        return lists.map((l) => String(l._id));
    }
    async cards(ids, onlyPublic) {
        const q = { _id: { $in: ids } };
        if (onlyPublic)
            Object.assign(q, { isActive: true, approvalStatus: property_schema_1.ApprovalStatus.APPROVED });
        const rows = await this.propertyModel.find(q).select(CARD_FIELDS).lean().exec();
        const byId = new Map(rows.map((r) => [String(r._id), r]));
        return [...ids].reverse().map((i) => byId.get(String(i))).filter(Boolean);
    }
    async detail(userId, id) {
        const list = await this.wishlistModel.findOne({ _id: oid(id), ownerId: oid(userId) }).lean().exec();
        if (!list)
            throw new common_1.NotFoundException('Wishlist not found');
        return {
            id: String(list._id),
            name: list.name,
            shareLink: this.shareLink(list.shareToken),
            properties: await this.cards(list.propertyIds, true),
        };
    }
    async share(userId, id) {
        const list = await this.wishlistModel.findOne({ _id: oid(id), ownerId: oid(userId) }).select('shareToken').lean().exec();
        if (!list)
            throw new common_1.NotFoundException('Wishlist not found');
        let token = list.shareToken;
        if (!token) {
            token = (0, crypto_1.randomBytes)(16).toString('hex');
            await this.wishlistModel.updateOne({ _id: list._id }, { $set: { shareToken: token } });
        }
        return { shareLink: this.shareLink(token), token };
    }
    async stopSharing(userId, id) {
        const res = await this.wishlistModel.updateOne({ _id: oid(id), ownerId: oid(userId) }, { $unset: { shareToken: '' } });
        if (!res.matchedCount)
            throw new common_1.NotFoundException('Wishlist not found');
        return { shareLink: null };
    }
    async shared(token) {
        if (!/^[a-f0-9]{32}$/.test(String(token)))
            throw new common_1.NotFoundException('Wishlist not found');
        const list = await this.wishlistModel.findOne({ shareToken: token }).lean().exec();
        if (!list)
            throw new common_1.NotFoundException('Wishlist not found');
        const owner = await this.userModel.findById(list.ownerId).select('name profilePicture').lean().exec();
        return {
            name: list.name,
            ownerFirstName: String(owner?.name ?? '').trim().split(/\s+/)[0] || null,
            ownerPicture: owner?.profilePicture ?? null,
            properties: await this.cards(list.propertyIds, true),
        };
    }
};
exports.WishlistsService = WishlistsService;
exports.WishlistsService = WishlistsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(wishlist_schema_1.Wishlist.name)),
    __param(1, (0, mongoose_1.InjectModel)(property_schema_1.Property.name)),
    __param(2, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model])
], WishlistsService);
//# sourceMappingURL=wishlists.service.js.map