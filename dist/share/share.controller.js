"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShareController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../auth/guards/jwt.auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const share_service_1 = require("./share.service");
const langOf = (l) => (String(l ?? '').toLowerCase().startsWith('fr') ? 'fr' : 'en');
let ShareController = class ShareController {
    share;
    constructor(share) {
        this.share = share;
    }
    property(id, lang) {
        return this.share.getPropertyShare(id, langOf(lang));
    }
    host(id, lang) {
        return this.share.getHostShare(id, langOf(lang));
    }
    propertyPoster(id, lang) {
        return this.share.propertyPoster(id, langOf(lang));
    }
    hostPoster(id, lang) {
        return this.share.hostPoster(id, langOf(lang));
    }
};
exports.ShareController = ShareController;
__decorate([
    (0, common_1.Get)('property/:id'),
    (0, roles_guard_1.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'Share link + QR code (PNG data URL) for a listing' }),
    (0, swagger_1.ApiQuery)({ name: 'lang', required: false }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('lang')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], ShareController.prototype, "property", null);
__decorate([
    (0, common_1.Get)('host/:id'),
    (0, roles_guard_1.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'Share link + QR code (PNG data URL) for a host profile' }),
    (0, swagger_1.ApiQuery)({ name: 'lang', required: false }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('lang')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], ShareController.prototype, "host", null);
__decorate([
    (0, common_1.Get)('property/:id/poster'),
    (0, roles_guard_1.Public)(),
    (0, common_1.Header)('Content-Type', 'text/html; charset=utf-8'),
    (0, common_1.Header)('Cache-Control', 'public, max-age=300'),
    (0, swagger_1.ApiOperation)({ summary: 'Printable QR poster for a listing (HTML)' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('lang')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], ShareController.prototype, "propertyPoster", null);
__decorate([
    (0, common_1.Get)('host/:id/poster'),
    (0, roles_guard_1.Public)(),
    (0, common_1.Header)('Content-Type', 'text/html; charset=utf-8'),
    (0, common_1.Header)('Cache-Control', 'public, max-age=300'),
    (0, swagger_1.ApiOperation)({ summary: 'Printable QR poster for a host profile (HTML)' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('lang')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], ShareController.prototype, "hostPoster", null);
exports.ShareController = ShareController = __decorate([
    (0, swagger_1.ApiTags)('Share'),
    (0, common_1.Controller)('share'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [share_service_1.ShareService])
], ShareController);
//# sourceMappingURL=share.controller.js.map