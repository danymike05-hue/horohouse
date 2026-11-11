export declare class WatermarkService {
    private readonly logger;
    private readonly fontBase64;
    private generateWatermarkSvg;
    applyWatermark(imageBuffer: Buffer): Promise<Buffer>;
}
