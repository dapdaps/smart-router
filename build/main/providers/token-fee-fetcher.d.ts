import { BigNumber } from '@ethersproject/bignumber';
import { BaseProvider } from '@ethersproject/providers';
import { ChainId } from '@uniswap/sdk-core';
import { ProviderConfig } from './provider';
export declare const DEFAULT_TOKEN_FEE_RESULT: {
    buyFeeBps: BigNumber;
    sellFeeBps: BigNumber;
};
declare type Address = string;
export declare type TokenFeeResult = {
    buyFeeBps?: BigNumber;
    sellFeeBps?: BigNumber;
};
export declare type TokenFeeMap = Record<Address, TokenFeeResult>;
export interface ITokenFeeFetcher {
    fetchFees(addresses: Address[], providerConfig?: ProviderConfig): Promise<TokenFeeMap>;
}
export declare class OnChainTokenFeeFetcher implements ITokenFeeFetcher {
    private chainId;
    private tokenFeeAddress;
    private gasLimitPerCall;
    private amountToFlashBorrow;
    private BASE_TOKEN;
    private readonly contract;
    constructor(chainId: ChainId, rpcProvider: BaseProvider, tokenFeeAddress?: string, gasLimitPerCall?: number, amountToFlashBorrow?: string);
    fetchFees(addresses: Address[], providerConfig?: ProviderConfig): Promise<TokenFeeMap>;
}
export {};
