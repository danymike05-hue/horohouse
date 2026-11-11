"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var WatermarkService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WatermarkService = void 0;
const common_1 = require("@nestjs/common");
const fs = require("fs");
const sharp = require("sharp");
let WatermarkService = WatermarkService_1 = class WatermarkService {
    logger = new common_1.Logger(WatermarkService_1.name);
    fontBase64 = (() => {
        try {
            const fontPath = require.resolve('@fontsource/inter/files/inter-latin-700-normal.woff');
            return fs.readFileSync(fontPath).toString('base64');
        }
        catch (err) {
            console.error('WatermarkService: failed to load Inter font, watermark text will render without embedded font', err);
            return '';
        }
    })();
    generateWatermarkSvg(width, height) {
        const cx = width / 2;
        const cy = height / 2;
        const halfDiag = Math.sqrt(cx * cx + cy * cy);
        const radii = [halfDiag * 0.3, halfDiag * 0.65];
        const fontSize = Math.max(9, Math.round(width * 0.022));
        const opacity = 0.3;
        const label = 'HoroHouse';
        const circleTexts = radii.flatMap((r) => {
            const circumference = 2 * Math.PI * r;
            const labelWidth = label.length * fontSize * 0.65 + 20;
            const count = Math.max(2, Math.floor(circumference / labelWidth));
            return Array.from({ length: count }, (_, i) => {
                const angle = (360 / count) * i;
                const rad = (angle * Math.PI) / 180;
                const x = cx + r * Math.cos(rad);
                const y = cy + r * Math.sin(rad);
                return `
          <text
            x="${x}"
            y="${y}"
            text-anchor="middle"
            dominant-baseline="middle"
            font-family="Inter, sans-serif"
            font-size="${fontSize}"
            font-weight="700"
            letter-spacing="1"
            fill="white"
            fill-opacity="${opacity}"
            transform="rotate(${angle + 90}, ${x}, ${y})"
          >${label}</text>`;
            });
        });
        const fontFace = this.fontBase64
            ? `
            @font-face {
              font-family: 'Inter';
              font-style: normal;
              font-weight: 700;
              src: url('data:font/woff;base64,${this.fontBase64}') format('woff');
            }`
            : '';
        const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
        <defs>
          <style>${fontFace}
          </style>
        </defs>
        ${circleTexts.join('\n')}
      </svg>`;
        return Buffer.from(svg);
    }
    async applyWatermark(imageBuffer) {
        const image = sharp(imageBuffer);
        const { width = 800, height = 600 } = await image.metadata();
        return image
            .composite([
            {
                input: this.generateWatermarkSvg(width, height),
                top: 0,
                left: 0,
            },
        ])
            .toBuffer();
    }
};
exports.WatermarkService = WatermarkService;
exports.WatermarkService = WatermarkService = WatermarkService_1 = __decorate([
    (0, common_1.Injectable)()
], WatermarkService);
//# sourceMappingURL=watermark.service.js.map