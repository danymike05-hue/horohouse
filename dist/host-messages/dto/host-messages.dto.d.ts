import { MessageTrigger, TemplateKind } from '../schemas/host-message.schema';
export declare class CreateTemplateDto {
    kind: TemplateKind;
    title: string;
    body: string;
    trigger?: MessageTrigger;
    daysOffset?: number;
    sendTime?: string;
    propertyIds?: string[];
    isActive?: boolean;
}
declare const UpdateTemplateDto_base: import("@nestjs/common").Type<Partial<CreateTemplateDto>>;
export declare class UpdateTemplateDto extends UpdateTemplateDto_base {
}
export declare class CheckInGuideDto {
    wifiName?: string;
    wifiPassword?: string;
    directions?: string;
    accessInstructions?: string;
    parking?: string;
    houseManual?: string;
    emergencyPhone?: string;
}
export declare class GuidePhotoCaptionDto {
    caption?: string;
}
export {};
