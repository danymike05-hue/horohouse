export declare enum WarningSeverity {
    WARNING = "warning",
    FINAL_WARNING = "final_warning"
}
export declare class SendWarningDto {
    message: string;
    severity?: WarningSeverity;
}
