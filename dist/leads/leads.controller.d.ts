import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
export declare class LeadsController {
    private readonly leadsService;
    constructor(leadsService: LeadsService);
    create(createLeadDto: CreateLeadDto): Promise<import("./schemas/lead.schema").Lead>;
    getStats(): Promise<any>;
    findAll(): Promise<import("./schemas/lead.schema").Lead[]>;
    findOne(id: string): Promise<import("./schemas/lead.schema").Lead>;
    update(id: string, updateLeadDto: UpdateLeadDto): Promise<import("./schemas/lead.schema").Lead>;
    addNote(id: string, content: string): Promise<import("./schemas/lead.schema").Lead>;
    remove(id: string): Promise<any>;
}
