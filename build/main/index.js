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
    var _a;
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
    //if (exactIn) {
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
                if (index == route.route.pools.length - 1) {
                    //price impact
                    const isToken0Input = (routePool === null || routePool === void 0 ? void 0 : routePool.token0.address.toLowerCase()) != tokenOutStr.toLowerCase();
                    if (route instanceof _1.V3RouteWithValidQuote) {
                        console.log("sqrtPriceX96AfterList: " + ((_a = route.sqrtPriceX96AfterList[index]) === null || _a === void 0 ? void 0 : _a.toString()) + " isToken0Input: " + isToken0Input);
                        try {
                            const price = sqrtToPrice(new bignumber_js_1.default(routePool.sqrtRatioX96.toString()), new bignumber_js_1.default(routePool.token0.decimals), new bignumber_js_1.default(routePool.token1.decimals), isToken0Input);
                            //console.log('price', price.toString())
                            routePoolObj.sqrtRatioX96After = route.sqrtPriceX96AfterList[index].toString();
                            const priceAfter = sqrtToPrice(new bignumber_js_1.default(route.sqrtPriceX96AfterList[index].toString()), new bignumber_js_1.default(routePool.token0.decimals), new bignumber_js_1.default(routePool.token1.decimals), isToken0Input);
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
    const shiftDecimals = new bignumber_js_1.default(10).pow(decimals0.minus(decimals1).toNumber()); //Math.pow(10, decimals0 - decimals1)
    ratio = ratio.multipliedBy(shiftDecimals); //ratio * shiftDecimals
    if (!token0IsInput) {
        ratio = new bignumber_js_1.default(1).div(ratio); // 1 / ratio
    }
    return ratio;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLDhDQUE0QjtBQUM1Qiw0Q0FBMEI7QUFDMUIseUNBQXVCO0FBR3ZCLGdEQUErRDtBQUMvRCx3REFBMkQ7QUFDM0QscUZBQTZEO0FBQzdELGdEQUFrRDtBQUNsRCxnRUFBcUM7QUFFckMsNERBQW1DO0FBQ25DLGlDQUF5RDtBQUN6RCx5QkFTWTtBQUNaLHlGQUFrRjtBQUNsRixxRkFBK0U7QUFHL0UsTUFBTSxNQUFNLEdBQUcsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFBO0FBQ2hDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQTtBQUNmLE1BQU0sT0FBTyxHQUFHLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQTtBQUNsQyxNQUFNLEdBQUcsR0FBRyxPQUFPLEVBQUUsQ0FBQTtBQUNyQixNQUFNLElBQUksR0FBRyxJQUFJLENBQUE7QUFHakIsR0FBRyxDQUFDLEdBQUcsQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFNLEVBQUUsR0FBUSxFQUFFLEVBQUU7SUFDckMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQTtBQUMxQixDQUFDLENBQUMsQ0FBQTtBQUVGLEdBQUcsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLEtBQUssRUFBRSxHQUFRLEVBQUUsR0FBUSxFQUFFLEVBQUU7SUFDNUMsSUFBSTtRQUNBLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQTtRQUN4QixPQUFPLENBQUMsR0FBRyxDQUFDLGlCQUFpQixHQUFHLEtBQUssQ0FBQyxDQUFBO1FBQ3RDLE1BQU0sT0FBTyxHQUFXLE1BQU0sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFBO1FBQ2pELE1BQU0sT0FBTyxHQUFXLEdBQUcsQ0FBQyxLQUFL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