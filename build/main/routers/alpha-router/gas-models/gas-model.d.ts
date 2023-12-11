import { BigNumber } from '@ethersproject/bignumber';
import { ChainId, Token } from '@uniswap/sdk-core';
import { Pool } from '@uniswap/v3-sdk';
import { ProviderConfig } from '../../../providers/provider';
import { IV2PoolProvider } from '../../../providers/v2/pool-provider';
import { ArbitrumGasData, IL2GasDataProvider, OptimismGasData } from '../../../providers/v3/gas-data-provider';
import { CurrencyAmount } from '../../../util/amounts';
import { MixedRouteWithValidQuote, RouteWithValidQuote, V2RouteWithValidQuote, V3RouteWithValidQuote } from '../entities/route-with-valid-quote';
export declare const usdGasTokensByChain: {
    [chainId in ChainId]?: Token[];
};
export declare type L1ToL2GasCosts = {
    gasUsedL1: BigNumber;
    gasCostL1USD: CurrencyAmount;
    gasCostL1QuoteToken: CurrencyAmount;
};
export declare type BuildOnChainGasModelFactoryType = {
    chainId: ChainId;
    gasPriceWei: BigNumber;
    pools: LiquidityCalculationPools;
    amountToken: Token;
    quoteToken: Token;
    v2poolProvider: IV2PoolProvider;
    l2GasDataProvider?: IL2GasDataProvider<OptimismGasData> | IL2GasDataProvider<ArbitrumGasData>;
    providerConfig?: ProviderConfig;
};
export declare type BuildV2GasModelFactoryType = {
    chainId: ChainId;
    gasPriceWei: BigNumber;
    poolProvider: IV2PoolProvider;
    token: Token;
    providerConfig?: ProviderConfig;
};
export declare type LiquidityCalculationPools = {
    usdPool: Pool;
    nativeQuoteTokenV3Pool: Pool | null;
    nativeAmountTokenV3Pool: Pool | null;
};
/**
 * Contains functions for generating gas estimates for given routes.
 *
 * We generally compute gas estimates off-chain because
 *  1/ Calling eth_estimateGas for a swaps requires the caller to have
 *     the full balance token being swapped, and approvals.
 *  2/ Tracking gas used using a wrapper contract is not accurate with Multicall
 *     due to EIP-2929
 *  3/ For V2 we simulate all our swaps off-chain so have no way to track gas used.
 *
 * Generally these models should be optimized to return quickly by performing any
 * long running operations (like fetching external data) outside of the functions defined.
 * This is because the functions in the model are called once for every route and every
 * amount that is considered in the algorithm so it is important to minimize the number of
 * long running operations.
 */
export declare type IGasModel<TRouteWithValidQuote extends RouteWithValidQuote> = {
    estimateGasCost(routeWithValidQuote: TRouteWithValidQuote): {
        gasEstimate: BigNumber;
        gasCostInToken: CurrencyAmount;
        gasCostInUSD: CurrencyAmount;
    };
    calculateL1GasFees?(routes: TRouteWithValidQuote[]): Promise<L1ToL2GasCosts>;
};
/**
 * Factory for building gas models that can be used with any route to generate
 * gas estimates.
 *
 * Factory model is used so that any supporting data can be fetched once and
 * returned as part of the model.
 *
 * @export
 * @abstract
 * @class IV2GasModelFactory
 */
export declare abstract class IV2GasModelFactory {
    abstract buildGasModel({ chainId, gasPriceWei, poolProvider, token, providerConfig, }: BuildV2GasModelFactoryType): Promise<IGasModel<V2RouteWithValidQuote>>;
}
/**
 * Factory for building gas models that can be used with any route to generate
 * gas estimates.
 *
 * Factory model is used so that any supporting data can be fetched once and
 * returned as part of the model.
 *
 * @export
 * @abstract
 * @class IOnChainGasModelFactory
 */
export declare abstract class IOnChainGasModelFactory {
    abstract buildGasModel({ chainId, gasPriceWei, pools: LiquidityCalculationPools, amountToken, quoteToken, v2poolProvider: V2poolProvider, l2GasDataProvider, providerConfig, }: BuildOnChainGasModelFactoryType): Promise<IGasModel<V3RouteWithValidQuote | MixedRouteWithValidQuote>>;
}
