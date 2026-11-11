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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SavedSearchSchema = exports.SavedSearch = exports.SearchFrequency = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
var SearchFrequency;
(function (SearchFrequency) {
    SearchFrequency["INSTANT"] = "instant";
    SearchFrequency["DAILY"] = "daily";
    SearchFrequency["WEEKLY"] = "weekly";
    SearchFrequency["NEVER"] = "never";
})(SearchFrequency || (exports.SearchFrequency = SearchFrequency = {}));
let SavedSearch = class SavedSearch {
    userId;
    name;
    searchCriteria;
    notificationFrequency;
    isActive;
    resultsCount;
    lastNotificationSent;
    lastChecked;
    newMatchingProperties;
};
exports.SavedSearch = SavedSearch;
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User', required: true, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], SavedSearch.prototype, "userId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, trim: true }),
    __metadata("design:type", String)
], SavedSearch.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object, required: true }),
    __metadata("design:type", Object)
], SavedSearch.prototype, "searchCriteria", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: String,
        enum: Object.values(SearchFrequency),
        default: SearchFrequency.DAILY
    }),
    __metadata("design:type", String)
], SavedSearch.prototype, "notificationFrequency", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: true }),
    __metadata("design:type", Boolean)
], SavedSearch.prototype, "isActive", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], SavedSearch.prototype, "resultsCount", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date }),
    __metadata("design:type", Date)
], SavedSearch.prototype, "lastNotificationSent", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date }),
    __metadata("design:type", Date)
], SavedSearch.prototype, "lastChecked", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [mongoose_2.Types.ObjectId], ref: 'Property', default: [] }),
    __metadata("design:type", Array)
], SavedSearch.prototype, "newMatchingProperties", void 0);
exports.SavedSearch = SavedSearch = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], SavedSearch);
exports.SavedSearchSchema = mongoose_1.SchemaFactory.createForClass(SavedSearch);
exports.SavedSearchSchema.index({ userId: 1, createdAt: -1 });
exports.SavedSearchSchema.index({ userId: 1, isActive: 1 });
exports.SavedSearchSchema.index({ notificationFrequency: 1, isActive: 1, lastNotificationSent: 1 });
//# sourceMappingURL=saved-search.schema.js.map