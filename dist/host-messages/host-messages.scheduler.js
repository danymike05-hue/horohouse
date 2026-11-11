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
var HostMessagesScheduler_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.HostMessagesScheduler = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const host_messages_service_1 = require("./host-messages.service");
let HostMessagesScheduler = HostMessagesScheduler_1 = class HostMessagesScheduler {
    service;
    logger = new common_1.Logger(HostMessagesScheduler_1.name);
    running = false;
    constructor(service) {
        this.service = service;
    }
    async tick() {
        if (this.running)
            return;
        this.running = true;
        try {
            const messages = await this.service.runScheduledMessages();
            const guides = await this.service.sendCheckInGuideNotices();
            if (messages || guides)
                this.logger.log(`Sent ${messages} scheduled message(s), ${guides} check-in guide notice(s)`);
        }
        catch (err) {
            this.logger.error(`host-scheduled-messages failed: ${err?.message}`, err?.stack);
        }
        finally {
            this.running = false;
        }
    }
};
exports.HostMessagesScheduler = HostMessagesScheduler;
__decorate([
    (0, schedule_1.Cron)('*/15 * * * *', { name: 'host-scheduled-messages' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], HostMessagesScheduler.prototype, "tick", null);
exports.HostMessagesScheduler = HostMessagesScheduler = HostMessagesScheduler_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [host_messages_service_1.HostMessagesService])
], HostMessagesScheduler);
//# sourceMappingURL=host-messages.scheduler.js.map