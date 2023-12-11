import { BigNumber } from '@ethersproject/bignumber';
export declare type ProviderConfig = {
    /**
     * The block number to use when getting data on-chain.
     */
    blockNumber?: number | Promise<number>;
    additionalGasOverhead?: BigNumber;
    debugRouting?: boolean;
    /**
     * Flag for token properties provider to enable fetching fee-on-transfer tokens.
     */
    enableFeeOnTransferFeeFetching?: boolean;
    /**
     * Tenderly natively support save simulation failures if failed,
     * we need this as a pass-through flag to enable/disable this feature.
     */
    saveTenderlySimulationIfFailed?: boolean;
};
export declare type LocalCacheEntry<T> = {
    entry: T;
    blockNumber: number;
};
