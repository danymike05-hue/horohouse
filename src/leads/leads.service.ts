import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Lead, LeadDocument } from './schemas/lead.schema';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';

@Injectable()
export class LeadsService {
    constructor(
        @InjectModel(Lead.name) private leadModel: Model<LeadDocument>,
    ) { }

    async create(createLeadDto: CreateLeadDto): Promise<Lead> {
        const createdLead = new this.leadModel(createLeadDto);
        return createdLead.save();
    }

    async findAll(): Promise<Lead[]> {
        return this.leadModel.find().sort({ createdAt: -1 }).exec();
    }

    async findOne(id: string): Promise<Lead> {
        const lead = await this.leadModel.findById(id).exec();
        if (!lead) {
            throw new NotFoundException(`Lead #${id} not found`);
        }
        return lead;
    }

    async update(id: string, updateData: UpdateLeadDto): Promise<Lead> {
        const existingLead = await this.leadModel
            .findByIdAndUpdate(id, updateData, { new: true })
            .exec();

        if (!existingLead) {
            throw new NotFoundException(`Lead #${id} not found`);
        }
        return existingLead;
    }

    async remove(id: string): Promise<any> {
        const deletedLead = await this.leadModel.findByIdAndDelete(id).exec();
        if (!deletedLead) {
            throw new NotFoundException(`Lead #${id} not found`);
        }
        return deletedLead;
    }

    async addNote(id: string, content: string): Promise<Lead> {
        const lead = await this.leadModel.findByIdAndUpdate(
            id,
            { $push: { notes: { content, createdAt: new Date() } } },
            { new: true },
        ).exec();

        if (!lead) {
            throw new NotFoundException(`Lead #${id} not found`);
        }
        return lead;
    }

    async getStats(): Promise<any> {
        const now = new Date();
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        const [total, newCount, contactedCount, qualifiedCount, lostCount, newThisWeek] =
            await Promise.all([
                this.leadModel.countDocuments().exec(),
                this.leadModel.countDocuments({ status: 'new' } as any).exec(),
                this.leadModel.countDocuments({ status: 'contacted' } as any).exec(),
                this.leadModel.countDocuments({ status: 'qualified' } as any).exec(),
                this.leadModel.countDocuments({ status: 'lost' } as any).exec(),
                this.leadModel.countDocuments({ createdAt: { $gte: oneWeekAgo } }).exec(),
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
