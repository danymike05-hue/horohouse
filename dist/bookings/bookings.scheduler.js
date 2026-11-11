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
var BookingsScheduler_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookingsScheduler = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const bookings_service_1 = require("./bookings.service");
let BookingsScheduler = BookingsScheduler_1 = class BookingsScheduler {
    bookingsService;
    logger = new common_1.Logger(BookingsScheduler_1.name);
    running = false;
    constructor(bookingsService) {
        this.bookingsService = bookingsService;
    }
    async expireUnpaidBookings() {
        if (this.running)
            return;
        this.running = true;
        try {
            let total = 0;
            for (let i = 0; i < 10; i++) {
                const n = await this.bookingsService.expireOverdueBookings(200);
                total += n;
                if (n < 200)
                    break;
            }
            if (total)
                this.logger.log(`Released ${total} unpaid booking(s)`);
        }
        catch (err) {
            this.logger.error(`expire-unpaid-bookings failed: ${err?.message}`, err?.stack);
        }
        finally {
            this.running = false;
        }
    }
    async completeFinishedStays() {
        try {
            const n = await this.bookingsService.completeFinishedStays(200);
            if (n)
                this.logger.log(`Completed ${n} finished stay(s)`);
        }
        catch (err) {
            this.logger.error(`complete-finished-stays failed: ${err?.message}`, err?.stack);
        }
    }
};
exports.BookingsScheduler = BookingsScheduler;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_5_MINUTES, { name: 'expire-unpaid-bookings' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], BookingsScheduler.prototype, "expireUnpaidBookings", null);
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_HOUR, { name: 'complete-finished-stays' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], BookingsScheduler.prototype, "completeFinishedStays", null);
exports.BookingsScheduler = BookingsScheduler = BookingsScheduler_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [bookings_service_1.BookingsService])
], BookingsScheduler);
//# sourceMappingURL=bookings.scheduler.js.map