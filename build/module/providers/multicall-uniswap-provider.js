import _ from 'lodash';
import stats from 'stats-lite';
import { UniswapInterfaceMulticall__factory } from '../types/v3/factories/UniswapInterfaceMulticall__factory';
import { UNISWAP_MULTICALL_ADDRESSES } from '../util/addresses';
import { log } from '../util/log';
import { IMulticallProvider, } from './multicall-provider';
/**
 * The UniswapMulticall contract has added functionality for limiting the amount of gas
 * that each call within the multicall can consume. This is useful for operations where
 * a call could consume such a large amount of gas that it causes the node to error out
 * with an out of gas error.
 *
 * @export
 * @class UniswapMulticallProvider
 */
export class UniswapMulticallProvider extends IMulticallProvider {
    constructor(chainId, provider, gasLimitPerCall = 1000000) {
        super();
        this.chainId = chainId;
        this.provider = provider;
        this.gasLimitPerCall = gasLimitPerCall;
        const multicallAddress = UNISWAP_MULTICALL_ADDRESSES[this.chainId];
        if (!multicallAddress) {
            throw new Error(`No address for Uniswap Multicall Contract on chain id: ${chainId}`);
        }
        this.multicallContract = UniswapInterfaceMulticall__factory.connect(multicallAddress, this.provider);
    }
    async callSameFunctionOnMultipleContracts(params) {
        var _a;
        const { addresses, contractInterface, functionName, functionParams, providerConfig, } = params;
        const blockNumberOverride = (_a = providerConfig === null || providerConfig === void 0 ? void 0 : providerConfig.blockNumber) !== null && _a !== void 0 ? _a : undefined;
        const fragment = contractInterface.getFunction(functionName);
        const callData = contractInterface.encodeFunctionData(fragment, functionParams);
        const calls = _.map(addresses, (address) => {
            return {
                target: address,
                callData,
                gasLimit: this.gasLimitPerCall,
            };
        });
        log.debug({ calls }, `About to multicall for ${functionName} across ${addresses.length} addresses`);
        const { blockNumber, returnData: aggregateResults } = await this.multicallContract.callStatic.multicall(calls, {
            blockTag: blockNumberOverride,
        });
        const results = [];
        for (let i = 0; i < aggregateResults.length; i++) {
            const { success, returnData } = aggregateResults[i];
            // Return data "0x" is sometimes returned for invalid calls.
            if (!success || returnData.length <= 2) {
                log.debug({ result: aggregateResults[i] }, `Invalid result calling ${functionName} on address ${addresses[i]}`);
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
        log.debug({ results }, `Results for multicall on ${functionName} across ${addresses.length} addresses as of block ${blockNumber}`);
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
        const calls = _.map(functionParams, (functionParam) => {
            const callData = contractInterface.encodeFunctionData(fragment, functionParam);
            return {
                target: address,
                callData,
                gasLimit: gasLimitPerCall,
            };
        });
        //console.log("calls: " + JSON.stringify(calls))
        log.debug({ calls }, `About to multicall for ${functionName} at address ${address} with ${functionParams.length} different sets of params`);
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
            approxGasUsedPerSuccessCall: stats.percentile(gasUsedForSuccess, 99),
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
        const calls = _.map(functionNames, (functionName, i) => {
            const fragment = contractInterface.getFunction(functionName);
            const param = functionParams ? functionParams[i] : [];
            const callData = contractInterface.encodeFunctionData(fragment, param);
            return {
                target: address,
                callData,
                gasLimit: gasLimitPerCall,
            };
        });
        log.debug({ calls }, `About to multicall for ${functionNames.length} functions at address ${address} with ${functionParams === null || functionParams === void 0 ? void 0 : functionParams.length} different sets of params`);
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
                log.debug({ result: aggregateResults[i] }, `Invalid result calling ${functionNames[i]} with ${functionParams ? functionParams[i] : '0'} params`);
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
        log.debug({ results, functionNames, address }, `Results for multicall for ${functionNames.length} functions at address ${address} with ${functionParams ? functionParams.length : ' 0'} different sets of params. Results as of block ${blockNumber}`);
        return {
            blockNumber,
            results,
            approxGasUsedPerSuccessCall: stats.percentile(gasUsedForSuccess, 99),
        };
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXVsdGljYWxsLXVuaXN3YXAtcHJvdmlkZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvcHJvdmlkZXJzL211bHRpY2FsbC11bmlzd2FwLXByb3ZpZGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUdBLE9BQU8sQ0FBQyxNQUFNLFFBQVEsQ0FBQztBQUN2QixPQUFPLEtBQUssTUFBTSxZQUFZLENBQUM7QUFHL0IsT0FBTyxFQUFFLGtDQUFrQyxFQUFFLE1BQU0sMERBQTBELENBQUM7QUFDOUcsT0FBTyxFQUFFLDJCQUEyQixFQUFFLE1BQU0sbUJBQW1CLENBQUM7QUFDaEUsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLGFBQWEsQ0FBQztBQUVsQyxPQUFPLEVBSUwsa0JBQWtCLEdBRW5CLE1BQU0sc0JBQXNCLENBQUM7QUFNOUI7Ozs7Ozs7O0dBUUc7QUFDSCxNQUFNLE9BQU8sd0JBQXlCLFNBQVEsa0JBQTBDO0lBR3RGLFlBQ1ksT0FBZ0IsRUFDaEIsUUFBc0IsRUFDdEIsa0JBQWtCLE9BQVM7UUFFckMsS0FBSyxFQUFFLENBQUM7UUFKRSxZQUFPLEdBQVAsT0FBTyxDQUFTO1FBQ2hCLGFBQVEsR0FBUixRQUFRLENBQWM7UUFDdEIsb0JBQWUsR0FBZixlQUFlLENBQVk7UUFHckMsTUFBTSxnQkFBZ0IsR0FBRywyQkFBMkIsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7UUFFbkUsSUFBSSxDQUFDLGdCQUFnQixFQUFFO1lBQ3JCLE1BQU0sSUFBSSxLQUFLLENBQ2IsMERBQTBELE9BQU8sRUFBRSxDQUNwRSxDQUFDO1NBQ0g7UUFFRCxJQUFJLENBQUMsaUJBQWlCLEdBQUcsa0NBQWtDLENBQUMsT0FBTyxDQUNqRSxnQkFBZ0IsRUFDaEIsSUFBSSxDQUFDLFFBQVEsQ0FDZCxDQUFDO0lBQ0osQ0FBQztJQUVNLEtBQUssQ0FBQyxtQ0FBbUMsQ0FJOUMsTUFBa0U7O1FBS2xFLE1BQU0sRUFDSixTQUFTLEVBQ1Qs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