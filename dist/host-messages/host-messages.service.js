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
var HostMessagesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.HostMessagesService = exports.TEMPLATE_TOKENS = exports.GUIDE_DAYS_BEFORE = void 0;
exports.renderTemplate = renderTemplate;
exports.dueAt = dueAt;
exports.dueFor = dueFor;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const cloudinary_1 = require("cloudinary");
const host_message_schema_1 = require("./schemas/host-message.schema");
const property_schema_1 = require("../properties/schemas/property.schema");
const booking_schema_1 = require("../bookings/schema/booking.schema");
const user_schema_1 = require("../users/schemas/user.schema");
const notifications_service_1 = require("../notifications/notifications.service");
const notification_schema_1 = require("../notifications/schemas/notification.schema");
const core_1 = require("@nestjs/core");
const chat_service_1 = require("../chat/chat.service");
const chat_gateway_1 = require("../chat/chat.gateway");
const MAX_TEMPLATES = 30;
const MAX_GUIDE_PHOTOS = 8;
exports.GUIDE_DAYS_BEFORE = 2;
const WAT_OFFSET_HOURS = 1;
const LATE_LIMIT_MS = 24 * 3600_000;
const DAY = 86_400_000;
exports.TEMPLATE_TOKENS = [
    'guest_name', 'host_name', 'listing', 'check_in_date', 'check_out_date',
    'check_in_time', 'check_out_time', 'nights', 'guests', 'address', 'wifi_name', 'wifi_password',
];
const fmtDate = (d) => {
    if (!d)
        return '';
    const x = new Date(d);
    const dd = String(x.getUTCDate()).padStart(2, '0');
    const mm = String(x.getUTCMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${x.getUTCFullYear()}`;
};
const firstName = (n) => String(n ?? '').trim().split(/\s+/)[0] || '';
const idStr = (v) => String(v?._id ?? v ?? '');
function renderTemplate(body, ctx) {
    return body.replace(/\{([a-z_]+)\}/g, (m, key) => (key in ctx ? String(ctx[key] ?? '') : m));
}
function dueAt(date, shiftDays, hhmm) {
    const [h, m] = (hhmm || '10:00').split(':').map((x) => parseInt(x, 10));
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + shiftDays, (Number.isFinite(h) ? h : 10) - WAT_OFFSET_HOURS, Number.isFinite(m) ? m : 0));
}
function dueFor(t, b) {
    const offset = Math.max(0, Number(t.daysOffset ?? 0));
    switch (t.trigger) {
        case host_message_schema_1.MessageTrigger.BOOKING_CONFIRMED:
            return b.confirmedAt ? new Date(b.confirmedAt) : b.paidAt ? new Date(b.paidAt) : null;
        case host_message_schema_1.MessageTrigger.BEFORE_CHECKIN:
            return dueAt(new Date(b.checkIn), -Math.max(1, offset), t.sendTime);
        case host_message_schema_1.MessageTrigger.CHECKIN_DAY:
            return dueAt(new Date(b.checkIn), 0, t.sendTime);
        case host_message_schema_1.MessageTrigger.BEFORE_CHECKOUT:
            return dueAt(new Date(b.checkOut), -offset, t.sendTime);
        case host_message_schema_1.MessageTrigger.AFTER_CHECKOUT:
            return dueAt(new Date(b.checkOut), offset, t.sendTime);
        default:
            return null;
    }
}
let HostMessagesService = HostMessagesService_1 = class HostMessagesService {
    templateModel;
    deliveryModel;
    propertyModel;
    bookingModel;
    userModel;
    moduleRef;
    notifications;
    logger = new common_1.Logger(HostMessagesService_1.name);
    constructor(templateModel, deliveryModel, propertyModel, bookingModel, userModel, moduleRef, notifications) {
        this.templateModel = templateModel;
        this.deliveryModel = deliveryModel;
        this.propertyModel = propertyModel;
        this.bookingModel = bookingModel;
        this.userModel = userModel;
        this.moduleRef = moduleRef;
        this.notifications = notifications;
    }
    async postToChat(b, body) {
        try {
            const chat = this.moduleRef.get(chat_service_1.ChatService, { strict: false });
            if (!chat)
                return false;
            const hostId = idStr(b.hostId);
            const conv = await chat.createConversation(hostId, {
                participantId: idStr(b.guestId),
                propertyId: idStr(b.propertyId),
            });
            const conversationId = idStr(conv?._id);
            if (!conversationId)
                return false;
            const message = await chat.sendMessage(hostId, { conversationId, content: body });
            try {
                const gateway = this.moduleRef.get(chat_gateway_1.ChatGateway, { strict: false });
                gateway?.broadcastNewMessage(conversationId, message);
            }
            catch { }
            return true;
        }
        catch (err) {
            this.logger.warn(`scheduled message not posted in chat (booking ${idStr(b._id)}): ${err?.message}`);
            return false;
        }
    }
    async listTemplates(user, kind) {
        const q = { hostId: user._id };
        if (kind && Object.values(host_message_schema_1.TemplateKind).includes(kind))
            q.kind = kind;
        return this.templateModel.find(q).sort({ kind: 1, createdAt: 1 }).lean().exec();
    }
    async assertOwnListings(user, ids) {
        if (!ids?.length)
            return;
        const count = await this.propertyModel.countDocuments({
            _id: { $in: ids.map((i) => new mongoose_2.Types.ObjectId(i)) },
            $or: [{ ownerId: user._id }, { agentId: user._id }],
        });
        if (count !== new Set(ids).size)
            throw new common_1.ForbiddenException('You can only pick your own listings');
    }
    checkScheduled(kind, trigger) {
        if (kind === host_message_schema_1.TemplateKind.SCHEDULED && !trigger)
            throw new common_1.BadRequestException('Choose when the message is sent');
    }
    async createTemplate(user, dto) {
        const count = await this.templateModel.countDocuments({ hostId: user._id });
        if (count >= MAX_TEMPLATES)
            throw new common_1.BadRequestException(`You can save up to ${MAX_TEMPLATES} messages`);
        this.checkScheduled(dto.kind, dto.trigger);
        await this.assertOwnListings(user, dto.propertyIds);
        const doc = await this.templateModel.create({
            ...dto,
            hostId: user._id,
            trigger: dto.kind === host_message_schema_1.TemplateKind.SCHEDULED ? dto.trigger : undefined,
            propertyIds: (dto.propertyIds ?? []).map((i) => new mongoose_2.Types.ObjectId(i)),
        });
        return doc.toObject();
    }
    async updateTemplate(user, id, dto) {
        if (!mongoose_2.Types.ObjectId.isValid(id))
            throw new common_1.BadRequestException('Invalid id');
        const current = await this.templateModel.findOne({ _id: id, hostId: user._id }).lean().exec();
        if (!current)
            throw new common_1.NotFoundException('Message not found');
        const kind = dto.kind ?? current.kind;
        this.checkScheduled(kind, dto.trigger ?? current.trigger);
        await this.assertOwnListings(user, dto.propertyIds);
        const set = { ...dto };
        if (dto.propertyIds)
            set.propertyIds = dto.propertyIds.map((i) => new mongoose_2.Types.ObjectId(i));
        if (kind === host_message_schema_1.TemplateKind.QUICK_REPLY)
            set.trigger = undefined;
        return this.templateModel.findByIdAndUpdate(id, { $set: set }, { new: true }).lean().exec();
    }
    async deleteTemplate(user, id) {
        if (!mongoose_2.Types.ObjectId.isValid(id))
            throw new common_1.BadRequestException('Invalid id');
        const res = await this.templateModel.deleteOne({ _id: id, hostId: user._id });
        if (!res.deletedCount)
            throw new common_1.NotFoundException('Message not found');
        return { deleted: true };
    }
    async contextFor(booking, host, guest, property) {
        const guide = property?._id
            ? (await this.propertyModel.findById(property._id).select('+checkInGuide').lean().exec())?.checkInGuide ?? {}
            : {};
        const g = booking?.guests ?? {};
        const guestCount = (Number(g.adults) || 0) + (Number(g.children) || 0);
        return {
            guest_name: firstName(guest?.name),
            host_name: firstName(host?.name),
            listing: property?.title ?? '',
            check_in_date: fmtDate(booking?.checkIn),
            check_out_date: fmtDate(booking?.checkOut),
            check_in_time: property?.shortTermAmenities?.checkInTime ?? '',
            check_out_time: property?.shortTermAmenities?.checkOutTime ?? '',
            nights: booking?.nights ? String(booking.nights) : '',
            guests: guestCount ? String(guestCount) : '',
            address: [property?.address, property?.neighborhood, property?.city].filter(Boolean).join(', '),
            wifi_name: guide.wifiName ?? '',
            wifi_password: guide.wifiPassword ?? '',
        };
    }
    async quickReplies(user, guestId, propertyId) {
        const templates = await this.templateModel
            .find({ hostId: user._id, kind: host_message_schema_1.TemplateKind.QUICK_REPLY, isActive: true })
            .sort({ createdAt: 1 })
            .lean()
            .exec();
        if (!templates.length)
            return [];
        let booking = null;
        let guest = null;
        let property = null;
        if (guestId && mongoose_2.Types.ObjectId.isValid(guestId)) {
            const q = { hostId: user._id, guestId: new mongoose_2.Types.ObjectId(guestId) };
            if (propertyId && mongoose_2.Types.ObjectId.isValid(propertyId))
                q.propertyId = new mongoose_2.Types.ObjectId(propertyId);
            booking = await this.bookingModel.findOne(q).sort({ checkIn: -1 }).lean().exec();
            guest = await this.userModel.findById(guestId).select('name').lean().exec();
        }
        const pid = booking?.propertyId ?? (propertyId && mongoose_2.Types.ObjectId.isValid(propertyId) ? propertyId : null);
        if (pid) {
            property = await this.propertyModel
                .findOne({ _id: pid, $or: [{ ownerId: user._id }, { agentId: user._id }] })
                .select('title address neighborhood city shortTermAmenities.checkInTime shortTermAmenities.checkOutTime')
                .lean()
                .exec();
        }
        const ctx = await this.contextFor(booking, user, guest, property);
        return templates.map((tpl) => ({ id: idStr(tpl._id), title: tpl.title, text: renderTemplate(tpl.body, ctx) }));
    }
    async loadOwnedProperty(propertyId, user, extra = '') {
        if (!mongoose_2.Types.ObjectId.isValid(propertyId))
            throw new common_1.BadRequestException('Invalid listing id');
        const p = await this.propertyModel
            .findById(propertyId)
            .select(`ownerId agentId title +checkInGuide ${extra}`)
            .lean()
            .exec();
        if (!p)
            throw new common_1.NotFoundException('Listing not found');
        const isAdmin = user.role === user_schema_1.UserRole.ADMIN;
        if (!isAdmin && idStr(p.ownerId) !== idStr(user._id) && idStr(p.agentId) !== idStr(user._id)) {
            throw new common_1.ForbiddenException('Not your listing');
        }
        return p;
    }
    signPhotos(guide) {
        const photos = Array.isArray(guide?.photos) ? guide.photos : [];
        return {
            ...guide,
            photos: photos.map((ph) => ({
                publicId: ph.publicId,
                caption: ph.caption ?? '',
                url: cloudinary_1.v2.url(ph.publicId, {
                    type: 'authenticated',
                    resource_type: 'image',
                    sign_url: true,
                    secure: true,
                    transformation: [{ width: 1200, crop: 'limit', quality: 'auto', fetch_format: 'auto' }],
                }),
            })),
        };
    }
    static guideHasContent(g) {
        if (!g)
            return false;
        return !!(g.wifiName || g.wifiPassword || g.directions || g.accessInstructions || g.parking || g.houseManual || g.emergencyPhone || g.photos?.length);
    }
    async getGuideForHost(propertyId, user) {
        const p = await this.loadOwnedProperty(propertyId, user);
        return this.signPhotos(p.checkInGuide ?? {});
    }
    async updateGuide(propertyId, dto, user) {
        await this.loadOwnedProperty(propertyId, user);
        const set = { 'checkInGuide.updatedAt': new Date() };
        for (const [k, v] of Object.entries(dto)) {
            if (v !== undefined)
                set[`checkInGuide.${k}`] = typeof v === 'string' ? v.trim() : v;
        }
        await this.propertyModel.updateOne({ _id: propertyId }, { $set: set });
        return this.getGuideForHost(propertyId, user);
    }
    async addGuidePhoto(propertyId, buffer, caption, user) {
        const p = await this.loadOwnedProperty(propertyId, user);
        const count = p.checkInGuide?.photos?.length ?? 0;
        if (count >= MAX_GUIDE_PHOTOS)
            throw new common_1.BadRequestException(`Up to ${MAX_GUIDE_PHOTOS} photos in the guide`);
        const up = await new Promise((resolve, reject) => {
            const stream = cloudinary_1.v2.uploader.upload_stream({ folder: 'horohouse/check-in-guides', resource_type: 'image', type: 'authenticated' }, (err, result) => (err ? reject(err) : resolve(result)));
            stream.end(buffer);
        });
        await this.propertyModel.updateOne({ _id: propertyId }, {
            $push: { 'checkInGuide.photos': { url: up.secure_url, publicId: up.public_id, caption: (caption ?? '').slice(0, 120) } },
            $set: { 'checkInGuide.updatedAt': new Date() },
        });
        return this.getGuideForHost(propertyId, user);
    }
    async removeGuidePhoto(propertyId, publicId, user) {
        const p = await this.loadOwnedProperty(propertyId, user);
        const wanted = decodeURIComponent(publicId);
        const photos = p.checkInGuide?.photos ?? [];
        if (!photos.some((x) => x.publicId === wanted))
            throw new common_1.NotFoundException('Photo not found');
        await this.propertyModel.updateOne({ _id: propertyId }, { $pull: { 'checkInGuide.photos': { publicId: wanted } } });
        cloudinary_1.v2.uploader.destroy(wanted, { type: 'authenticated', resource_type: 'image' }).catch(() => undefined);
        return this.getGuideForHost(propertyId, user);
    }
    async loadBookingFor(bookingId, user) {
        if (!mongoose_2.Types.ObjectId.isValid(bookingId))
            throw new common_1.BadRequestException('Invalid booking id');
        const b = await this.bookingModel.findById(bookingId).lean().exec();
        if (!b)
            throw new common_1.NotFoundException('Booking not found');
        const isGuest = idStr(b.guestId) === idStr(user._id);
        const isHost = idStr(b.hostId) === idStr(user._id);
        const isAdmin = user.role === user_schema_1.UserRole.ADMIN;
        if (!isGuest && !isHost && !isAdmin)
            throw new common_1.ForbiddenException('Not your booking');
        return { b, isGuest, isHost: isHost || isAdmin };
    }
    async getGuideForBooking(bookingId, user) {
        const { b, isHost } = await this.loadBookingFor(bookingId, user);
        const property = await this.propertyModel
            .findById(b.propertyId)
            .select('title address neighborhood city latitude longitude houseRules shortTermAmenities.checkInTime shortTermAmenities.checkOutTime +checkInGuide')
            .lean()
            .exec();
        if (!property)
            throw new common_1.NotFoundException('Listing not found');
        const availableFrom = new Date(new Date(b.checkIn).getTime() - exports.GUIDE_DAYS_BEFORE * DAY);
        const availableUntil = new Date(new Date(b.checkOut).getTime() + DAY);
        const paidStay = b.status === booking_schema_1.BookingStatus.CONFIRMED && b.paymentStatus === booking_schema_1.PaymentStatus.PAID;
        const now = new Date();
        const open = isHost || (paidStay && now >= availableFrom && now <= availableUntil);
        const hasGuide = HostMessagesService_1.guideHasContent(property.checkInGuide);
        const base = {
            available: open && hasGuide,
            hasGuide,
            availableFrom,
            listing: { title: property.title },
            checkInTime: property.shortTermAmenities?.checkInTime ?? null,
            checkOutTime: property.shortTermAmenities?.checkOutTime ?? null,
        };
        if (!open || !hasGuide) {
            return { ...base, reason: !paidStay && !isHost ? 'not_confirmed' : !hasGuide ? 'no_guide' : now < availableFrom ? 'too_early' : 'ended' };
        }
        return {
            ...base,
            address: [property.address, property.neighborhood, property.city].filter(Boolean).join(', '),
            latitude: property.latitude ?? null,
            longitude: property.longitude ?? null,
            checkInMethod: property.houseRules?.checkInMethod ?? null,
            guide: this.signPhotos(property.checkInGuide ?? {}),
        };
    }
    async messagesForBooking(bookingId, user) {
        const { b } = await this.loadBookingFor(bookingId, user);
        return this.deliveryModel
            .find({ bookingId: b._id })
            .select('title body sentAt')
            .sort({ sentAt: 1 })
            .lean()
            .exec();
    }
    async runScheduledMessages(now = new Date()) {
        const templates = await this.templateModel
            .find({ kind: host_message_schema_1.TemplateKind.SCHEDULED, isActive: true, trigger: { $exists: true, $ne: null } })
            .lean()
            .exec();
        if (!templates.length)
            return 0;
        const byHost = new Map();
        for (const t of templates) {
            const k = idStr(t.hostId);
            if (!byHost.has(k))
                byHost.set(k, []);
            byHost.get(k).push(t);
        }
        const from = new Date(now.getTime() - 16 * DAY);
        const to = new Date(now.getTime() + 16 * DAY);
        let sent = 0;
        for (const [hostId, hostTemplates] of byHost) {
            const bookings = await this.bookingModel
                .find({
                hostId: new mongoose_2.Types.ObjectId(hostId),
                paymentStatus: booking_schema_1.PaymentStatus.PAID,
                status: { $in: [booking_schema_1.BookingStatus.CONFIRMED, booking_schema_1.BookingStatus.COMPLETED] },
                $or: [{ checkIn: { $gte: from, $lte: to } }, { checkOut: { $gte: from, $lte: to } }, { confirmedAt: { $gte: from } }],
            })
                .lean()
                .exec();
            if (!bookings.length)
                continue;
            const done = new Set((await this.deliveryModel
                .find({ bookingId: { $in: bookings.map((b) => b._id) }, templateId: { $in: hostTemplates.map((t) => t._id) } })
                .select('templateId bookingId')
                .lean()
                .exec()).map((d) => `${d.templateId}:${d.bookingId}`));
            for (const b of bookings) {
                for (const t of hostTemplates) {
                    if (done.has(`${t._id}:${b._id}`))
                        continue;
                    if (t.propertyIds?.length && !t.propertyIds.some((p) => idStr(p) === idStr(b.propertyId)))
                        continue;
                    if (b.status === booking_schema_1.BookingStatus.COMPLETED && t.trigger !== host_message_schema_1.MessageTrigger.AFTER_CHECKOUT && t.trigger !== host_message_schema_1.MessageTrigger.BEFORE_CHECKOUT)
                        continue;
                    const due = dueFor(t, b);
                    if (!due || now < due || now.getTime() - due.getTime() > LATE_LIMIT_MS)
                        continue;
                    if (await this.deliver(t, b))
                        sent++;
                }
            }
        }
        return sent;
    }
    async deliver(t, b) {
        const [host, guest, property] = await Promise.all([
            this.userModel.findById(b.hostId).select('name').lean().exec(),
            this.userModel.findById(b.guestId).select('name').lean().exec(),
            this.propertyModel
                .findById(b.propertyId)
                .select('title address neighborhood city shortTermAmenities.checkInTime shortTermAmenities.checkOutTime')
                .lean()
                .exec(),
        ]);
        const ctx = await this.contextFor(b, host, guest, property);
        const body = renderTemplate(t.body, ctx).slice(0, 2000);
        const title = `${firstName(host?.name) || 'Your host'} · ${property?.title ?? 'HoroHouse'}`.slice(0, 120);
        try {
            await this.deliveryModel.create({
                templateId: t._id,
                bookingId: b._id,
                hostId: b.hostId,
                guestId: b.guestId,
                title,
                body,
                sentAt: new Date(),
            });
        }
        catch (e) {
            if (e?.code === 11000)
                return false;
            throw e;
        }
        const inChat = await this.postToChat(b, body);
        await this.notifications
            ?.create({
            userId: idStr(b.guestId),
            type: notification_schema_1.NotificationType.MESSAGE,
            title,
            message: body.length > 180 ? `${body.slice(0, 177)}…` : body,
            link: inChat ? '/(tabs)/messages' : `/bookings/${idStr(b._id)}`,
            metadata: { bookingId: idStr(b._id), templateId: idStr(t._id), kind: 'host_scheduled_message', inChat },
        })
            .catch((err) => this.logger.warn(`scheduled message notification failed: ${err?.message}`));
        return true;
    }
    async sendCheckInGuideNotices(now = new Date()) {
        const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        const tomorrow = new Date(today.getTime() + DAY);
        const notBefore = dueAt(tomorrow, -1, '09:00');
        const bookings = await this.bookingModel
            .find({
            status: booking_schema_1.BookingStatus.CONFIRMED,
            paymentStatus: booking_schema_1.PaymentStatus.PAID,
            checkIn: now >= notBefore ? { $gte: today, $lte: tomorrow } : { $gte: today, $lt: tomorrow },
            checkInGuideNotifiedAt: { $exists: false },
        })
            .select('_id guestId propertyId checkIn')
            .limit(500)
            .lean()
            .exec();
        let sent = 0;
        for (const b of bookings) {
            const p = await this.propertyModel.findById(b.propertyId).select('title +checkInGuide').lean().exec();
            const claimed = await this.bookingModel.updateOne({ _id: b._id, checkInGuideNotifiedAt: { $exists: false } }, { $set: { checkInGuideNotifiedAt: new Date() } });
            if (!claimed.modifiedCount || !HostMessagesService_1.guideHasContent(p?.checkInGuide))
                continue;
            await this.notifications
                ?.create({
                userId: idStr(b.guestId),
                type: notification_schema_1.NotificationType.BOOKING_REMINDER,
                title: 'Your check-in guide is ready 🔑',
                message: `Wi-Fi, directions and how to get in at ${p?.title ?? 'your stay'}.`,
                link: `/bookings/${idStr(b._id)}`,
                metadata: { bookingId: idStr(b._id), kind: 'check_in_guide' },
            })
                .catch((err) => this.logger.warn(`guide notification failed: ${err?.message}`));
            sent++;
        }
        return sent;
    }
};
exports.HostMessagesService = HostMessagesService;
exports.HostMessagesService = HostMessagesService = HostMessagesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(host_message_schema_1.HostMessageTemplate.name)),
    __param(1, (0, mongoose_1.InjectModel)(host_message_schema_1.HostMessageDelivery.name)),
    __param(2, (0, mongoose_1.InjectModel)(property_schema_1.Property.name)),
    __param(3, (0, mongoose_1.InjectModel)(booking_schema_1.Booking.name)),
    __param(4, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __param(6, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        core_1.ModuleRef,
        notifications_service_1.NotificationsService])
], HostMessagesService);
//# sourceMappingURL=host-messages.service.js.map