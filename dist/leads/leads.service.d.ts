import { Model } from 'mongoose';
import { Lead, LeadDocument } from './schemas/lead.schema';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
export declare class LeadsService {
    private leadModel;
    constructor(leadModel: Model<LeadDocument>);
    create(createLeadDto: CreateLeadDto): Promise<Lead>;
    findAll(): Promise<Lead[]>;
    findOne(id: string): Promise<Lead>;
    update(id: string, updateData: UpdateLeadDto): Promise<Lead>;
    remove(id: string): Promise<any>;
    addNote(id: string, content: string): Promise<Lead>;
    getStats(): Promise<any>;
}
