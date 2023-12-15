export * from './providers';
export * from './routers';
export * from './util';

import { Protocol } from '@uniswap/router-sdk';
import { Currency, TradeType, Token } from '@uniswap/sdk-core';
import { JsonRpcProvider } from '@ethersproject/providers';
import DEFAULT_TOKEN_LIST from '@uniswap/default-token-list';
import { parseUnits } from '@ethersproject/units';
import BigNumber from 'bignumber.js';
import _ from 'lodash';
import NodeCache from 'node-cache';
import { NATIVE_NAMES_BY_ID, TO_PROTOCOL } from './util';
import {
    AlphaRouter,
    CachingGasStationProvider, CachingTokenListProvider, CachingTokenProviderWithFallback, EIP1559GasPriceProvider,
    GasPrice,
    ID_TO_PROVIDER,
    NodeJSCache,
    TokenProvider,
    UniswapMulticallProvider,
    ID_TO_CHAIN_ID, nativeOnChain, parseAmountWithDecimal, SwapRoute, routeAmountsToString, V3Route
} from './';
import { OnChainGasPriceProvider } from './providers/on-chain-gas-price-provider';
import { LegacyGasPriceProvider } from './providers/legacy-gas-price-provider';


const dotenv = require("dotenv")
dotenv.config()
const express = require('express')
const app = express()
const port = 9101


app.get('/monitor', (_: any, res: any) => {
    res.status(200).send()
})

app.get('/router', async (req: any, res: any) => {
    try {
        const start = Date.now()
        console.log("request start: " + start)
        const chainId: number = Number(req.query.chainId)
        const tokenIn: string = req.query.tokenIn
        const tokenOut: string = req.query.tokenOut
        const amount: number = Number(req.query.amount)
        const route = await getRoute(chainId, tokenIn, tokenOut, amount.toString())
        console.log("request end: " + (Date.now()-start))
        res.send(route)
    } catch (e) {
        console.log("Exception: " + e)
        res.send({code:0,message:""})
    }
})

app.listen(port, () => {
    console.log(`app listening on port ${port}`)
})

async function getRoute(chainIdNumb: number, tokenInStr: string, tokenOutStr: string, amountStr: string) {
    const start = Date.now()
    const chainId = ID_TO_CHAIN_ID(chainIdNumb);
    const chainProvider = ID_TO_PROVIDER(chainId);
    const provider = new JsonRpcProvider(chainProvider, chainId);
    const blockNumber = await provider.getBlockNumber();
    //const recipient = "0x81941c0E31e32FFB8D61D8972a20DAe48bC62d81"

    const tokenCache = new NodeJSCache<Token>(
        new NodeCache({ stdTTL: 3600, useClones: false })
    );

    let tokenListProvider: CachingTokenListProvider;
    // if (tokenListURI) {
    //     tokenListProvider = await CachingTokenListProvider.fromTokenListURI(
    //         chainId,
    //         tokenListURI,
    //         tokenCache
    //     );
    // } else {
    tokenListProvider = await CachingTokenListProvider.fromTokenList(
        chainId,
        DEFAULT_TOKEN_LIST,
        tokenCache
    );
    // }

    let multicall2Provider = new UniswapMulticallProvider(chainId, provider, 1_000_000);
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
    const tokenProvider = new CachingTokenProviderWithFallback(
        chainId,
        tokenCache,
        tokenListProvider,
        tokenProviderOnChain
    );


    const gasPriceCache = new NodeJSCache<GasPrice>(
        new NodeCache({ stdTTL: 15, useClones: true })
    );

    const router = new AlphaRouter({
        provider,
        chainId,
        multicall2Provider: multicall2Provider,
        gasPriceProvider: new CachingGasStationProvider(
            chainId,
            new OnChainGasPriceProvider(
                chainId,
                new EIP1559GasPriceProvider(provider),
                new LegacyGasPriceProvider(provider)
            ),
            gasPriceCache
        ),
    });

    let protocols: Protocol[] = [TO_PROTOCOL("v3")]//[TO_PROTOCOL("v2"), TO_PROTOCOL("v3"), TO_PROTOCOL("mixed")];

    // if the tokenIn str is 'ETH' or 'MATIC' or in NATIVE_NAMES_BY_ID
    const tokenIn: Currency = NATIVE_NAMES_BY_ID[chainId]!.includes(tokenInStr)
        ? nativeOnChain(chainId)
        : (await tokenProvider.getTokens([tokenInStr])).getTokenByAddress(
            tokenInStr
        )!;

    const tokenOut: Currency = NATIVE_NAMES_BY_ID[chainId]!.includes(tokenOutStr)
        ? nativeOnChain(chainId)
        : (await tokenProvider.getTokens([tokenOutStr])).getTokenByAddress(
            tokenOutStr
        )!;

    console.log("init end: "+ (Date.now()-start))
    let swapRoutes: SwapRoute | null;
    const amountIn = parseAmountWithDecimal(amountStr, tokenIn);
    
    try {
        swapRoutes = await router.route(
            amountIn,
            tokenOut,
            TradeType.EXACT_INPUT,
            undefined,
            {
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
            }
        );
    } catch(error:any) {
        return {code:0,message:error.message}
    }

    if (!swapRoutes) {
        return {code:0,message:"not find route"}
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
            "route": [] as any[]
        },
    }

    const userPrice = new BigNumber(swapRoutes.quote.toExact()).dividedBy(new BigNumber(amountIn.toExact()))
    let marketPrice = new BigNumber(0)
    let marketFee = new BigNumber(0)
    for (let route of swapRoutes.route) {
        if (route.route instanceof V3Route) {
            let routePrice = new BigNumber(1)
            let routeFee = new BigNumber(0)
            let tokenInput = tokenInStr;
            let routePools = [] as any[]
            for (let index = 0; index < route.route.pools.length; index++) {
                const pool = route.route.pools[index]!
                const isToken0Input = pool.token0.address.toLowerCase() == tokenInput.toLowerCase();
                tokenInput = isToken0Input ? pool.token1.address : pool.token0.address;
                const price = sqrtToPrice(new BigNumber(pool.sqrtRatioX96.toString()), new BigNumber(pool.token0.decimals), new BigNumber(pool.token1.decimals), isToken0Input)
                routePrice = routePrice.times(price)
                routeFee = routeFee.plus(pool.fee/10000)
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
                })
            }
            console.log('percent:'+route.percent.toString()+" price:"+routePrice.toString()+" fee:"+routeFee.toString())
            marketPrice = marketPrice.plus(new BigNumber(route.percent).times(routePrice).dividedBy(100))
            marketFee = marketFee.plus(new BigNumber(route.percent).times(routeFee).dividedBy(100))
            result.quote.route.push(routePools)
        }
    }
    const absoluteChange = marketPrice.minus(userPrice);
    const percentChange = absoluteChange.div(marketPrice);
    let priceImpact = percentChange.times(100).minus(marketFee);
    if (priceImpact.lte(0)) {
        result.quote.priceImpact = "0"
    } else {
        result.quote.priceImpact = priceImpact.toNumber().toFixed(3)
    }
    console.log(`userPrice: ${userPrice.toString()} marketPrice:${marketPrice.toString()} priceImpact:${result.quote.priceImpact}`)
    return {code:1,data:result}
}

function sqrtToPrice(sqrt: BigNumber, decimals0: BigNumber, decimals1: BigNumber, token0IsInput = true) {
    const numerator = sqrt.times(sqrt)
    let ratio = numerator.dividedBy(2 ** 50).dividedBy(2 ** 50).dividedBy(2 ** 50).dividedBy(2 ** 42) //numerator / denominator
    const shiftDecimals = new BigNumber(10).pow(decimals0.minus(decimals1).toNumber())   //Math.pow(10, decimals0 - decimals1)
    ratio = ratio.times(shiftDecimals)//ratio * shiftDecimals
    if (!token0IsInput) {
        ratio = new BigNumber(1).div(ratio) // 1 / ratio
    }
    return ratio
}

