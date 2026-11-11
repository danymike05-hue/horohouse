"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LISTING_COUNTRY = exports.LISTING_COUNTRY_CODES = exports.CAMEROON_BOUNDS = void 0;
exports.isInCameroon = isInCameroon;
exports.CAMEROON_BOUNDS = {
    minLat: 1.65,
    maxLat: 13.08,
    minLng: 8.49,
    maxLng: 16.19,
};
exports.LISTING_COUNTRY_CODES = ['cm'];
exports.LISTING_COUNTRY = 'Cameroon';
function isInCameroon(lat, lng) {
    const la = Number(lat);
    const lo = Number(lng);
    if (!Number.isFinite(la) || !Number.isFinite(lo))
        return false;
    return (la >= exports.CAMEROON_BOUNDS.minLat &&
        la <= exports.CAMEROON_BOUNDS.maxLat &&
        lo >= exports.CAMEROON_BOUNDS.minLng &&
        lo <= exports.CAMEROON_BOUNDS.maxLng);
}
//# sourceMappingURL=geo.util.js.map