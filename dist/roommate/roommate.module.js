"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoommateMatchingModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const roommate_matching_service_1 = require("./roommate-matching.service");
const roommate_matching_controller_1 = require("./roommate-matching.controller");
const roommate_profile_schema_1 = require("./schemas/roommate-profile.schema");
const roommate_match_schema_1 = require("./schemas/roommate-match.schema");
const student_profiles_module_1 = require("../student-profiles/student-profiles.module");
const notifications_module_1 = require("../notifications/notifications.module");
const chat_module_1 = require("../chat/chat.module");
const user_schema_1 = require("../users/schemas/user.schema");
let RoommateMatchingModule = class RoommateMatchingModule {
};
exports.RoommateMatchingModule = RoommateMatchingModule;
exports.RoommateMatchingModule = RoommateMatchingModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: roommate_profile_schema_1.RoommateProfile.name, schema: roommate_profile_schema_1.RoommateProfileSchema },
                { name: roommate_match_schema_1.RoommateMatch.name, schema: roommate_match_schema_1.RoommateMatchSchema },
                { name: user_schema_1.User.name, schema: user_schema_1.UserSchema },
            ]),
            student_profiles_module_1.StudentProfilesModule,
            notifications_module_1.NotificationsModule,
            chat_module_1.ChatModule,
        ],
        controllers: [roommate_matching_controller_1.RoommateMatchingController],
        providers: [roommate_matching_service_1.RoommateMatchingService],
        exports: [roommate_matching_service_1.RoommateMatchingService],
    })
], RoommateMatchingModule);
//# sourceMappingURL=roommate.module.js.map