import { LeadSource, LeadStatus, LeadPriority } from '../schemas/lead.schema';
export declare class CreateLeadDto {
    name: string;
    email?: string;
    phone?: string;
    interest?: string;
    source?: LeadSource;
    status?: LeadStatus;
    location?: string;
    budget?: number;
    propertyType?: string;
    priority?: LeadPriority;
    assignedAgent?: string;
    tags?: string[];
}
