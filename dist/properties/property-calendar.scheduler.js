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
var PropertyCalendarScheduler_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PropertyCalendarScheduler = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const properties_service_1 = require("./properties.service");
let PropertyCalendarScheduler = PropertyCalendarScheduler_1 = class PropertyCalendarScheduler {
    propertiesService;
    logger = new common_1.Logger(PropertyCalendarScheduler_1.name);
    running = false;
    constructor(propertiesService) {
        this.propertiesService = propertiesService;
    }
    async syncExternalCalendars() {
        if (this.running)
            return;
        this.running = true;
        try {
            const n = await this.propertiesService.syncAllExternalCalendars();
            if (n)
                this.logger.log(`Synced ${n} external calendar(s)`);
        }
        catch (err) {
            this.logger.error(`sync-external-calendars failed: ${err?.message}`, err?.stack);
        }
        finally {
            this.running = false;
        }
    }
};
exports.PropertyCalendarScheduler = PropertyCalendarScheduler;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_HOUR, { name: 'sync-external-calendars' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], PropertyCalendarScheduler.prototype, "syncExternalCalendars", null);
exports.PropertyCalendarScheduler = PropertyCalendarScheduler = PropertyCalendarScheduler_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [properties_service_1.PropertiesService])
], PropertyCalendarScheduler);
//# sourceMappingURL=property-calendar.scheduler.js.map