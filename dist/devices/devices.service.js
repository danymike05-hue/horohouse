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
var DevicesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DevicesService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const user_schema_1 = require("../users/schemas/user.schema");
let DevicesService = DevicesService_1 = class DevicesService {
    userModel;
    logger = new common_1.Logger(DevicesService_1.name);
    constructor(userModel) {
        this.userModel = userModel;
    }
    async registerToken(userId, token, platform, deviceId) {
        const userObj = mongoose_2.Types.ObjectId.isValid(userId) ? new mongoose_2.Types.ObjectId(userId) : userId;
        await this.userModel.updateMany({ _id: { $ne: userObj }, 'pushTokens.token': token }, { $pull: { pushTokens: { token } } });
        await this.userModel.updateOne({ _id: userObj }, { $pull: { pushTokens: { token } } });
        await this.userModel.updateOne({ _id: userObj }, {
            $push: {
                pushTokens: { token, platform, deviceId, updatedAt: new Date() },
            },
        });
        this.logger.log(`Registered push token for user ${userId} (${platform})`);
        return { success: true };
    }
    async removeInvalidTokens(tokens) {
        if (!tokens.length)
            return;
        await this.userModel.updateMany({}, { $pull: { pushTokens: { token: { $in: tokens } } } });
        this.logger.warn(`Removed ${tokens.length} invalid push token(s)`);
    }
};
exports.DevicesService = DevicesService;
exports.DevicesService = DevicesService = DevicesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], DevicesService);
//# sourceMappingURL=devices.service.js.map