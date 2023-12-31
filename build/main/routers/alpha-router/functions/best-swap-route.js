"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBestSwapRouteBy = exports.getBestSwapRoute = void 0;
const bignumber_1 = require("@ethersproject/bignumber");
const router_sdk_1 = require("@uniswap/router-sdk");
const sdk_core_1 = require("@uniswap/sdk-core");
const jsbi_1 = __importDefault(require("jsbi"));
const lodash_1 = __importDefault(require("lodash"));
const fixed_reverse_heap_1 = __importDefault(require("mnemonist/fixed-reverse-heap"));
const queue_1 = __importDefault(require("mnemonist/queue"));
const util_1 = require("../../../util");
const amounts_1 = require("../../../util/amounts");
const gas_models_1 = require("../gas-models");
async function getBestSwapRoute(amount, percents, routesWithValidQuotes, routeType, chainId, routingConfig, portionProvider, gasModel, swapConfig) {
    const { forceMixedRoutes } = routingConfig;
    /// Like with forceCrossProtocol, we apply that logic here when determining the bestSwapRoute
    if (forceMixedRoutes) {
        // log.info(
        //   {
        //     forceMixedRoutes: forceMixedRoutes,
        //   },
        //   'Forcing mixed routes by filtering out other route types'
        // );
        routesWithValidQuotes = lodash_1.default.filter(routesWithValidQuotes, (quotes) => {
            return quotes.protocol === router_sdk_1.Protocol.MIXED;
        });
        if (!routesWithValidQuotes) {
            return null;
        }
    }
    // Build a map of percentage of the input to list of valid quotes.
    // Quotes can be null for a variety of reasons (not enough liquidity etc), so we drop them here too.
    const percentToQuotes = {};
    for (const routeWithValidQuote of routesWithValidQuotes) {
        if (!percentToQuotes[routeWithValidQuote.percent]) {
            percentToQuotes[routeWithValidQuote.percent] = [];
        }
        percentToQuotes[routeWithValidQuote.percent].push(routeWithValidQuote);
    }
    // Given all the valid quotes for each percentage find the optimal route.
    const swapRoute = await getBestSwapRouteBy(routeType, percentToQuotes, percents, chainId, (rq) => rq.quoteAdjustedForGas, routingConfig, portionProvider, gasModel, swapConfig);
    // It is possible we were unable to find any valid route given the quotes.
    if (!swapRoute) {
        return null;
    }
    // Due to potential loss of precision when taking percentages of the input it is possible that the sum of the amounts of each
    // route of our optimal quote may not add up exactly to exactIn or exactOut.
    //
    // We check this here, and if there is a mismatch
    // add the missing amount to a random route. The missing amount size should be neglible so the quote should still be highly accurate.
    const { routes: routeAmounts } = swapRoute;
    const totalAmount = lodash_1.default.reduce(routeAmounts, (total, routeAmount) => total.add(routeAmount.amount), amounts_1.CurrencyAmount.fromRawAmount(routeAmounts[0].amount.currency, 0));
    const missingAmount = amount.subtract(totalAmount);
    if (missingAmount.greaterThan(0)) {
        // log.info(
        //   {
        //     missingAmount: missingAmount.quotient.toString(),
        //   },
        //   `Optimal route's amounts did not equal exactIn/exactOut total. Adding missing amount to last route in array.`
        // );
        routeAmounts[routeAmounts.length - 1].amount =
            routeAmounts[routeAmounts.length - 1].amount.add(missingAmount);
    }
    // log.info(
    //   {
    //     routes: routeAmountsToString(routeAmounts),
    //     numSplits: routeAmounts.length,
    //     amount: amount.toExact(),
    //     quote: swapRoute.quote.toExact(),
    //     quoteGasAdjusted: swapRoute.quoteGasAdjusted.toFixed(
    //       Math.min(swapRoute.quoteGasAdjusted.currency.decimals, 2)
    //     ),
    //     estimatedGasUSD: swapRoute.estimatedGasUsedUSD.toFixed(
    //       Math.min(swapRoute.estimatedGasUsedUSD.currency.decimals, 2)
    //     ),
    //     estimatedGasToken: swapRoute.estimatedGasUsedQuoteToken.toFixed(
    //       Math.min(swapRoute.estimatedGasUsedQuoteToken.currency.decimals, 2)
    //     ),
    //   },
    //   `Found best swap route. ${routeAmounts.length} split.`
    // );
    return swapRoute;
}
exports.getBestSwapRoute = getBestSwapRoute;
async function getBestSwapRouteBy(routeType, percentToQuotes, percents, chainId, by, routingConfig, portionProvider, gasModel, swapConfig) {
    var _a;
    // Build a map of percentage to sorted list of quotes, with the biggest quote being first in the list.
    const percentToSortedQuotes = lodash_1.default.mapValues(percentToQuotes, (routeQuotes) => {
        return routeQuotes.sort((routeQuoteA, routeQuoteB) => {
            if (routeType == sdk_core_1.TradeType.EXACT_INPUT) {
                return by(routeQuoteA).greaterThan(by(routeQuoteB)) ? -1 : 1;
            }
            else {
                return by(routeQuoteA).lessThan(by(routeQuoteB)) ? -1 : 1;
            }
        });
    });
    const quoteCompFn = routeType == sdk_core_1.TradeType.EXACT_INPUT
        ? (a, b) => a.greaterThan(b)
        : (a, b) => a.lessThan(b);
    const sumFn = (currencyAmounts) => {
        let sum = currencyAmounts[0];
        for (let i = 1; i < currencyAmounts.length; i++) {
            sum = sum.add(currencyAmounts[i]);
        }
        return sum;
    };
    let bestQuote;
    let bestSwap;
    // Min-heap for tracking the 5 best swaps given some number of splits.
    const bestSwapsPerSplit = new fixed_reverse_heap_1.default(Array, (a, b) => {
        return quoteCompFn(a.quote, b.quote) ? -1 : 1;
    }, 3);
    const { minSplits, maxSplits, forceCrossProtocol } = routingConfig;
    if (!percentToSortedQuotes[100] || minSplits > 1 || forceCrossProtocol) {
        // log.info(
        //   {
        //     percentToSortedQuotes: _.mapValues(
        //       percentToSortedQuotes,
        //       (p) => p.length
        //     ),
        //   },
        //   'Did not find a valid route without any splits. Continuing search anyway.'
        // );
    }
    else {
        bestQuote = by(percentToSortedQuotes[100][0]);
        bestSwap = [percentToSortedQuotes[100][0]];
        for (const routeWithQuote of percentToSortedQuotes[100].slice(0, 5)) {
            bestSwapsPerSplit.push({
                quote: by(routeWithQuote),
                routes: [routeWithQuote],
            });
        }
    }
    // We do a BFS. Each additional node in a path represents us adding an additional split to the route.
    const queue = new queue_1.default();
    // First we seed BFS queue with the best quotes for each percentage.
    // i.e. [best quote when sending 10% of amount, best quote when sending 20% of amount, ...]
    // We will explore the various combinations from each node.
    for (let i = percents.length; i >= 0; i--) {
        const percent = percents[i];
        if (!percentToSortedQuotes[percent]) {
            continue;
        }
        queue.enqueue({
            curRoutes: [percentToSortedQuotes[percent][0]],
            percentIndex: i,
            remainingPercent: 100 - percent,
            special: false,
        });
        if (!percentToSortedQuotes[percent] ||
            !percentToSortedQuotes[percent][1]) {
            continue;
        }
        queue.enqueue({
            curRoutes: [percentToSortedQuotes[percent][1]],
            percentIndex: i,
            remainingPercent: 100 - percent,
            special: true,
        });
    }
    let splits = 1;
    while (queue.size > 0) {
        // log.info(
        //   {
        //     top5: _.map(
        //       Array.from(bestSwapsPerSplit.consume()),
        //       (q) =>
        //         `${q.quote.toExact()} (${_(q.routes)
        //           .map((r) => r.toString())
        //           .join(', ')})`
        //     ),
        //     onQueue: queue.size,
        //   },
        //   `Top 3 with ${splits} splits`
        // );
        bestSwapsPerSplit.clear();
        // Size of the queue at this point is the number of potential routes we are investigating for the given number of splits.
        let layer = queue.size;
        splits++;
        // If we didn't improve our quote by adding another split, very unlikely to improve it by splitting more after that.
        if (splits >= 3 && bestSwap && bestSwap.length < splits - 1) {
            break;
        }
        if (splits > maxSplits) {
            //log.info('Max splits reached. Stopping search.');
            break;
        }
        while (layer > 0) {
            layer--;
            const { remainingPercent, curRoutes, percentIndex, special } = queue.dequeue();
            // For all other percentages, add a new potential route.
            // E.g. if our current aggregated route if missing 50%, we will create new nodes and add to the queue for:
            // 50% + new 10% route, 50% + new 20% route, etc.
            for (let i = percentIndex; i >= 0; i--) {
                const percentA = percents[i];
                if (percentA > remainingPercent) {
                    continue;
                }
                // At some point the amount * percentage is so small that the quoter is unable to get
                // a quote. In this case there could be no quotes for that percentage.
                if (!percentToSortedQuotes[percentA]) {
                    continue;
                }
                const candidateRoutesA = percentToSortedQuotes[percentA];
                // Find the best route in the complimentary percentage that doesn't re-use a pool already
                // used in the current route. Re-using pools is not allowed as each swap through a pool changes its liquidity,
                // so it would make the quotes inaccurate.
                const routeWithQuoteA = findFirstRouteNotUsingUsedPools(curRoutes, candidateRoutesA, forceCrossProtocol);
                if (!routeWithQuoteA) {
                    continue;
                }
                const remainingPercentNew = remainingPercent - percentA;
                const curRoutesNew = [...curRoutes, routeWithQuoteA];
                // If we've found a route combination that uses all 100%, and it has at least minSplits, update our best route.
                if (remainingPercentNew == 0 && splits >= minSplits) {
                    const quotesNew = lodash_1.default.map(curRoutesNew, (r) => by(r));
                    const quoteNew = sumFn(quotesNew);
                    let gasCostL1QuoteToken = amounts_1.CurrencyAmount.fromRawAmount(quoteNew.currency, 0);
                    if (util_1.HAS_L1_FEE.includes(chainId)) {
                        const onlyV3Routes = curRoutesNew.every((route) => route.protocol == router_sdk_1.Protocol.V3);
                        if (gasModel == undefined || !onlyV3Routes) {
                            throw new Error('Can\'t compute L1 gas fees.');
                        }
                        else {
                            const gasCostL1 = await gasModel.calculateL1GasFees(curRoutesNew);
                            gasCostL1QuoteToken = gasCostL1.gasCostL1QuoteToken;
                        }
                    }
                    const quoteAfterL1Adjust = routeType == sdk_core_1.TradeType.EXACT_INPUT
                        ? quoteNew.subtract(gasCostL1QuoteToken)
                        : quoteNew.add(gasCostL1QuoteToken);
                    bestSwapsPerSplit.push({
                        quote: quoteAfterL1Adjust,
                        routes: curRoutesNew,
                    });
                    if (!bestQuote || quoteCompFn(quoteAfterL1Adjust, bestQuote)) {
                        bestQuote = quoteAfterL1Adjust;
                        bestSwap = curRoutesNew;
                        // Temporary experiment.
                        // if (special) {
                        //   metric.putMetric(
                        //     `BestSwapNotPickingBestForPercent`,
                        //     1,
                        //     MetricLoggerUnit.Count
                        //   );
                        // }
                    }
                }
                else {
                    queue.enqueue({
                        curRoutes: curRoutesNew,
                        remainingPercent: remainingPercentNew,
                        percentIndex: i,
                        special,
                    });
                }
            }
        }
    }
    if (!bestSwap) {
        //log.info(`Could not find a valid swap`);
        console.log('Could not find a valid swap');
        return undefined;
    }
    //const postSplitNow = Date.now();
    let quoteGasAdjusted = sumFn(lodash_1.default.map(bestSwap, (routeWithValidQuote) => routeWithValidQuote.quoteAdjustedForGas));
    // this calculates the base gas used
    // if on L1, its the estimated gas used based on hops and ticks across all the routes
    // if on L2, its the gas used on the L2 based on hops and ticks across all the routes
    const estimatedGasUsed = (0, lodash_1.default)(bestSwap)
        .map((routeWithValidQuote) => routeWithValidQuote.gasEstimate)
        .reduce((sum, routeWithValidQuote) => sum.add(routeWithValidQuote), bignumber_1.BigNumber.from(0));
    if (!gas_models_1.usdGasTokensByChain[chainId] || !gas_models_1.usdGasTokensByChain[chainId][0]) {
        // Each route can use a different stablecoin to account its gas costs.
        // They should all be pegged, and this is just an estimate, so we do a merge
        // to an arbitrary stable.
        throw new Error(`Could not find a USD token for computing gas costs on ${chainId}`);
    }
    const usdToken = gas_models_1.usdGasTokensByChain[chainId][0];
    const usdTokenDecimals = usdToken.decimals;
    //console.log("usdToken: "+usdToken.address+ " decimals: "+usdTokenDecimals.toString())
    // if on L2, calculate the L1 security fee
    let gasCostsL1ToL2 = {
        gasUsedL1: bignumber_1.BigNumber.from(0),
        gasCostL1USD: amounts_1.CurrencyAmount.fromRawAmount(usdToken, 0),
        gasCostL1QuoteToken: amounts_1.CurrencyAmount.fromRawAmount(
        // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
        (_a = bestSwap[0]) === null || _a === void 0 ? void 0 : _a.quoteToken, 0),
    };
    // If swapping on an L2 that includes a L1 security fee, calculate the fee and include it in the gas adjusted quotes
    if (util_1.HAS_L1_FEE.includes(chainId)) {
        // ensure the gasModel exists and that the swap route is a v3 only route
        const onlyV3Routes = bestSwap.every((route) => route.protocol == router_sdk_1.Protocol.V3);
        if (gasModel == undefined || !onlyV3Routes) {
            throw new Error('Can\'t compute L1 gas fees.');
        }
        else {
            gasCostsL1ToL2 = await gasModel.calculateL1GasFees(bestSwap);
        }
    }
    const { gasCostL1USD, gasCostL1QuoteToken } = gasCostsL1ToL2;
    // For each gas estimate, normalize decimals to that of the chosen usd token.
    const estimatedGasUsedUSDs = (0, lodash_1.default)(bestSwap)
        .map((routeWithValidQuote) => {
        // TODO: will error if gasToken has decimals greater than usdToken
        const decimalsDiff = usdTokenDecimals - routeWithValidQuote.gasCostInUSD.currency.decimals;
        //console.log("gasToken: "+JSON.stringify(routeWithValidQuote.gasCostInUSD.currency))
        if (decimalsDiff == 0) {
            return amounts_1.CurrencyAmount.fromRawAmount(usdToken, routeWithValidQuote.gasCostInUSD.quotient);
        }
        return amounts_1.CurrencyAmount.fromRawAmount(usdToken, jsbi_1.default.multiply(routeWithValidQuote.gasCostInUSD.quotient, jsbi_1.default.exponentiate(jsbi_1.default.BigInt(10), jsbi_1.default.BigInt(decimalsDiff))));
    })
        .value();
    let estimatedGasUsedUSD = sumFn(estimatedGasUsedUSDs);
    // if they are different usd pools, convert to the usdToken
    if (estimatedGasUsedUSD.currency != gasCostL1USD.currency) {
        const decimalsDiff = usdTokenDecimals - gasCostL1USD.currency.decimals;
        estimatedGasUsedUSD = estimatedGasUsedUSD.add(amounts_1.CurrencyAmount.fromRawAmount(usdToken, jsbi_1.default.multiply(gasCostL1USD.quotient, jsbi_1.default.exponentiate(jsbi_1.default.BigInt(10), jsbi_1.default.BigInt(decimalsDiff)))));
    }
    else {
        estimatedGasUsedUSD = estimatedGasUsedUSD.add(gasCostL1USD);
    }
    // log.info(
    //   {
    //     estimatedGasUsedUSD: estimatedGasUsedUSD.toExact(),
    //     normalizedUsdToken: usdToken,
    //     routeUSDGasEstimates: _.map(
    //       bestSwap,
    //       (b) =>
    //         `${b.percent}% ${routeToString(b.route)} ${b.gasCostInUSD.toExact()}`
    //     ),
    //     flatL1GasCostUSD: gasCostL1USD.toExact(),
    //   },
    //   'USD gas estimates of best route'
    // );
    const estimatedGasUsedQuoteToken = sumFn(lodash_1.default.map(bestSwap, (routeWithValidQuote) => routeWithValidQuote.gasCostInToken)).add(gasCostL1QuoteToken);
    const quote = sumFn(lodash_1.default.map(bestSwap, (routeWithValidQuote) => routeWithValidQuote.quote));
    // Adjust the quoteGasAdjusted for the l1 fee
    if (routeType == sdk_core_1.TradeType.EXACT_INPUT) {
        const quoteGasAdjustedForL1 = quoteGasAdjusted.subtract(gasCostL1QuoteToken);
        quoteGasAdjusted = quoteGasAdjustedForL1;
    }
    else {
        const quoteGasAdjustedForL1 = quoteGasAdjusted.add(gasCostL1QuoteToken);
        quoteGasAdjusted = quoteGasAdjustedForL1;
    }
    const routeWithQuotes = bestSwap.sort((routeAmountA, routeAmountB) => routeAmountB.amount.greaterThan(routeAmountA.amount) ? 1 : -1);
    // metric.putMetric(
    //   'PostSplitDone',
    //   Date.now() - postSplitNow,
    //   MetricLoggerUnit.Milliseconds
    // );
    return {
        quote,
        quoteGasAdjusted,
        estimatedGasUsed,
        estimatedGasUsedUSD,
        estimatedGasUsedQuoteToken,
        routes: portionProvider.getRouteWithQuotePortionAdjusted(routeType, routeWithQuotes, swapConfig),
    };
}
exports.getBestSwapRouteBy = getBestSwapRouteBy;
// We do not allow pools to be re-used across split routes, as swapping through a pool changes the pools state.
// Given a list of used routes, this function finds the first route in the list of candidate routes that does not re-use an already used pool.
const findFirstRouteNotUsingUsedPools = (usedRoutes, candidateRouteQuotes, forceCrossProtocol) => {
    const poolAddressSet = new Set();
    const usedPoolAddresses = (0, lodash_1.default)(usedRoutes)
        .flatMap((r) => r.poolAddresses)
        .value();
    for (const poolAddress of usedPoolAddresses) {
        poolAddressSet.add(poolAddress);
    }
    const protocolsSet = new Set();
    const usedProtocols = (0, lodash_1.default)(usedRoutes)
        .flatMap((r) => r.protocol)
        .uniq()
        .value();
    for (const protocol of usedProtocols) {
        protocolsSet.add(protocol);
    }
    for (const routeQuote of candidateRouteQuotes) {
        const { poolAddresses, protocol } = routeQuote;
        if (poolAddresses.some((poolAddress) => poolAddressSet.has(poolAddress))) {
            continue;
        }
        // This code is just for debugging. Allows us to force a cross-protocol split route by skipping
        // consideration of routes that come from the same protocol as a used route.
        const needToForce = forceCrossProtocol && protocolsSet.size == 1;
        if (needToForce && protocolsSet.has(protocol)) {
            continue;
        }
        return routeQuote;
    }
    return null;
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmVzdC1zd2FwLXJvdXRlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL3JvdXRlcnMvYWxwaGEtcm91dGVyL2Z1bmN0aW9ucy9iZXN0LXN3YXAtcm91dGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUEsd0RBQXFEO0FBQ3JELG9EQUErQztBQUMvQyxnREFBdUQ7QUFDdkQsZ0RBQXdCO0FBQ3hCLG9EQUF1QjtBQUN2QixzRkFBNEQ7QUFDNUQsNERBQW9DO0FBR3BDLHdDQUEyQztBQUMzQyxtREFBdUQ7QUFNdkQsOENBQStFO0FBZ0J4RSxLQUFLLFVBQVUsZ0JBQWdCLENBQ3BDLE1BQXNCLEVBQ3RCLFFBQWtCLEVBQ2xCLHFCQUE0QyxFQUM1QyxTQUFvQixFQUNwQixPQUFnQixFQUNoQixhQUFnQyxFQUNoQyxlQUFpQyxFQUNqQyxRQUEyQyxFQUMzQyxVQUF3QjtJQUV4QixNQUFNLEVBQUUsZ0JBQWdCLEVBQUUsR0FBRyxhQUFhLENBQUM7SUFFM0MsNkZBQTZGO0lBQzdGLElBQUksZ0JBQWdCLEVBQUU7UUFDcEIsWUFBWTtRQUNaLE1BQU07UUFDTiwwQ0FBMEM7UUFDMUMsT0FBTztRQUNQLDhEQUE4RDtRQUM5RCxLQUFLO1FBQ0wscUJBQXFCLEdBQUcsZ0JBQUMsQ0FBQyxNQUFNLENBQUMscUJBQXFCLEVBQUUsQ0FBQyxNQUFNLEVBQUUsRUFBRTtZQUNqRSxPQUFPLE1BQU0sQ0FBQyxRQUFRLEtBQUsscUJBQVEsQ0FBQyxLQUFLLENBQUM7UUFDNUMsQ0FBQyxDQUFDLENBQUM7UUFDSCxJQUFJLENBQUMscUJBQXFCLEVBQUU7WUFDMUIsT0FBTyxJQUFJLENBQUM7U0FDYjtLQUNGO0lBRUQsa0VBQWtFO0lBQ2xFLG9HQUFvRztJQUNwRyxNQUFNLGVBQWUsR0FBaUQsRUFBRSxDQUFDO0lBQ3pFLEtBQUssTUFBTSxtQkFBbUIsSUFBSSxxQkFBcUIsRUFBRTtRQUN2RCxJQUFJLENBQUMsZUFBZSxDQUFD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