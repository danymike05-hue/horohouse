import { WalletService } from '../services/wallet.service';
import { WithdrawFundsDto } from '../dto/payment.dto';
declare class CreditDebitDto {
    amount: number;
    description: string;
    reference?: string;
}
declare class BankDetailsDto {
    accountName: string;
    accountNumber: string;
    bankName: string;
    bankCode: string;
}
declare class MobileMoneyDto {
    phoneNumber: string;
    provider: 'MTN' | 'ORANGE';
}
declare class AutoWithdrawDto {
    threshold: number;
}
export declare class WalletController {
    private readonly walletService;
    constructor(walletService: WalletService);
    getWallet(req: any): Promise<import("../schemas/wallet.schema").WalletDocument>;
    creditWallet(dto: CreditDebitDto, req: any): Promise<import("../schemas/wallet.schema").WalletDocument>;
    debitWallet(dto: CreditDebitDto, req: any): Promise<import("../schemas/wallet.schema").WalletDocument>;
    requestWithdrawal(dto: WithdrawFundsDto, req: any): Promise<any>;
    updateBankAccount(dto: BankDetailsDto, req: any): Promise<import("../schemas/wallet.schema").WalletDocument>;
    updateMobileMoneyAccount(dto: MobileMoneyDto, req: any): Promise<import("../schemas/wallet.schema").WalletDocument>;
    enableAutoWithdrawal(dto: AutoWithdrawDto, req: any): Promise<import("../schemas/wallet.schema").WalletDocument>;
    getTransactions(req: any, limit?: string): Promise<import("../schemas/wallet.schema").WalletTransaction[]>;
    getWalletStats(req: any): Promise<any>;
}
export {};
