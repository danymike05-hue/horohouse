import { FastifyRequest } from 'fastify';
import { ComparisonService, CreateComparisonDto, UpdateComparisonDto } from './comparison.service';
import { User } from '../users/schemas/user.schema';
export declare class ComparisonController {
    private readonly comparisonService;
    constructor(comparisonService: ComparisonService);
    create(createComparisonDto: CreateComparisonDto, req: FastifyRequest & {
        user: User;
    }): Promise<import("./schemas/comparison.schema").Comparison>;
    findAll(req: FastifyRequest & {
        user: User;
    }): Promise<import("./schemas/comparison.schema").Comparison[]>;
    getPublicComparisons(limit?: string): Promise<import("./schemas/comparison.schema").Comparison[]>;
    findByShareToken(shareToken: string): Promise<import("./schemas/comparison.schema").Comparison>;
    findOne(id: string, req: FastifyRequest & {
        user?: User;
    }): Promise<import("./schemas/comparison.schema").Comparison>;
    generateShareUrl(id: string, req: FastifyRequest & {
        user: User;
    }): Promise<{
        shareUrl: string;
        shareToken: string;
    }>;
    update(id: string, updateComparisonDto: UpdateComparisonDto, req: FastifyRequest & {
        user: User;
    }): Promise<import("./schemas/comparison.schema").Comparison>;
    remove(id: string, req: FastifyRequest & {
        user: User;
    }): Promise<{
        message: string;
    }>;
}
