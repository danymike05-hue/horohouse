import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types, isValidObjectId } from 'mongoose';
import { Lead, LeadDocument } from './schemas/lead.schema';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';

/** Who is asking: their id and role (from the logged-in user). */
export interface LeadActor {
    _id: any;
    role?: string;
}

/**
 * An agent's leads are their clients' names, phones, emails and budgets. Each lead now
 * belongs to the user who created it, and every read and write only reaches their own.
 * Before, any logged-in user could list, read, change and delete every lead.
 * Admins see all of them, including older leads created before leads had an owner.
 */
@Injectable()
export class LeadsService {
    constructor(
        @InjectModel(Lead.name) private leadModel: Model<LeadDocument>,
    ) { }

    /** The leads this user may touch. */
    private scope(actor: LeadActor): FilterQuery<LeadDocument> {
        if (actor?.role === 'admin') return {};
        return { ownerId: new Types.ObjectId(String(actor._id)) };
    }

    /** One lead, only if it's theirs; anyone else gets "not found" (not "forbidden"), so ids can't be probed. */
    private byId(id: string, actor: LeadActor): FilterQuery<LeadDocument> {
        if (!isValidObjectId(id)) throw new NotFoundException(`Lead #${id} not found`);
        return { _id: new Types.ObjectId(id), ...this.scope(actor) };
    }

    async create(createLeadDto: CreateLeadDto, actor: LeadActor): Promise<Lead> {
        const createdLead = new this.leadModel({ ...createLeadDto, ownerId: new Types.ObjectId(String(actor._id)) });
        return createdLead.save();
    }

    async findAll(actor: LeadActor): Promise<Lead[]> {
        return this.leadModel.find(this.scope(actor)).sort({ createdAt: -1 }).exec();
    }

    async findOne(id: string, actor: LeadActor): Promise<Lead> {
        const lead = await this.leadModel.findOne(this.byId(id, actor)).exec();
        if (!lead) {
            throw new NotFoundException(`Lead #${id} not found`);
        }
        return lead;
    }

    async update(id: string, updateData: UpdateLeadDto, actor: LeadActor): Promise<Lead> {
        const existingLead = await this.leadModel
            .findOneAndUpdate(this.byId(id, actor), updateData, { new: true })
            .exec();

        if (!existingLead) {
            throw new NotFoundException(`Lead #${id} not found`);
        }
        return existingLead;
    }

    async remove(id: string, actor: LeadActor): Promise<any> {
        const deletedLead = await this.leadModel.findOneAndDelete(this.byId(id, actor)).exec();
        if (!deletedLead) {
            throw new NotFoundException(`Lead #${id} not found`);
        }
        return deletedLead;
    }

    async addNote(id: string, content: string, actor: LeadActor): Promise<Lead> {
        const lead = await this.leadModel.findOneAndUpdate(
            this.byId(id, actor),
            { $push: { notes: { content, createdAt: new Date() } } },
            { new: true },
        ).exec();

        if (!lead) {
            throw new NotFoundException(`Lead #${id} not found`);
        }
        return lead;
    }

    async getStats(actor: LeadActor): Promise<any> {
        const now = new Date();
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const mine = this.scope(actor);

        const [total, newCount, contactedCount, qualifiedCount, lostCount, newThisWeek] =
            await Promise.all([
                this.leadModel.countDocuments(mine).exec(),
                this.leadModel.countDocuments({ ...mine, status: 'new' } as any).exec(),
                this.leadModel.countDocuments({ ...mine, status: 'contacted' } as any).exec(),
                this.leadModel.countDocuments({ ...mine, status: 'qualified' } as any).exec(),
                this.leadModel.countDocuments({ ...mine, status: 'lost' } as any).exec(),
                this.leadModel.countDocuments({ ...mine, createdAt: { $gte: oneWeekAgo } }).exec(),
            ]);

        return {
            total,
            new: newCount,
            contacted: contactedCount,
            qualified: qualifiedCount,
            lost: lostCount,
            newThisWeek,
            conversionRate: total > 0 ? Math.round((qualifiedCount / total) * 100) : 0,
        };
    }
}
