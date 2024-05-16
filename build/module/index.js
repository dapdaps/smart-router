export * from './providers';
export * from './routers';
export * from './util';
import { TradeType } from '@uniswap/sdk-core';
import { JsonRpcProvider } from '@ethersproject/providers';
import DEFAULT_TOKEN_LIST from '@uniswap/default-token-list';
import { parseUnits } from '@ethersproject/units';
import BigNumber from 'bignumber.js';
import NodeCache from 'node-cache';
import { NATIVE_NAMES_BY_ID, TO_PROTOCOL } from './util';
import { AlphaRouter, CachingGasStationProvider, CachingTokenListProvider, CachingTokenProviderWithFallback, EIP1559GasPriceProvider, ID_TO_PROVIDER, NodeJSCache, TokenProvider, UniswapMulticallProvider, ID_TO_CHAIN_ID, nativeOnChain, parseAmountWithDecimal, routeAmountsToString, V3Route } from './';
import { OnChainGasPriceProvider } from './providers/on-chain-gas-price-provider';
import { LegacyGasPriceProvider } from './providers/legacy-gas-price-provider';
const dotenv = require("dotenv");
dotenv.config();
const express = require('express');
const app = express();
const port = 9101;
app.get('/monitor', (_, res) => {
    res.status(200).send();
});
app.get('/router', async (req, res) => {
    try {
        const start = Date.now();
        console.log("request start: " + start);
        const chainId = Number(req.query.chainId);
        const tokenIn = req.query.tokenIn;
        const tokenOut = req.query.tokenOut;
        const route = await getRoute(chainId, tokenIn, tokenOut, req.query.amount);
        console.log("request end: " + (Date.now() - start));
        res.send(route);
    }
    catch (e) {
        console.log("Exception: " + e);
        res.send({ code: 0, message: "" });
    }
});
app.listen(port, () => {
    console.log(`app listening on port ${port}`);
});
async function getRoute(chainIdNumb, tokenInStr, tokenOutStr, amountStr) {
    const start = Date.now();
    const chainId = ID_TO_CHAIN_ID(chainIdNumb);
    const chainProvider = ID_TO_PROVIDER(chainId);
    const provider = new JsonRpcProvider(chainProvider, chainId);
    const blockNumber = await provider.getBlockNumber();
    //const recipient = "0x81941c0E31e32FFB8D61D8972a20DAe48bC62d81"
    const tokenCache = new NodeJSCache(new NodeCache({ stdTTL: 3600, useClones: false }));
    let tokenListProvider;
    // if (tokenListURI) {
    //     tokenListProvider = await CachingTokenListProvider.fromTokenListURI(
    //         chainId,
    //         tokenListURI,
    //         tokenCache
    //     );
    // } else {
    tokenListProvider = await CachingTokenListProvider.fromTokenList(chainId, DEFAULT_TOKEN_LIST, tokenCache);
    // }
    let multicall2Provider = new UniswapMulticallProvider(chainId, provider, 1000000);
    // switch (chainId) {
    //     case ChainId.Linea_GOERLI:
    //         multicall2Provider = new UniswapMulticall3Provider(chainId, provider, 375_000);
    //         break;
    //     default:
    //         multicall2Provider = new UniswapMulticallProvider(chainId, provider, 375_000);
    //         break;
    // }
    //const poolProvider = new V3PoolProvider(chainId, multicall2Provider);
    // initialize tokenProvider
    const tokenProviderOnChain = new TokenProvider(chainId, multicall2Provider);
    const tokenProvider = new CachingTokenProviderWithFallback(chainId, tokenCache, tokenListProvider, tokenProviderOnChain);
    const gasPriceCache = new NodeJSCache(new NodeCache({ stdTTL: 15, useClones: true }));
    const router = new AlphaRouter({
        provider,
        chainId,
        multicall2Provider: multicall2Provider,
        gasPriceProvider: new CachingGasStationProvider(chainId, new OnChainGasPriceProvider(chainId, new EIP1559GasPriceProvider(provider), new LegacyGasPriceProvider(provider)), gasPriceCache),
    });
    let protocols = [TO_PROTOCOL("v3")]; //[TO_PROTOCOL("v2"), TO_PROTOCOL("v3"), TO_PROTOCOL("mixed")];
    // if the tokenIn str is 'ETH' or 'MATIC' or in NATIVE_NAMES_BY_ID
    const tokenIn = NATIVE_NAMES_BY_ID[chainId].includes(tokenInStr)
        ? nativeOnChain(chainId)
        : (await tokenProvider.getTokens([tokenInStr])).getTokenByAddress(tokenInStr);
    const tokenOut = NATIVE_NAMES_BY_ID[chainId].includes(tokenOutStr)
        ? nativeOnChain(chainId)
        : (await tokenProvider.getTokens([tokenOutStr])).getTokenByAddress(tokenOutStr);
    console.log("init end: " + (Date.now() - start));
    let swapRoutes;
    const amountIn = parseAmountWithDecimal(amountStr, tokenIn);
    try {
        swapRoutes = await router.route(amountIn, tokenOut, TradeType.EXACT_INPUT, undefined, {
            blockNumber: blockNumber,
            v3PoolSelection: {
                topN: 3,
                topNTokenInOut: 2,
                topNSecondHop: 2,
                topNWithEachBaseToken: 2,
                topNWithBaseToken: 6,
                topNDirectSwaps: 2,
            },
            maxSwapsPerPath: 3,
            minSplits: 1,
            maxSplits: 3,
            distributionPercent: 5,
            protocols,
            forceCrossProtocol: false,
            forceMixedRoutes: false,
            debugRouting: false,
            enableFeeOnTransferFeeFetching: false
        });
    }
    catch (error) {
        return { code: 0, message: error.message };
    }
    if (!swapRoutes) {
        return { code: 0, message: "not find route" };
    }
    //console.log(JSON.stringify(swapRoutes))
    let result = {
        "quote": {
            "blockNumber": blockNumber.toString(),
            "amount": amountStr,
            "amountDecimals": amountIn.toExact(),
            "quote": parseUnits(swapRoutes.quote.toExact(), swapRoutes.quote.currency.decimals).toString(),
            "quoteDecimals": swapRoutes.quote.toExact(),
            "quoteGasAdjusted": parseUnits(swapRoutes.quoteGasAdjusted.toExact(), swapRoutes.quoteGasAdjusted.currency.decimals).toString(),
            "quoteGasAdjustedDecimals": swapRoutes.quoteGasAdjusted.toExact(),
            "gasUseEstimate": swapRoutes.estimatedGasUsed.toString(),
            "gasUseEstimateQuote": parseUnits(swapRoutes.estimatedGasUsedQuoteToken.toExact(), swapRoutes.estimatedGasUsedQuoteToken.currency.decimals).toString(),
            "gasUseEstimateQuoteDecimals": swapRoutes.estimatedGasUsedQuoteToken.toExact(),
            "gasUseEstimateUSD": swapRoutes.estimatedGasUsedUSD.toExact(),
            "gasPriceWei": swapRoutes.gasPriceWei.toString(),
            "routeString": routeAmountsToString(swapRoutes.route),
            "tradeType": "EXACT_INPUT",
            "priceImpact": "",
            "route": []
        },
    };
    const userPrice = new BigNumber(swapRoutes.quote.toExact()).dividedBy(new BigNumber(amountIn.toExact()));
    let marketPrice = new BigNumber(0);
    let marketFee = new BigNumber(0);
    for (let route of swapRoutes.route) {
        if (route.route instanceof V3Route) {
            let routePrice = new BigNumber(1);
            let routeFee = new BigNumber(0);
            let tokenInput = tokenInStr;
            let routePools = [];
            let routeTokenPath = [];
            for (let index = 0; index < route.route.pools.length; index++) {
                const pool = route.route.pools[index];
                const isToken0Input = pool.token0.address.toLowerCase() == tokenInput.toLowerCase();
                tokenInput = isToken0Input ? pool.token1.address : pool.token0.address;
                const price = sqrtToPrice(new BigNumber(pool.sqrtRatioX96.toString()), new BigNumber(pool.token0.decimals), new BigNumber(pool.token1.decimals), isToken0Input);
                //console.log('sqrtRatioX96:'+pool.sqrtRatioX96.toString()+" price:"+price.toString()+" pool:"+route.poolAddresses[index]+" fee:"+pool.fee)
                routePrice = routePrice.times(price);
                routeFee = routeFee.plus(pool.fee / 10000);
                routePools.push({
                    "type": route.route.protocol,
                    "address": route.poolAddresses[index],
                    "fee": pool.fee,
                    "liquidity": pool.liquidity.toString(),
                    "sqrtRatioX96": pool.sqrtRatioX96.toString(),
                    "token0": {
                        "chainId": pool.token0.chainId,
                        "decimals": pool.token0.decimals,
                        "address": pool.token0.address,
                        "symbol": pool.token0.symbol,
                    },
                    "token1": {
                        "chainId": pool.token1.chainId,
                        "decimals": pool.token1.decimals,
                        "address": pool.token1.address,
                        "symbol": pool.token1.symbol,
                    }
                });
            }
            console.log('percent:' + route.percent.toString() + " routePrice:" + routePrice.toString() + " fee:" + routeFee.toString());
            marketPrice = marketPrice.plus(new BigNumber(route.percent).times(routePrice).dividedBy(100));
            marketFee = marketFee.plus(new BigNumber(route.percent).times(routeFee).dividedBy(100));
            for (let tokenPath of route.tokenPath) {
                routeTokenPath.push({
                    "chainId": tokenPath.chainId,
                    "decimals": tokenPath.decimals,
                    "address": tokenPath.address,
                    "symbol": tokenPath.symbol,
                });
            }
            result.quote.route.push({
                'percent': route.percent,
                'route': routePools,
                'tokenPath': routeTokenPath,
            });
        }
    }
    const absoluteChange = marketPrice.minus(userPrice);
    const percentChange = absoluteChange.div(marketPrice);
    let priceImpact = percentChange.times(100).minus(marketFee);
    if (priceImpact.lte(0)) {
        result.quote.priceImpact = "0";
    }
    else {
        result.quote.priceImpact = priceImpact.toNumber().toFixed(3);
    }
    console.log(`userPrice: ${userPrice.toString()} marketPrice:${marketPrice.toString()} priceImpact:${result.quote.priceImpact}`);
    return { code: 1, data: result };
}
function sqrtToPrice(sqrt, decimals0, decimals1, token0IsInput = true) {
    const numerator = sqrt.times(sqrt);
    let ratio = numerator.dividedBy(2 ** 50).dividedBy(2 ** 50).dividedBy(2 ** 50).dividedBy(2 ** 42); //numerator / denominator
    const shiftDecimals = new BigNumber(10).pow(decimals0.minus(decimals1).toNumber()); //Math.pow(10, decimals0 - decimals1)
    ratio = ratio.times(shiftDecimals); //ratio * shiftDecimals
    //console.log("ratio : "+ratio.toString()+ " token0IsInput: "+token0IsInput.toString())
    if (!token0IsInput && !ratio.isEqualTo(new BigNumber(0))) {
        ratio = new BigNumber(1).div(ratio); // 1 / ratio
    }
    return ratio;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsY0FBYyxhQUFhLENBQUM7QUFDNUIsY0FBYyxXQUFXLENBQUM7QUFDMUIsY0FBYyxRQUFRLENBQUM7QUFHdkIsT0FBTyxFQUFZLFNBQVMsRUFBUyxNQUFNLG1CQUFtQixDQUFDO0FBQy9ELE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUMzRCxPQUFPLGtCQUFrQixNQUFNLDZCQUE2QixDQUFDO0FBQzdELE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxzQkFBc0IsQ0FBQztBQUNsRCxPQUFPLFNBQVMsTUFBTSxjQUFjLENBQUM7QUFFckMsT0FBTyxTQUFTLE1BQU0sWUFBWSxDQUFDO0FBQ25DLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxXQUFXLEVBQUUsTUFBTSxRQUFRLENBQUM7QUFDekQsT0FBTyxFQUNILFdBQVcsRUFDWCx5QkFBeUIsRUFBRSx3QkFBd0IsRUFBRSxnQ0FBZ0MsRUFBRSx1QkFBdUIsRUFFOUcsY0FBYyxFQUNkLFdBQVcsRUFDWCxhQUFhLEVBQ2Isd0JBQXdCLEVBQ3hCLGNBQWMsRUFBRSxhQUFhLEVBQUUsc0JBQXNCLEVBQWEsb0JBQW9CLEVBQUUsT0FBTyxFQUNsRyxNQUFNLElBQUksQ0FBQztBQUNaLE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ2xGLE9BQU8sRUFBRSxzQkFBc0IsRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBRy9FLE1BQU0sTUFBTSxHQUFHLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQTtBQUNoQyxNQUFNLENBQUMsTUFBTSxFQUFFLENBQUE7QUFDZixNQUFNLE9BQU8sR0FBRyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUE7QUFDbEMsTUFBTSxHQUFHLEdBQUcsT0FBTyxFQUFFLENBQUE7QUFDckIsTUFBTSxJQUFJLEdBQUcs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