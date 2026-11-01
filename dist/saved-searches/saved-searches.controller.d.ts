import { SavedSearchesService } from './saved-searches.service';
import { CreateSavedSearchDto, UpdateSavedSearchDto } from './dto/saved-search.dto';
export declare class SavedSearchesController {
    private readonly savedSearchesService;
    constructor(savedSearchesService: SavedSearchesService);
    create(createDto: CreateSavedSearchDto, req: any): Promise<import("./schemas/saved-search.schema").SavedSearch>;
    findAll(req: any): Promise<import("./schemas/saved-search.schema").SavedSearch[]>;
    getStatistics(req: any): Promise<any>;
    getMatchingProperties(id: string, page: string | undefined, limit: string | undefined, req: any): Promise<{
        properties: import("../properties/schemas/property.schema").Property[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    findOne(id: string, req: any): Promise<import("./schemas/saved-search.schema").SavedSearch>;
    update(id: string, updateDto: UpdateSavedSearchDto, req: any): Promise<import("./schemas/saved-search.schema").SavedSearch>;
    remove(id: string, req: any): Promise<void>;
}
