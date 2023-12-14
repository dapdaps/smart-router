"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
__exportStar(require("./providers"), exports);
__exportStar(require("./routers"), exports);
__exportStar(require("./util"), exports);
const sdk_core_1 = require("@uniswap/sdk-core");
const providers_1 = require("@ethersproject/providers");
const default_token_list_1 = __importDefault(require("@uniswap/default-token-list"));
const units_1 = require("@ethersproject/units");
const bignumber_js_1 = __importDefault(require("bignumber.js"));
const node_cache_1 = __importDefault(require("node-cache"));
const util_1 = require("./util");
const _1 = require("./");
const on_chain_gas_price_provider_1 = require("./providers/on-chain-gas-price-provider");
const legacy_gas_price_provider_1 = require("./providers/legacy-gas-price-provider");
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
    const start = Date.now();
    const chainId = (0, _1.ID_TO_CHAIN_ID)(chainIdNumb);
    const chainProvider = (0, _1.ID_TO_PROVIDER)(chainId);
    const provider = new providers_1.JsonRpcProvider(chainProvider, chainId);
    const blockNumber = await provider.getBlockNumber();
    //const recipient = "0x81941c0E31e32FFB8D61D8972a20DAe48bC62d81"
    const tokenCache = new _1.NodeJSCache(new node_cache_1.default({ stdTTL: 3600, useClones: false }));
    let tokenListProvider;
    // if (tokenListURI) {
    //     tokenListProvider = await CachingTokenListProvider.fromTokenListURI(
    //         chainId,
    //         tokenListURI,
    //         tokenCache
    //     );
    // } else {
    tokenListProvider = await _1.CachingTokenListProvider.fromTokenList(chainId, default_token_list_1.default, tokenCache);
    // }
    let multicall2Provider = new _1.UniswapMulticallProvider(chainId, provider, 1000000);
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
    const tokenProviderOnChain = new _1.TokenProvider(chainId, multicall2Provider);
    const tokenProvider = new _1.CachingTokenProviderWithFallback(chainId, tokenCache, tokenListProvider, tokenProviderOnChain);
    const gasPriceCache = new _1.NodeJSCache(new node_cache_1.default({ stdTTL: 15, useClones: true }));
    const router = new _1.AlphaRouter({
        provider,
        chainId,
        multicall2Provider: multicall2Provider,
        gasPriceProvider: new _1.CachingGasStationProvider(chainId, new on_chain_gas_price_provider_1.OnChainGasPriceProvider(chainId, new _1.EIP1559GasPriceProvider(provider), new legacy_gas_price_provider_1.LegacyGasPriceProvider(provider)), gasPriceCache),
    });
    let protocols = [(0, util_1.TO_PROTOCOL)("v3")]; //[TO_PROTOCOL("v2"), TO_PROTOCOL("v3"), TO_PROTOCOL("mixed")];
    // if the tokenIn str is 'ETH' or 'MATIC' or in NATIVE_NAMES_BY_ID
    const tokenIn = util_1.NATIVE_NAMES_BY_ID[chainId].includes(tokenInStr)
        ? (0, _1.nativeOnChain)(chainId)
        : (await tokenProvider.getTokens([tokenInStr])).getTokenByAddress(tokenInStr);
    const tokenOut = util_1.NATIVE_NAMES_BY_ID[chainId].includes(tokenOutStr)
        ? (0, _1.nativeOnChain)(chainId)
        : (await tokenProvider.getTokens([tokenOutStr])).getTokenByAddress(tokenOutStr);
    console.log("init end: " + (Date.now() - start));
    let swapRoutes;
    const amountIn = (0, _1.parseAmountWithDecimal)(amountStr, tokenIn);
    try {
        swapRoutes = await router.route(amountIn, tokenOut, sdk_core_1.TradeType.EXACT_INPUT, undefined, {
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
            "quote": (0, units_1.parseUnits)(swapRoutes.quote.toExact(), swapRoutes.quote.currency.decimals).toString(),
            "quoteDecimals": swapRoutes.quote.toExact(),
            "quoteGasAdjusted": (0, units_1.parseUnits)(swapRoutes.quoteGasAdjusted.toExact(), swapRoutes.quoteGasAdjusted.currency.decimals).toString(),
            "quoteGasAdjustedDecimals": swapRoutes.quoteGasAdjusted.toExact(),
            "gasUseEstimate": swapRoutes.estimatedGasUsed.toString(),
            "gasUseEstimateQuote": (0, units_1.parseUnits)(swapRoutes.estimatedGasUsedQuoteToken.toExact(), swapRoutes.estimatedGasUsedQuoteToken.currency.decimals).toString(),
            "gasUseEstimateQuoteDecimals": swapRoutes.estimatedGasUsedQuoteToken.toExact(),
            "gasUseEstimateUSD": swapRoutes.estimatedGasUsedUSD.toExact(),
            "gasPriceWei": swapRoutes.gasPriceWei.toString(),
            "routeString": (0, _1.routeAmountsToString)(swapRoutes.route),
            "tradeType": "EXACT_INPUT",
            "priceImpact": "",
            "tokenPath": [],
            "route": []
        },
    };
    const userPrice = new bignumber_js_1.default(swapRoutes.quote.toExact()).dividedBy(new bignumber_js_1.default(amountIn.toExact()));
    let marketPrice = new bignumber_js_1.default(0);
    for (let route of swapRoutes.route) {
        if (route.route instanceof _1.V3Route) {
            let routePrice = new bignumber_js_1.default(1);
            let tokenInput = tokenInStr;
            for (let pool of route.route.pools) {
                const isToken0Input = pool.token0.address.toLowerCase() == tokenInput.toLowerCase();
                tokenInput = isToken0Input ? pool.token1.address : pool.token0.address;
                const price = sqrtToPrice(new bignumber_js_1.default(pool.sqrtRatioX96.toString()), new bignumber_js_1.default(pool.token0.decimals), new bignumber_js_1.default(pool.token1.decimals), isToken0Input);
                routePrice = routePrice.times(price);
            }
            console.log('percent:' + route.percent.toString() + " price:" + routePrice.toString());
            marketPrice = marketPrice.plus(new bignumber_js_1.default(route.percent).times(routePrice).dividedBy(100));
        }
    }
    const absoluteChange = marketPrice.minus(userPrice);
    const percentChange = absoluteChange.div(marketPrice);
    result.quote.priceImpact = (percentChange.times(100)).toNumber().toFixed(3);
    console.log(`userPrice: ${userPrice.toString()} marketPrice:${marketPrice.toString()} priceImpact:${result.quote.priceImpact.toString()}`);
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
        if (route.route instanceof _1.V3Route) {
            for (let index = 0; index < route.route.pools.length; index++) {
                const routePool = route.route.pools[index];
                let routePoolObj = {
                    "type": route.protocol,
                    "address": route.poolAddresses[index],
                    "fee": routePool === null || routePool === void 0 ? void 0 : routePool.fee,
                    "liquidity": routePool === null || routePool === void 0 ? void 0 : routePool.liquidity.toString(),
                    "sqrtRatioX96": routePool === null || routePool === void 0 ? void 0 : routePool.sqrtRatioX96.toString(),
                    "sqrtRatioX96After": "",
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
                //console.log("sqrtRatioX96: " + routePool?.sqrtRatioX96.toString())
                // if (index == route.route.pools.length - 1) {
                //     //const isToken0Input = routePool?.token0.address.toLowerCase() != tokenOutStr.toLowerCase()
                //     if (route instanceof V3RouteWithValidQuote) {
                //         console.log("sqrtPriceX96AfterList: " + route.sqrtPriceX96AfterList[index]?.toString() + " isToken0Input: " + isToken0Input)
                //         try {
                //             const price = sqrtToPrice(new BigNumber(routePool!.sqrtRatioX96.toString()), new BigNumber(routePool!.token0.decimals), new BigNumber(routePool!.token1.decimals), isToken0Input)
                //             routePoolObj.sqrtRatioX96After = route.sqrtPriceX96AfterList[index]!.toString()
                //             const priceAfter = sqrtToPrice(new BigNumber(route.sqrtPriceX96AfterList[index]!.toString()), new BigNumber(routePool!.token0.decimals), new BigNumber(routePool!.token1.decimals), isToken0Input)
                //             const absoluteChange = price.minus(priceAfter)
                //             const percentChange = absoluteChange.div(price)//absoluteChange / price
                //             result.quote.priceImpact = (percentChange.multipliedBy(100)).toNumber().toFixed(3)
                //         } catch (e) {
                //             console.log("Exception priceImpact: " + e)
                //         }
                //     }
                // }
            }
        }
    }
    return { code: 1, data: result };
}
function sqrtToPrice(sqrt, decimals0, decimals1, token0IsInput = true) {
    const numerator = sqrt.times(sqrt);
    let ratio = numerator.dividedBy(2 ** 50).dividedBy(2 ** 50).dividedBy(2 ** 50).dividedBy(2 ** 42); //numerator / denominator
    const shiftDecimals = new bignumber_js_1.default(10).pow(decimals0.minus(decimals1).toNumber()); //Math.pow(10, decimals0 - decimals1)
    ratio = ratio.times(shiftDecimals); //ratio * shiftDecimals
    if (!token0IsInput) {
        ratio = new bignumber_js_1.default(1).div(ratio); // 1 / ratio
    }
    return ratio;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLDhDQUE0QjtBQUM1Qiw0Q0FBMEI7QUFDMUIseUNBQXVCO0FBR3ZCLGdEQUErRDtBQUMvRCx3REFBMkQ7QUFDM0QscUZBQTZEO0FBQzdELGdEQUFrRDtBQUNsRCxnRUFBcUM7QUFFckMsNERBQW1DO0FBQ25DLGlDQUF5RDtBQUN6RCx5QkFTWTtBQUNaLHlGQUFrRjtBQUNsRixxRkFBK0U7QUFHL0UsTUFBTSxNQUFNLEdBQUcsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFBO0FBQ2hDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQTtBQUNmLE1BQU0sT0FBTyxHQUFHLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQTtBQUNsQyxNQUFNLEdBQUcsR0FBRyxPQUFPLEVBQUUsQ0FBQTtBQUNyQixNQUFNLElBQUksR0FBRyxJQUFJLENBQUE7QUFHakIsR0FBRyxDQUFDLEdBQUcsQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFNLEVBQUUsR0FBUSxFQUFFLEVBQUU7SUFDckMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQTtBQUMxQixDQUFDLENBQUMsQ0FBQTtBQUVGLEdBQUcsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLEtBQUssRUFBRSxHQUFRLEVBQUUsR0FBUSxFQUFFLEVBQUU7SUFDNUMsSUFBSTtRQUNBLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQTtRQUN4QixPQUFPLENBQUMsR0FBRyxDQUFDLGlCQUFpQixHQUFHLEtBQUssQ0FBQyxDQUFBO1FBQ3RDLE1BQU0sT0FBTyxHQUFXLE1BQU0sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFBO1FBQ2pELE1BQU0sT0FBTyxHQUFXLEdBQUcsQ0FBQyxLQUFL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