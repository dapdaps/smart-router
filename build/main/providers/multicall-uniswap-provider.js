"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UniswapMulticallProvider = void 0;
const lodash_1 = __importDefault(require("lodash"));
const stats_lite_1 = __importDefault(require("stats-lite"));
const UniswapInterfaceMulticall__factory_1 = require("../types/v3/factories/UniswapInterfaceMulticall__factory");
const addresses_1 = require("../util/addresses");
const log_1 = require("../util/log");
const multicall_provider_1 = require("./multicall-provider");
/**
 * The UniswapMulticall contract has added functionality for limiting the amount of gas
 * that each call within the multicall can consume. This is useful for operations where
 * a call could consume such a large amount of gas that it causes the node to error out
 * with an out of gas error.
 *
 * @export
 * @class UniswapMulticallProvider
 */
class UniswapMulticallProvider extends multicall_provider_1.IMulticallProvider {
    constructor(chainId, provider, gasLimitPerCall = 1000000) {
        super();
        this.chainId = chainId;
        this.provider = provider;
        this.gasLimitPerCall = gasLimitPerCall;
        const multicallAddress = addresses_1.UNISWAP_MULTICALL_ADDRESSES[this.chainId];
        if (!multicallAddress) {
            throw new Error(`No address for Uniswap Multicall Contract on chain id: ${chainId}`);
        }
        this.multicallContract = UniswapInterfaceMulticall__factory_1.UniswapInterfaceMulticall__factory.connect(multicallAddress, this.provider);
    }
    async callSameFunctionOnMultipleContracts(params) {
        var _a;
        const { addresses, contractInterface, functionName, functionParams, providerConfig, } = params;
        const blockNumberOverride = (_a = providerConfig === null || providerConfig === void 0 ? void 0 : providerConfig.blockNumber) !== null && _a !== void 0 ? _a : undefined;
        const fragment = contractInterface.getFunction(functionName);
        const callData = contractInterface.encodeFunctionData(fragment, functionParams);
        const calls = lodash_1.default.map(addresses, (address) => {
            return {
                target: address,
                callData,
                gasLimit: this.gasLimitPerCall,
            };
        });
        log_1.log.debug({ calls }, `About to multicall for ${functionName} across ${addresses.length} addresses`);
        const { blockNumber, returnData: aggregateResults } = await this.multicallContract.callStatic.multicall(calls, {
            blockTag: blockNumberOverride,
        });
        const results = [];
        for (let i = 0; i < aggregateResults.length; i++) {
            const { success, returnData } = aggregateResults[i];
            // Return data "0x" is sometimes returned for invalid calls.
            if (!success || returnData.length <= 2) {
                log_1.log.debug({ result: aggregateResults[i] }, `Invalid result calling ${functionName} on address ${addresses[i]}`);
                results.push({
                    success: false,
                    returnData,
                });
                continue;
            }
            results.push({
                success: true,
                result: contractInterface.decodeFunctionResult(fragment, returnData),
            });
        }
        log_1.log.debug({ results }, `Results for multicall on ${functionName} across ${addresses.length} addresses as of block ${blockNumber}`);
        return { blockNumber, results };
    }
    async callSameFunctionOnContractWithMultipleParams(params) {
        var _a, _b;
        const { address, contractInterface, functionName, functionParams, additionalConfig, providerConfig, } = params;
        const fragment = contractInterface.getFunction(functionName);
        const gasLimitPerCall = (_a = additionalConfig === null || additionalConfig === void 0 ? void 0 : additionalConfig.gasLimitPerCallOverride) !== null && _a !== void 0 ? _a : this.gasLimitPerCall;
        const blockNumberOverride = (_b = providerConfig === null || providerConfig === void 0 ? void 0 : providerConfig.blockNumber) !== null && _b !== void 0 ? _b : undefined;
        //console.log("target: " + address + " functionName: " + functionName)
        //console.log("gasLimitPerCallOverride: " + additionalConfig?.gasLimitPerCallOverride + " gasLimitPerCall: " + gasLimitPerCall)
        const calls = lodash_1.default.map(functionParams, (functionParam) => {
            const callData = contractInterface.encodeFunctionData(fragment, functionParam);
            return {
                target: address,
                callData,
                gasLimit: gasLimitPerCall,
            };
        });
        //console.log("calls: " + JSON.stringify(calls))
        log_1.log.debug({ calls }, `About to multicall for ${functionName} at address ${address} with ${functionParams.length} different sets of params`);
        console.log("calls: " + calls.length);
        const results = [];
        const gasUsedForSuccess = [];
        //try {
        const { blockNumber, returnData: aggregateResults } = await this.multicallContract.callStatic.multicall(calls, {
            blockTag: blockNumberOverride,
        });
        for (let i = 0; i < aggregateResults.length; i++) {
            const { success, returnData, gasUsed } = aggregateResults[i];
            // Return data "0x" is sometimes returned for invalid pools.
            if (!success || returnData.length <= 2) {
                results.push({
                    success: false,
                    returnData,
                });
                continue;
            }
            gasUsedForSuccess.push(gasUsed.toNumber());
            results.push({
                success: true,
                result: contractInterface.decodeFunctionResult(fragment, returnData),
            });
        }
        return {
            blockNumber,
            results,
            approxGasUsedPerSuccessCall: stats_lite_1.default.percentile(gasUsedForSuccess, 99),
        };
        //} catch (err: any) {
        // if (!err.message.includes('out of gas')) {
        //   throw err
        // }
        //console.log("----re---- results: " + results.length + " " + calls.slice(0, calls.length / 3).length + " " + calls.slice(calls.length / 3, calls.length * 2 / 3).length + " " + calls.slice(calls.length * 2 / 3).length)
        //console.log("calls0: " + JSON.stringify(calls.slice(0, calls.length / 3)))
        // const { blockNumber, returnData: aggregateResults } =
        //   await this.multicallContract.callStatic.multicall(calls.slice(0, calls.length / 3), {
        //     blockTag: blockNumberOverride,
        //   });
        // const { returnData: aggregateResults1 } =
        //   await this.multicallContract.callStatic.multicall(calls.slice(calls.length / 3, calls.length * 2 / 3), {
        //     blockTag: blockNumberOverride,
        //   });
        // const { returnData: aggregateResults2 } =
        //   await this.multicallContract.callStatic.multicall(calls.slice(calls.length * 2 / 3), {
        //     blockTag: blockNumberOverride,
        //   });
        // console.log("aggregateResults: " + aggregateResults.length)
        // for (let i = 0; i < aggregateResults.length; i++) {
        //   const { success, returnData, gasUsed } = aggregateResults[i]!;
        //   // Return data "0x" is sometimes returned for invalid pools.
        //   if (!success || returnData.length <= 2) {
        //     console.log("aggregateResults fail: " + i)
        //     results.push({
        //       success: false,
        //       returnData,
        //     });
        //     continue;
        //   }
        //   gasUsedForSuccess.push(gasUsed.toNumber());
        //   results.push({
        //     success: true,
        //     result: contractInterface.decodeFunctionResult(
        //       fragment,
        //       returnData
        //     ) as unknown as TReturn,
        //   });
        // }
        // console.log("aggregateResults: " + aggregateResults1.length)
        // for (let i = 0; i < aggregateResults1.length; i++) {
        //   const { success, returnData, gasUsed } = aggregateResults1[i]!;
        //   // Return data "0x" is sometimes returned for invalid pools.
        //   if (!success || returnData.length <= 2) {
        //     console.log("aggregateResults1 fail: " + i)
        //     results.push({
        //       success: false,
        //       returnData,
        //     });
        //     continue;
        //   }
        //   gasUsedForSuccess.push(gasUsed.toNumber());
        //   results.push({
        //     success: true,
        //     result: contractInterface.decodeFunctionResult(
        //       fragment,
        //       returnData
        //     ) as unknown as TReturn,
        //   });
        // }
        // console.log("aggregateResults: " + aggregateResults2.length)
        // for (let i = 0; i < aggregateResults2.length; i++) {
        //   const { success, returnData, gasUsed } = aggregateResults2[i]!;
        //   // Return data "0x" is sometimes returned for invalid pools.
        //   if (!success || returnData.length <= 2) {
        //     console.log("aggregateResults2 fail: " + i)
        //     results.push({
        //       success: false,
        //       returnData,
        //     });
        //     continue;
        //   }
        //   gasUsedForSuccess.push(gasUsed.toNumber());
        //   results.push({
        //     success: true,
        //     result: contractInterface.decodeFunctionResult(
        //       fragment,
        //       returnData
        //     ) as unknown as TReturn,
        //   });
        // }
        // console.log("results: " + results.length)
        // return {
        //   blockNumber,
        //   results,
        //   approxGasUsedPerSuccessCall: stats.percentile(gasUsedForSuccess, 99),
        // };
        //}
    }
    async callMultipleFunctionsOnSameContract(params) {
        var _a, _b;
        const { address, contractInterface, functionNames, functionParams, additionalConfig, providerConfig, } = params;
        const gasLimitPerCall = (_a = additionalConfig === null || additionalConfig === void 0 ? void 0 : additionalConfig.gasLimitPerCallOverride) !== null && _a !== void 0 ? _a : this.gasLimitPerCall;
        const blockNumberOverride = (_b = providerConfig === null || providerConfig === void 0 ? void 0 : providerConfig.blockNumber) !== null && _b !== void 0 ? _b : undefined;
        const calls = lodash_1.default.map(functionNames, (functionName, i) => {
            const fragment = contractInterface.getFunction(functionName);
            const param = functionParams ? functionParams[i] : [];
            const callData = contractInterface.encodeFunctionData(fragment, param);
            return {
                target: address,
                callData,
                gasLimit: gasLimitPerCall,
            };
        });
        log_1.log.debug({ calls }, `About to multicall for ${functionNames.length} functions at address ${address} with ${functionParams === null || functionParams === void 0 ? void 0 : functionParams.length} different sets of params`);
        const { blockNumber, returnData: aggregateResults } = await this.multicallContract.callStatic.multicall(calls, {
            blockTag: blockNumberOverride,
        });
        const results = [];
        const gasUsedForSuccess = [];
        for (let i = 0; i < aggregateResults.length; i++) {
            const fragment = contractInterface.getFunction(functionNames[i]);
            const { success, returnData, gasUsed } = aggregateResults[i];
            // Return data "0x" is sometimes returned for invalid pools.
            if (!success || returnData.length <= 2) {
                log_1.log.debug({ result: aggregateResults[i] }, `Invalid result calling ${functionNames[i]} with ${functionParams ? functionParams[i] : '0'} params`);
                results.push({
                    success: false,
                    returnData,
                });
                continue;
            }
            gasUsedForSuccess.push(gasUsed.toNumber());
            results.push({
                success: true,
                result: contractInterface.decodeFunctionResult(fragment, returnData),
            });
        }
        log_1.log.debug({ results, functionNames, address }, `Results for multicall for ${functionNames.length} functions at address ${address} with ${functionParams ? functionParams.length : ' 0'} different sets of params. Results as of block ${blockNumber}`);
        return {
            blockNumber,
            results,
            approxGasUsedPerSuccessCall: stats_lite_1.default.percentile(gasUsedForSuccess, 99),
        };
    }
}
exports.UniswapMulticallProvider = UniswapMulticallProvider;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXVsdGljYWxsLXVuaXN3YXAtcHJvdmlkZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvcHJvdmlkZXJzL211bHRpY2FsbC11bmlzd2FwLXByb3ZpZGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7OztBQUdBLG9EQUF1QjtBQUN2Qiw0REFBK0I7QUFHL0IsaUhBQThHO0FBQzlHLGlEQUFnRTtBQUNoRSxxQ0FBa0M7QUFFbEMsNkRBTThCO0FBTTlCOzs7Ozs7OztHQVFHO0FBQ0gsTUFBYSx3QkFBeUIsU0FBUSx1Q0FBMEM7SUFHdEYsWUFDWSxPQUFnQixFQUNoQixRQUFzQixFQUN0QixrQkFBa0IsT0FBUztRQUVyQyxLQUFLLEVBQUUsQ0FBQztRQUpFLFlBQU8sR0FBUCxPQUFPLENBQVM7UUFDaEIsYUFBUSxHQUFSLFFBQVEsQ0FBYztRQUN0QixvQkFBZSxHQUFmLGVBQWUsQ0FBWTtRQUdyQyxNQUFNLGdCQUFnQixHQUFHLHVDQUEyQixDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUVuRSxJQUFJLENBQUMsZ0JBQWdCLEVBQUU7WUFDckIsTUFBTSxJQUFJLEtBQUssQ0FDYiwwREFBMEQsT0FBTyxFQUFFLENBQ3BFLENBQUM7U0FDSDtRQUVELElBQUksQ0FBQyxpQkFBaUIsR0FBRyx1RUFBa0MsQ0FBQyxPQUFPLENBQ2pFLGdCQUFnQixFQUNoQixJQUFJLENBQUMsUUFBUSxDQUNkLENBQUM7SUFDSixDQUFDO0lBRU0sS0FBSyxDQUFDLG1DQUFtQyxDQUk5QyxNQUFrRTs7UUFLbEUsTUFBTSxFQUNKLFNBQVMsRUFDVCxpQkFBaUIsRUFDakIsWUFBWSxFQUNaLGNBQWMsRUFDZCxjQUFjLEdBQ2YsR0FBRyxNQUFNLENBQUM7UUFFWCxNQUFNLG1CQUFtQixHQUFHLE1BQUEsY0FBYyxhQUFkLGNBQWMsdUJBQWQsY0FBYyxDQUFFLFdBQVcsbUNBQUksU0FBUyxDQUFDO1FBRXJFLE1BQU0sUUFBUSxHQUFHLGlC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