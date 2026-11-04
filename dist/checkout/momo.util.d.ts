import type { MomoOperator } from './schemas/checkout-payment.schema';
export declare function normalizeCmPhone(input: string | undefined | null): string | null;
export declare function detectOperator(local: string): MomoOperator | null;
export declare const toInternational: (local: string) => string;
