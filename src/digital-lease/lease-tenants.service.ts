import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Inquiry } from '../properties/schemas/inquiry.schema';
import { Appointment } from '../appointments/schemas/appointment.schema';

export interface TenantCandidate {
  _id: string;
  name: string;
  phone?: string;
  email?: string;
  /** How they know you: they asked about a listing, or booked a viewing */
  via: 'inquiry' | 'viewing';
}

/**
 * Who a landlord can put on a lease. Searching all users is admin-only (it would expose
 * everyone), so the app offers:
 *  - people who already contacted you or booked a viewing of one of your listings
 *  - one person found by their exact phone number or email, returning just their name
 */
@Injectable()
export class LeaseTenantsService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Inquiry.name) private readonly inquiryModel: Model<any>,
    @InjectModel(Appointment.name) private readonly appointmentModel: Model<any>,
  ) { }

  async candidates(landlordId: string): Promise<TenantCandidate[]> {
    const me = new Types.ObjectId(landlordId);
    const [fromInquiries, fromViewings] = await Promise.all([
      this.inquiryModel.find({ agentId: me }).select('userId').sort({ createdAt: -1 }).limit(200).lean().exec(),
      this.appointmentModel.find({ agentId: me, clientId: { $exists: true, $ne: null } }).select('clientId').sort({ date: -1 }).limit(200).lean().exec(),
    ]);
    const via = new Map<string, 'inquiry' | 'viewing'>();
    for (const v of fromViewings as any[]) if (v.clientId) via.set(String(v.clientId), 'viewing');
    for (const i of fromInquiries as any[]) if (i.userId && !via.has(String(i.userId))) via.set(String(i.userId), 'inquiry');
    via.delete(String(me));
    if (!via.size) return [];
    const users: any[] = await this.userModel
      .find({ _id: { $in: [...via.keys()].map((id) => new Types.ObjectId(id)) }, isActive: { $ne: false } })
      .select('name email phoneNumber')
      .lean()
      .exec();
    return users.map((u) => ({
      _id: String(u._id),
      name: u.name,
      ...(u.phoneNumber && !/^(google_|temp_)/.test(u.phoneNumber) ? { phone: u.phoneNumber } : {}),
      ...(u.email ? { email: u.email } : {}),
      via: via.get(String(u._id))!,
    }));
  }

  /** Exact match only, and only the name comes back: you already know their number or email. */
  async findByContact(landlordId: string, contact: string): Promise<{ _id: string; name: string }> {
    const raw = String(contact ?? '').trim();
    if (raw.length < 6) throw new BadRequestException('Enter their full phone number or email.');
    let query: any;
    if (raw.includes('@')) {
      query = { email: raw.toLowerCase() };
    } else {
      const digits = raw.replace(/[^\d]/g, '');
      const local = digits.replace(/^237/, '');
      if (local.length < 8) throw new BadRequestException('Enter their full phone number or email.');
      query = { phoneNumber: { $in: [local, `237${local}`, `+237${local}`, raw] } };
    }
    const user: any = await this.userModel.findOne({ ...query, isActive: { $ne: false } }).select('name').lean().exec();
    if (!user || String(user._id) === String(landlordId)) {
      throw new NotFoundException('No HoroHouse account uses that number or email. Ask them to sign up first.');
    }
    return { _id: String(user._id), name: user.name };
  }
}
