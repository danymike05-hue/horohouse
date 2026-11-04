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
exports.GeocodingController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../auth/guards/jwt.auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const geocoding_service_1 = require("./geocoding.service");
let GeocodingController = class GeocodingController {
    geocoding;
    constructor(geocoding) {
        this.geocoding = geocoding;
    }
    search(q, limit, countrycodes, viewbox, lang) {
        return this.geocoding.search({ q, limit: Number(limit), countrycodes, viewbox, lang });
    }
    reverse(lat, lon, lang) {
        return this.geocoding.reverse(parseFloat(lat), parseFloat(lon), lang);
    }
};
exports.GeocodingController = GeocodingController;
__decorate([
    (0, common_1.Get)('search'),
    (0, roles_guard_1.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'Address / place search (OpenStreetMap, cached)' }),
    (0, swagger_1.ApiQuery)({ name: 'q', required: true }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'countrycodes', required: false, description: 'e.g. cm or cm,ng,ga' }),
    (0, swagger_1.ApiQuery)({ name: 'viewbox', required: false, description: 'lon_min,lat_max,lon_max,lat_min (soft bias)' }),
    (0, swagger_1.ApiQuery)({ name: 'lang', required: false, description: 'fr | en' }),
    __param(0, (0, common_1.Query)('q')),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('countrycodes')),
    __param(3, (0, common_1.Query)('viewbox')),
    __param(4, (0, common_1.Query)('lang')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String]),
    __metadata("design:returntype", void 0)
], GeocodingController.prototype, "search", null);
__decorate([
    (0, common_1.Get)('reverse'),
    (0, roles_guard_1.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'Address for a map point (OpenStreetMap, cached)' }),
    (0, swagger_1.ApiQuery)({ name: 'lat', required: true, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'lon', required: true, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'lang', required: false }),
    __param(0, (0, common_1.Query)('lat')),
    __param(1, (0, common_1.Query)('lon')),
    __param(2, (0, common_1.Query)('lang')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], GeocodingController.prototype, "reverse", null);
exports.GeocodingController = GeocodingController = __decorate([
    (0, swagger_1.ApiTags)('Geocoding'),
    (0, common_1.Controller)('geocode'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [geocoding_service_1.GeocodingService])
], GeocodingController);
//# sourceMappingURL=geocoding.controller.js.map