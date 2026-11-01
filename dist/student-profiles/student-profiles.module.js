"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StudentProfilesModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const config_1 = require("@nestjs/config");
const student_profiles_service_1 = require("./student-profiles.service");
const student_profiles_controller_1 = require("./student-profiles.controller");
const is_verified_student_guard_1 = require("./guards/is-verified-student.guard");
const student_profile_schema_1 = require("./schemas/student-profile.schema");
const user_schema_1 = require("../users/schemas/user.schema");
const notifications_module_1 = require("../notifications/notifications.module");
let StudentProfilesModule = class StudentProfilesModule {
};
exports.StudentProfilesModule = StudentProfilesModule;
exports.StudentProfilesModule = StudentProfilesModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: student_profile_schema_1.StudentProfile.name, schema: student_profile_schema_1.StudentProfileSchema },
                { name: user_schema_1.User.name, schema: user_schema_1.UserSchema },
            ]),
            config_1.ConfigModule,
            notifications_module_1.NotificationsModule,
        ],
        controllers: [student_profiles_controller_1.StudentProfilesController],
        providers: [student_profiles_service_1.StudentProfilesService, is_verified_student_guard_1.IsVerifiedStudentGuard],
        exports: [
            student_profiles_service_1.StudentProfilesService,
            is_verified_student_guard_1.IsVerifiedStudentGuard,
            mongoose_1.MongooseModule,
        ],
    })
], StudentProfilesModule);
//# sourceMappingURL=student-profiles.module.js.map