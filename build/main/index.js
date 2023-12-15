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
            "route": []
        },
    };
    const userPrice = new bignumber_js_1.default(swapRoutes.quote.toExact()).dividedBy(new bignumber_js_1.default(amountIn.toExact()));
    let marketPrice = new bignumber_js_1.default(0);
    let marketFee = new bignumber_js_1.default(0);
    for (let route of swapRoutes.route) {
        if (route.route instanceof _1.V3Route) {
            let routePrice = new bignumber_js_1.default(1);
            let routeFee = new bignumber_js_1.default(0);
            let tokenInput = tokenInStr;
            let routePools = [];
            for (let index = 0; index < route.route.pools.length; index++) {
                const pool = route.route.pools[index];
                const isToken0Input = pool.token0.address.toLowerCase() == tokenInput.toLowerCase();
                tokenInput = isToken0Input ? pool.token1.address : pool.token0.address;
                const price = sqrtToPrice(new bignumber_js_1.default(pool.sqrtRatioX96.toString()), new bignumber_js_1.default(pool.token0.decimals), new bignumber_js_1.default(pool.token1.decimals), isToken0Input);
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
            console.log('percent:' + route.percent.toString() + " price:" + routePrice.toString() + " fee:" + routeFee.toString());
            marketPrice = marketPrice.plus(new bignumber_js_1.default(route.percent).times(routePrice).dividedBy(100));
            marketFee = marketFee.plus(new bignumber_js_1.default(route.percent).times(routeFee).dividedBy(100));
            result.quote.route.push(routePools);
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
    const shiftDecimals = new bignumber_js_1.default(10).pow(decimals0.minus(decimals1).toNumber()); //Math.pow(10, decimals0 - decimals1)
    ratio = ratio.times(shiftDecimals); //ratio * shiftDecimals
    if (!token0IsInput) {
        ratio = new bignumber_js_1.default(1).div(ratio); // 1 / ratio
    }
    return ratio;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLDhDQUE0QjtBQUM1Qiw0Q0FBMEI7QUFDMUIseUNBQXVCO0FBR3ZCLGdEQUErRDtBQUMvRCx3REFBMkQ7QUFDM0QscUZBQTZEO0FBQzdELGdEQUFrRDtBQUNsRCxnRUFBcUM7QUFFckMsNERBQW1DO0FBQ25DLGlDQUF5RDtBQUN6RCx5QkFTWTtBQUNaLHlGQUFrRjtBQUNsRixxRkFBK0U7QUFHL0UsTUFBTSxNQUFNLEdBQUcsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFBO0FBQ2hDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQTtBQUNmLE1BQU0sT0FBTyxHQUFHLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQTtBQUNsQyxNQUFNLEdBQUcsR0FBRyxPQUFPLEVBQUUsQ0FBQTtBQUNyQixNQUFNLElBQUksR0FBRyxJQUFJLENBQUE7QUFHakIsR0FBRyxDQUFDLEdBQUcsQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFNLEVBQUUsR0FBUSxFQUFFLEVBQUU7SUFDckMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQTtBQUMxQixDQUFDLENBQUMsQ0FBQTtBQUVGLEdBQUcsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLEtBQUssRUFBRSxHQUFRLEVBQUUsR0FBUSxFQUFFLEVBQUU7SUFDNUMsSUFBSTtRQUNBLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQTtRQUN4QixPQUFPLENBQUMsR0FBRyxDQUFDLGlCQUFpQixHQUFHLEtBQUssQ0FBQyxDQUFBO1FBQ3RDLE1BQU0sT0FBTyxHQUFXLE1BQU0sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFBO1FBQ2pELE1BQU0sT0FBTyxHQUFXLEdBQUcsQ0FBQyxLQUFL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