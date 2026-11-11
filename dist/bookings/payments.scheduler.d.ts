import { Model } from 'mongoose';
import { TransactionDocument } from 'src/payments/schemas/transaction.schema';
import { PaymentsService } from 'src/payments/services/payments.service';
export declare class PaymentsScheduler {
    private transactionModel;
    private readonly paymentsService;
    private readonly logger;
    constructor(transactionModel: Model<TransactionDocument>, paymentsService: PaymentsService);
    reconcilePendingTransactions(): Promise<void>;
}
