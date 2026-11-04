import { CheckoutService } from './checkout.service';
export declare class CheckoutExpiryJob {
    private readonly checkout;
    private readonly logger;
    private running;
    constructor(checkout: CheckoutService);
    run(): Promise<void>;
}
