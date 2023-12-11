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
import { AlphaRouter, CachingGasStationProvider, CachingTokenListProvider, CachingTokenProviderWithFallback, EIP1559GasPriceProvider, ID_TO_PROVIDER, NodeJSCache, TokenProvider, UniswapMulticallProvider, V3RouteWithValidQuote, ID_TO_CHAIN_ID, nativeOnChain, parseAmountWithDecimal, routeAmountsToString, V3Route } from './';
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
        const amount = Number(req.query.amount);
        const route = await getRoute(chainId, tokenIn, tokenOut, amount.toString());
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
    var _a;
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
    //if (exactIn) {
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
    //console.log(swapRoutes)
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
            "tokenPath": [],
            "route": []
        },
    };
    const route = swapRoutes.route[0];
    if (route) {
        for (let index in route.tokenPath) {
            result.quote.tokenPath.push({
                "chainId": route.tokenPath[index].chainId,
                "decimals": route.tokenPath[index].decimals,
                "address": route.tokenPath[index].address,
                "symbol": route.tokenPath[index].symbol,
            });
        }
        if (route.route instanceof V3Route) {
            for (let index = 0; index < route.route.pools.length; index++) {
                const routePool = route.route.pools[index];
                let routePoolObj = {
                    "type": route.protocol,
                    "address": route.poolAddresses[index],
                    "fee": routePool === null || routePool === void 0 ? void 0 : routePool.fee,
                    "liquidity": routePool === null || routePool === void 0 ? void 0 : routePool.liquidity.toString(),
                    "sqrtRatioX96": routePool === null || routePool === void 0 ? void 0 : routePool.sqrtRatioX96.toString(),
                    "token0": {
                        "chainId": routePool === null || routePool === void 0 ? void 0 : routePool.token0.chainId,
                        "decimals": routePool === null || routePool === void 0 ? void 0 : routePool.token0.decimals,
                        "address": routePool === null || routePool === void 0 ? void 0 : routePool.token0.address,
                        "symbol": routePool === null || routePool === void 0 ? void 0 : routePool.token0.symbol,
                    },
                    "token1": {
                        "chainId": routePool === null || routePool === void 0 ? void 0 : routePool.token1.chainId,
                        "decimals": routePool === null || routePool === void 0 ? void 0 : routePool.token1.decimals,
                        "address": routePool === null || routePool === void 0 ? void 0 : routePool.token1.address,
                        "symbol": routePool === null || routePool === void 0 ? void 0 : routePool.token1.symbol,
                    }
                };
                result.quote.route.push(routePoolObj);
                console.log("sqrtRatioX96: " + (routePool === null || routePool === void 0 ? void 0 : routePool.sqrtRatioX96.toString()));
                if (index == route.route.pools.length - 1) {
                    //price impact
                    const isToken0Input = (routePool === null || routePool === void 0 ? void 0 : routePool.token0.address.toLowerCase()) != tokenOutStr.toLowerCase();
                    if (route instanceof V3RouteWithValidQuote) {
                        console.log("sqrtPriceX96AfterList: " + ((_a = route.sqrtPriceX96AfterList[index]) === null || _a === void 0 ? void 0 : _a.toString()) + " isToken0Input: " + isToken0Input);
                        try {
                            const price = sqrtToPrice(new BigNumber(routePool.sqrtRatioX96.toString()), new BigNumber(routePool.token0.decimals), new BigNumber(routePool.token1.decimals), isToken0Input);
                            //console.log('price', price.toString())
                            const priceAfter = sqrtToPrice(new BigNumber(route.sqrtPriceX96AfterList[index].toString()), new BigNumber(routePool.token0.decimals), new BigNumber(routePool.token1.decimals), isToken0Input);
                            //console.log('priceAfter', priceAfter.toString())
                            const absoluteChange = price.minus(priceAfter);
                            //console.log('absoluteChange', absoluteChange.toString())
                            const percentChange = absoluteChange.div(price); //absoluteChange / price
                            //console.log('percentChange', percentChange.toString())
                            //console.log('percent change', (percentChange.multipliedBy(100)).toNumber().toFixed(3), '%')
                            result.quote.priceImpact = (percentChange.multipliedBy(100)).toNumber().toFixed(3);
                        }
                        catch (e) {
                            console.log("Exception priceImpact: " + e);
                        }
                    }
                }
            }
        }
    }
    return { code: 1, data: result };
}
function sqrtToPrice(sqrt, decimals0, decimals1, token0IsInput = true) {
    const numerator = sqrt.multipliedBy(sqrt);
    let ratio = numerator.dividedBy(2 ** 50).dividedBy(2 ** 50).dividedBy(2 ** 50).dividedBy(2 ** 42); //numerator / denominator
    const shiftDecimals = new BigNumber(10).pow(decimals0.minus(decimals1).toNumber()); //Math.pow(10, decimals0 - decimals1)
    ratio = ratio.multipliedBy(shiftDecimals); //ratio * shiftDecimals
    if (!token0IsInput) {
        ratio = new BigNumber(1).div(ratio); // 1 / ratio
    }
    return ratio;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsY0FBYyxhQUFhLENBQUM7QUFDNUIsY0FBYyxXQUFXLENBQUM7QUFDMUIsY0FBYyxRQUFRLENBQUM7QUFHdkIsT0FBTyxFQUFZLFNBQVMsRUFBUyxNQUFNLG1CQUFtQixDQUFDO0FBQy9ELE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUMzRCxPQUFPLGtCQUFrQixNQUFNLDZCQUE2QixDQUFDO0FBQzdELE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxzQkFBc0IsQ0FBQztBQUNsRCxPQUFPLFNBQVMsTUFBTSxjQUFjLENBQUM7QUFFckMsT0FBTyxTQUFTLE1BQU0sWUFBWSxDQUFDO0FBQ25DLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxXQUFXLEVBQUUsTUFBTSxRQUFRLENBQUM7QUFDekQsT0FBTyxFQUNILFdBQVcsRUFDWCx5QkFBeUIsRUFBRSx3QkFBd0IsRUFBRSxnQ0FBZ0MsRUFBRSx1QkFBdUIsRUFFOUcsY0FBYyxFQUNkLFdBQVcsRUFDWCxhQUFhLEVBQ2Isd0JBQXdCLEVBQUUscUJBQXFCLEVBQy9DLGNBQWMsRUFBRSxhQUFhLEVBQUUsc0JBQXNCLEVBQWEsb0JBQW9CLEVBQUUsT0FBTyxFQUNsRyxNQUFNLElBQUksQ0FBQztBQUNaLE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ2xGLE9BQU8sRUFBRSxzQkFBc0IsRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBRy9FLE1BQU0sTUFBTSxHQUFHLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQTtBQUNoQyxNQUFNLENBQUMsTUFBTSxFQUFFLENBQUE7QUFDZixNQUFNLE9BQU8sR0FBRyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUE7QUFDbEMsTUFBTSxHQUFHLEdBQUcsT0FBTyxFQUFFLENBQUE7QUFDckIsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFBO0FBR2pCLEdBQUcsQ0FBQyxHQUFHLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBTSxFQUFFLEdBQVEsRUFBRSxFQUFFO0lBQ3JDLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUE7QUFDMUIsQ0FBQyxDQUFDLENBQUE7QUFFRixHQUFHLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRSxLQUFLLEVBQUUsR0FBUSxFQUFFLEdBQVEsRUFBRSxFQUFFO0lBQzVDLElBQUk7UUFDQSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUE7UUFDeEIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxpQkFBaUIsR0FBRyxLQUFLLENBQUMsQ0FBQTtRQUN0QyxNQUFNLE9BQU8sR0FBVyxNQUFNLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQTtRQUNqRCxNQUFNLE9BQU8sR0FBVyxHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQTtRQUN6QyxNQUFNLFFBQVEsR0FBVyxHQUFHLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQTtRQUMzQyxNQUFNLE1BQU0sR0FBVyxNQUFNLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQTtRQUMvQyxNQUFNLEtBQUssR0FBRyxNQUFNLFFBQVEsQ0FBQyxPQUFPLEVBQUUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQTtRQUMzRSxPQUFPLENBQUMsR0FBRyxDQUFDLGVBQWUsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsR0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFBO1FBQ2pELEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUE7S0FDbEI7SUFBQyxPQUFPLENBQUMsRUFBRTtRQUNSLE9BQU8sQ0FBQyxHQUFHLENBQUMsYUFBYSxHQUFHLENBQUMsQ0FBQyxDQUFBO1FBQzlCLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBQyxJQUFJLEVBQUMsQ0FBQyxFQUFDLE9BQU8sRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFBO0tBQ2hDO0FBQ0wsQ0FBQyxDQUFDLENBQUE7QUFFRixHQUFHLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxHQUFHLEVBQUU7SUFDbEIsT0FBTyxDQUFDLEdBQUcsQ0FBQyx5QkFBeUIsSUFBSSxFQUFFLENBQUMsQ0FBQTtBQUNoRCxDQUFDLENBQUMsQ0FBQTtBQUVGLEtBQUssVUFBVSxRQUFRLENBQUMsV0FBbUIsRUFBRSxVQUFrQixFQUFFLFdBQW1CLEVBQUUsU0FBaUI7O0lBQ25HLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQTtJQUN4QixNQUFNLE9BQU8sR0FBRyxjQUFjLENBQUMsV0FBVyxDQUFDLENBQUM7SUFDNUMsTUFBTSxhQUFhLEdBQUcsY0FBYyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQzlDLE1BQU0sUUFBUSxHQUFHLElBQUksZUFBZSxDQUFDLGFBQWEsRUFBRSxPQUFPLENBQUMsQ0FBQztJQUM3RCxNQUFNLFdBQVcsR0FBRyxNQUFNLFFBQVEsQ0FBQyxjQUFjLEVBQUUsQ0FBQztJQUNwRCxnRUFBZ0U7SUFFaEUsTUFBTSxVQUFVLEdBQUcsSUFBSSxXQUFXLENBQzlCLElBQUksU0FBUyxDQUFDLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FDcEQsQ0FBQztJQUVGLElBQUksaUJBQTJDLENBQUM7SUFDaEQsc0JBQXNCO0lBQ3RCLDJFQUEyRTtJQUMzRSxtQkFBbUI7SUFDbkIsd0JBQXdCO0lBQ3hCLHFCQUFxQjtJQUNyQixTQUFTO0lBQ1QsV0FBVztJQUNYLGlCQUFpQixHQUFHLE1BQU0sd0JBQXdCLENBQUMsYUFBYSxDQUM1RCxPQUFPLEVBQ1Asa0JBQWtCLEVBQ2xCLFVBQVUsQ0FDYixDQUFDO0lBQ0YsSUFBSTtJQUVKLElBQUksa0JBQWtCLEdBQUcsSUFBSSx3QkFBd0IsQ0FBQyxPQUFPLEVBQUUsUUFBUSxFQUFFLE9BQVMsQ0FBQyxDQUFDO0lBQ3BGLHFCQUFxQjtJQUNyQixpQ0FBaUM7SUFDakMsMEZBQTBGO0lBQzFGLGlCQUFpQjtJQUNqQixlQUFlO0lBQ2YseUZBQXlGO0lBQ3pGLGlCQUFpQjtJQUNqQixJQUFJO0lBQ0osdUVBQXVFO0lBRXZFLDJCQUEyQjtJQUMzQixNQUFNLG9CQUFvQixHQUFHLElBQUksYUFBYSxDQUFDLE9BQU8sRUFBRSxrQkFBa0IsQ0FBQyxDQUFDO0lBQzVFLE1BQU0sYUFBYSxHQUFHLElBQUksZ0NBQWdDLENBQ3RELE9BQU8sRUFDUCxVQUFVLEVBQ1YsaUJBQWlCLEVBQ2pCLG9CQUFvQixDQUN2QixDQUFDO0lBR0YsTUFBTSxhQUFhLEdBQUcsSUFBSSxXQUFXLENBQ2pDLElBQUksU0FBUyxDQUFDLEVBQUUsTUFBTSxFQUFFLEVBQUUsRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FDakQsQ0FBQztJQUVGLE1BQU0sTUFBTSxHQUFHLElBQUksV0FBVyxDQUFDO1FBQzNCLFFBQVE7UUFDUixPQUFPO1FBQ1Asa0JBQWtCLEVBQUUsa0JBQWtCO1FBQ3RDLGdCQUFnQixFQUFFLElBQUkseUJBQXlCLENBQzNDLE9BQU8sRUFDUCxJQUFJLHVCQUF1QixDQUN2QixPQUFPLEVBQ1AsSUFBSSx1QkFBdUIsQ0FBQyxRQUFRLENBQUMsRUFDckMsSUFBSSxzQkFBc0IsQ0FBQyxRQUFRLENBQUMsQ0FDdkMsRUFDRCxhQUFhLENBQ2hCO0tBQ0osQ0FBQyxDQUFDO0lBRUgsSUFBSSxTQUFTLEdBQWUsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQSxDQUFBLCtEQUErRDtJQUU5RyxrRUFBa0U7SUFDbEUsTUFBTSxPQUFPLEdBQWEsa0JBQWtCLENBQUMsT0FBTyxDQUFFLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQztRQUN2RSxDQUFDLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQztRQUN4QixDQUFDLENBQUMsQ0FBQyxNQUFNLGFBQWEsQ0FBQyxTQUFTLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsaUJBQWlCLENBQzdELFVBQVUsQ0FDWixDQUFDO0lBRVAsTUFBTSxRQUFRLEdBQWEsa0JBQWtCLENBQUMsT0FBTyxDQUFFLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQztRQUN6RSxDQUFDLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQztRQUN4QixDQUFDLENBQUMsQ0FBQyxNQUFNLGFBQWEsQ0FBQyxTQUFTLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsaUJBQWlCLENBQzlELFdBQVcsQ0FDYixDQUFDO0lBRVAsT0FBTyxDQUFDLEdBQUcsQ0FBQyxZQUFZLEdBQUUsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLEdBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQTtJQUM3QyxJQUFJLFVBQTRCLENBQUM7SUFDakMsZ0JBQWdCO0lBQ2hCLE1BQU0sUUFBUSxHQUFHLHNCQUFzQixDQUFDLFNBQVMsRUFBRSxPQUFPLENBQUMsQ0FBQztJQUU1RCxJQUFJO1FBQ0EsVUFBVSxHQUFHLE1BQU0sTUFBTSxDQUFDLEtBQUssQ0FDM0IsUUFBUSxFQUNSLFFBQVEsRUFDUixTQUFTLENBQUMsV0FBVyxFQUNyQixTQUFTLEVBQ1Q7WUFDSSxXQUFXLEVBQUUsV0FBVztZQUN4QixlQUFlLEVBQUU7Z0JBQ2IsSUFBSSxFQUFFLENBQUM7Z0JBQ1AsY0FBYyxFQUFFLENBQUM7Z0JBQ2pCLGFBQWEsRUFBRSxDQUFDO2dCQUNoQixxQkFBcUIsRUFBRSxDQUFDO2dCQUN4QixpQkFBaUIsRUFBRSxDQUFDO2dCQUNwQixlQUFlLEVBQUUsQ0FBQzthQUNyQjtZQUNELGVBQWUsRUFBRSxDQUFDO1lBQ2xCLFNBQVMsRUFBRSxDQUFDO1lBQ1osU0FBUyxFQUFFLENBQUM7WUFDWixtQkFBbUIsRUFBRSxDQUFDO1lBQ3RCLFNBQVM7WUFDVCxrQkFBa0IsRUFBRSxLQUFLO1lBQ3pCLGdCQUFnQixFQUFFLEtBQUs7WUFDdkIsWUFBWSxFQUFFLEtBQUs7WUFDbkIsOEJBQThCLEVBQUUsS0FBSztTQUN4QyxDQUNKLENBQUM7S0FDTDtJQUFDLE9BQU0sS0FBUyxFQUFFO1FBQ2YsT0FBTyxFQUFDLElBQUksRUFBQyxDQUFDLEVBQUMsT0FBTyxFQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUMsQ0FBQTtLQUN4QztJQUVELHlCQUF5QjtJQUV6QixJQUFJLENBQUMsVUFBVSxFQUFFO1FBQ2IsT0FBTyxFQUFDLElBQUksRUFBQyxDQUFDLEVBQUMsT0FBTyxFQUFDLGdCQUFnQixFQUFDLENBQUE7S0FDM0M7SUFFRCx5Q0FBeUM7SUFFekMsSUFBSSxNQUFNLEdBQUc7UUFDVCxPQUFPLEVBQUU7WUFDTCxhQUFhLEVBQUUsV0FBVyxDQUFDLFFBQVEsRUFBRTtZQUNyQyxRQUFRLEVBQUUsU0FBUztZQUNuQixnQkFBZ0IsRUFBRSxRQUFRLENBQUMsT0FBTyxFQUFFO1lBQ3BDLE9BQU8sRUFBRSxVQUFVLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsRUFBRSxVQUFVLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQyxRQUFRLEVBQUU7WUFDOUYsZUFBZSxFQUFFLFVBQVUsQ0FBQyxLQUFLLENBQUMsT0FBTyxFQUFFO1lBQzNDLGtCQUFrQixFQUFFLFVBQVUsQ0FBQyxVQUFVLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxFQUFFLEVBQUUsVUFBVSxDQUFDLGdCQUFnQixDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQyxRQUFRLEVBQUU7WUFDL0gsMEJBQTBCLEVBQUUsVUFBVSxDQUFDLGdCQUFnQixDQUFDLE9BQU8sRUFBRTtZQUNqRSxnQkFBZ0IsRUFBRSxVQUFVLENBQUMsZ0JBQWdCLENBQUMsUUFBUSxFQUFFO1lBQ3hELHFCQUFxQixFQUFFLFVBQVUsQ0FBQyxVQUFVLENBQUMsMEJBQTBCLENBQUMsT0FBTyxFQUFFLEVBQUUsVUFBVSxDQUFDLDBCQUEwQixDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQyxRQUFRLEVBQUU7WUFDdEosNkJBQTZCLEVBQUUsVUFBVSxDQUFDLDBCQUEwQixDQUFDLE9BQU8sRUFBRTtZQUM5RSxtQkFBbUIsRUFBRSxVQUFVLENBQUMsbUJBQW1CLENBQUMsT0FBTyxFQUFFO1lBQzdELGFBQWEsRUFBRSxVQUFVLENBQUMsV0FBVyxDQUFDLFFBQVEsRUFBRTtZQUNoRCxhQUFhLEVBQUUsb0JBQW9CLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQztZQUNyRCxXQUFXLEVBQUUsYUFBYTtZQUMxQixhQUFhLEVBQUUsRUFBRTtZQUNqQixXQUFXLEVBQUUsRUFBVztZQUN4QixPQUFPLEVBQUUsRUFBVztTQUN2QjtLQUNKLENBQUE7SUFDRCxNQUFNLEtBQUssR0FBRyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFBO0lBQ2pDLElBQUksS0FBSyxFQUFFO1FBQ1AsS0FBSyxJQUFJLEtBQUssSUFBSSxLQUFLLENBQUMsU0FBUyxFQUFFO1lBQy9CLE1BQU0sQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQztnQkFDeEIsU0FBUyxFQUFFLEtBQUssQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFFLENBQUMsT0FBTztnQkFDMUMsVUFBVSxFQUFFLEtBQUssQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFFLENBQUMsUUFBUTtnQkFDNUMsU0FBUyxFQUFFLEtBQUssQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFFLENBQUMsT0FBTztnQkFDMUMsUUFBUSxFQUFFLEtBQUssQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFFLENBQUMsTUFBTTthQUMzQyxDQUFDLENBQUE7U0FDTDtRQUNELElBQUksS0FBSyxDQUFDLEtBQUssWUFBWSxPQUFPLEVBQUU7WUFDaEMsS0FBSyxJQUFJLEtBQUssR0FBRyxDQUFDLEVBQUUsS0FBSyxHQUFHLEtBQUssQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLE1BQU0sRUFBRSxLQUFLLEVBQUUsRUFBRTtnQkFDM0QsTUFBTSxTQUFTLEdBQUcsS0FBSyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUE7Z0JBQzFDLElBQUksWUFBWSxHQUFHO29CQUNmLE1BQU0sRUFBRSxLQUFLLENBQUMsUUFBUTtvQkFDdEIsU0FBUyxFQUFFLEtBQUssQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDO29CQUNyQyxLQUFLLEVBQUUsU0FBUyxhQUFULFNBQVMsdUJBQVQsU0FBUyxDQUFFLEdBQUc7b0JBQ3JCLFdBQVcsRUFBRSxTQUFTLGFBQVQsU0FBUyx1QkFBVCxTQUFTLENBQUUsU0FBUyxDQUFDLFFBQVEsRUFBRTtvQkFDNUMsY0FBYyxFQUFFLFNBQVMsYUFBVCxTQUFTLHVCQUFULFNBQVMsQ0FBRSxZQUFZLENBQUMsUUFBUSxFQUFFO29CQUNsRCxRQUFRLEVBQUU7d0JBQ04sU0FBUyxFQUFFLFNBQVMsYUFBVCxTQUFTLHVCQUFULFNBQVMsQ0FBRSxNQUFNLENBQUMsT0FBTzt3QkFDcEMsVUFBVSxFQUFFLFNBQVMsYUFBVCxTQUFTLHVCQUFULFNBQVMsQ0FBRSxNQUFNLENBQUMsUUFBUTt3QkFDdEMsU0FBUyxFQUFFLFNBQVMsYUFBVCxTQUFTLHVCQUFULFNBQVMsQ0FBRSxNQUFNLENBQUMsT0FBTzt3QkFDcEMsUUFBUSxFQUFFLFNBQVMsYUFBVCxTQUFTLHVCQUFULFNBQVMsQ0FBRSxNQUFNLENBQUMsTUFBTTtxQkFDckM7b0JBQ0QsUUFBUSxFQUFFO3dCQUNOLFNBQVMsRUFBRSxTQUFTLGFBQVQsU0FBUyx1QkFBVCxTQUFTLENBQUUsTUFBTSxDQUFDLE9BQU87d0JBQ3BDLFVBQVUsRUFBRSxTQUFTLGFBQVQsU0FBUyx1QkFBVCxTQUFTLENBQUUsTUFBTSxDQUFDLFFBQVE7d0JBQ3RDLFNBQVMsRUFBRSxTQUFTLGFBQVQsU0FBUyx1QkFBVCxTQUFTLENBQUUsTUFBTSxDQUFDLE9BQU87d0JBQ3BDLFFBQVEsRUFBRSxTQUFTLGFBQVQsU0FBUyx1QkFBVCxTQUFTLENBQUUsTUFBTSxDQUFDLE1BQU07cUJBQ3JDO2lCQUNKLENBQUE7Z0JBQ0QsTUFBTSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFBO2dCQUVyQyxPQUFPLENBQUMsR0FBRyxDQUFDLGdCQUFnQixJQUFHLFNBQVMsYUFBVCxTQUFTLHVCQUFULFNBQVMsQ0FBRSxZQUFZLENBQUMsUUFBUSxFQUFFLENBQUEsQ0FBQyxDQUFBO2dCQUVsRSxJQUFJLEtBQUssSUFBSSxLQUFLLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO29CQUN2QyxjQUFjO29CQUNkLE1BQU0sYUFBYSxHQUFHLENBQUEsU0FBUyxhQUFULFNBQVMsdUJBQVQsU0FBUyxDQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsV0FBVyxFQUFFLEtBQUksV0FBVyxDQUFDLFdBQVcsRUFBRSxDQUFBO29CQUMxRixJQUFJLEtBQUssWUFBWSxxQkFBcUIsRUFBRTt3QkFDeEMsT0FBTyxDQUFDLEdBQUcsQ0FBQyx5QkFBeUIsSUFBRyxNQUFBLEtBQUssQ0FBQyxxQkFBcUIsQ0FBQyxLQUFLLENBQUMsMENBQUUsUUFBUSxFQUFFLENBQUEsR0FBRyxrQkFBa0IsR0FBRyxhQUFhLENBQUMsQ0FBQTt3QkFDNUgsSUFBSTs0QkFDQSxNQUFNLEtBQUssR0FBRyxXQUFXLENBQUMsSUFBSSxTQUFTLENBQUMsU0FBVSxDQUFDLFlBQVksQ0FBQyxRQUFRLEVBQUUsQ0FBQyxFQUFFLElBQUksU0FBUyxDQUFDLFNBQVUsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLEVBQUUsSUFBSSxTQUFTLENBQUMsU0FBVSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsRUFBRSxhQUFhLENBQUMsQ0FBQTs0QkFDakwsd0NBQXdDOzRCQUN4QyxNQUFNLFVBQVUsR0FBRyxXQUFXLENBQUMsSUFBSSxTQUFTLENBQUMsS0FBSyxDQUFDLHFCQUFxQixDQUFDLEtBQUssQ0FBRSxDQUFDLFFBQVEsRUFBRSxDQUFDLEVBQUUsSUFBSSxTQUFTLENBQUMsU0FBVSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsRUFBRSxJQUFJLFNBQVMsQ0FBQyxTQUFVLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxFQUFFLGFBQWEsQ0FBQyxDQUFBOzRCQUNsTSxrREFBa0Q7NEJBQ2xELE1BQU0sY0FBYyxHQUFHLEtBQUssQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLENBQUE7NEJBQzlDLDBEQUEwRDs0QkFDMUQsTUFBTSxhQUFhLEdBQUcsY0FBYyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQSxDQUFBLHdCQUF3Qjs0QkFDdkUsd0RBQXdEOzRCQUN4RCw2RkFBNkY7NEJBQzdGLE1BQU0sQ0FBQyxLQUFLLENBQUMsV0FBVyxHQUFHLENBQUMsYUFBYSxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQTt5QkFDckY7d0JBQUMsT0FBTyxDQUFDLEVBQUU7NEJBQ1IsT0FBTyxDQUFDLEdBQUcsQ0FBQyx5QkFBeUIsR0FBRyxDQUFDLENBQUMsQ0FBQTt5QkFDN0M7cUJBQ0o7aUJBQ0o7YUFFSjtTQUNKO0tBQ0o7SUFDRCxPQUFPLEVBQUMsSUFBSSxFQUFDLENBQUMsRUFBQyxJQUFJLEVBQUMsTUFBTSxFQUFDLENBQUE7QUFDL0IsQ0FBQztBQUVELFNBQVMsV0FBVyxDQUFDLElBQWUsRUFBRSxTQUFvQixFQUFFLFNBQW9CLEVBQUUsYUFBYSxHQUFHLElBQUk7SUFDbEcsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsQ0FBQTtJQUN6QyxJQUFJLEtBQUssR0FBRyxTQUFTLENBQUMsU0FBUyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQSxDQUFDLHlCQUF5QjtJQUMzSCxNQUFNLGFBQWEsR0FBRyxJQUFJLFNBQVMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFBLENBQUcscUNBQXFDO0lBQzFILEtBQUssR0FBRyxLQUFLLENBQUMsWUFBWSxDQUFDLGFBQWEsQ0FBQyxDQUFBLENBQUEsdUJBQXVCO0lBQ2hFLElBQUksQ0FBQyxhQUFhLEVBQUU7UUFDaEIsS0FBSyxHQUFHLElBQUksU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQSxDQUFDLFlBQVk7S0FDbkQ7SUFDRCxPQUFPLEtBQUssQ0FBQTtBQUNoQixDQUFDIn0=