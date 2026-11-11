"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toInternational = void 0;
exports.normalizeCmPhone = normalizeCmPhone;
exports.detectOperator = detectOperator;
function normalizeCmPhone(input) {
    if (!input)
        return null;
    let d = input.replace(/\D/g, '');
    if (d.startsWith('237') && d.length === 12)
        d = d.slice(3);
    if (d.startsWith('0') && d.length === 10)
        d = d.slice(1);
    return /^6\d{8}$/.test(d) ? d : null;
}
function detectOperator(local) {
    if (local.length < 3)
        return null;
    const p2 = local.slice(0, 2);
    const p3 = Number(local.slice(0, 3));
    if (p2 === '67' || (p3 >= 650 && p3 <= 654))
        return 'mtn_momo';
    if (p2 === '69' || (p3 >= 655 && p3 <= 659))
        return 'orange_money';
    return null;
}
const toInternational = (local) => `+237${local}`;
exports.toInternational = toInternational;
//# sourceMappingURL=momo.util.js.map