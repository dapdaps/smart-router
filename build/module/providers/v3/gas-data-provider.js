import { ChainId } from '@uniswap/sdk-core';
import { GasDataArbitrum__factory } from '../../types/other/factories/GasDataArbitrum__factory';
import { GasPriceOracle__factory } from '../../types/other/factories/GasPriceOracle__factory';
import { ARB_GASINFO_ADDRESS, log, OVM_GASPRICE_ADDRESS, } from '../../util';
export class OptimismGasDataProvider {
    constructor(chainId, multicall2Provider, gasPriceAddress) {
        this.chainId = chainId;
        this.multicall2Provider = multicall2Provider;
        if (chainId !== ChainId.OPTIMISM && chainId !== ChainId.BASE) {
            throw new Error('This data provider is used only on optimism networks.');
        }
        this.gasOracleAddress = gasPriceAddress !== null && gasPriceAddress !== void 0 ? gasPriceAddress : OVM_GASPRICE_ADDRESS;
    }
    /**
     * Gets the data constants needed to calculate the l1 security fee on Optimism.
     * @returns An OptimismGasData object that includes the l1BaseFee,
     * scalar, decimals, and overhead values.
     */
    async getGasData() {
        var _a, _b, _c, _d;
        const funcNames = ['l1BaseFee', 'scalar', 'decimals', 'overhead'];
        const tx = await this.multicall2Provider.callMultipleFunctionsOnSameContract({
            address: this.gasOracleAddress,
            contractInterface: GasPriceOracle__factory.createInterface(),
            functionNames: funcNames,
        });
        if (!((_a = tx.results[0]) === null || _a === void 0 ? void 0 : _a.success) ||
            !((_b = tx.results[1]) === null || _b === void 0 ? void 0 : _b.success) ||
            !((_c = tx.results[2]) === null || _c === void 0 ? void 0 : _c.success) ||
            !((_d = tx.results[3]) === null || _d === void 0 ? void 0 : _d.success)) {
            log.info({ results: tx.results }, 'Failed to get gas constants data from the optimism gas oracle');
            throw new Error('Failed to get gas constants data from the optimism gas oracle');
        }
        const { result: l1BaseFee } = tx.results[0];
        const { result: scalar } = tx.results[1];
        const { result: decimals } = tx.results[2];
        const { result: overhead } = tx.results[3];
        return {
            l1BaseFee: l1BaseFee[0],
            scalar: scalar[0],
            decimals: decimals[0],
            overhead: overhead[0],
        };
    }
}
export class ArbitrumGasDataProvider {
    constructor(chainId, provider, gasDataAddress) {
        this.chainId = chainId;
        this.provider = provider;
        this.gasFeesAddress = gasDataAddress ? gasDataAddress : ARB_GASINFO_ADDRESS;
    }
    async getGasData() {
        const gasDataContract = GasDataArbitrum__factory.connect(this.gasFeesAddress, this.provider);
        const gasData = await gasDataContract.getPricesInWei();
        return {
            perL2TxFee: gasData[0],
            perL1CalldataFee: gasData[1],
            perArbGasTotal: gasData[5],
        };
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2FzLWRhdGEtcHJvdmlkZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvcHJvdmlkZXJzL3YzL2dhcy1kYXRhLXByb3ZpZGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUVBLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxtQkFBbUIsQ0FBQztBQUU1QyxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUNoRyxPQUFPLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSxxREFBcUQsQ0FBQztBQUM5RixPQUFPLEVBQUUsbUJBQW1CLEVBQUUsR0FBRyxFQUFFLG9CQUFvQixHQUFHLE1BQU0sWUFBWSxDQUFDO0FBd0I3RSxNQUFNLE9BQU8sdUJBQXVCO0lBSWxDLFlBQ1ksT0FBZ0IsRUFDaEIsa0JBQXNDLEVBQ2hELGVBQXdCO1FBRmQsWUFBTyxHQUFQLE9BQU8sQ0FBUztRQUNoQix1QkFBa0IsR0FBbEIsa0JBQWtCLENBQW9CO1FBR2hELElBQUksT0FBTyxLQUFLLE9BQU8sQ0FBQyxRQUFRLElBQUksT0FBTyxLQUFLLE9BQU8sQ0FBQyxJQUFJLEVBQUU7WUFDNUQsTUFBTSxJQUFJLEtBQUssQ0FBQyx1REFBdUQsQ0FBQyxDQUFDO1NBQzFFO1FBQ0QsSUFBSSxDQUFDLGdCQUFnQixHQUFHLGVBQWUsYUFBZixlQUFlLGNBQWYsZUFBZSxHQUFJLG9CQUFvQixDQUFDO0lBQ2xFLENBQUM7SUFFRDs7OztPQUlHO0lBQ0ksS0FBSyxDQUFDLFVBQVU7O1FBQ3JCLE1BQU0sU0FBUyxHQUFHLENBQUMsV0FBVyxFQUFFLFFBQVEsRUFBRSxVQUFVLEVBQUUsVUFBVSxDQUFDLENBQUM7UUFDbEUsTUFBTSxFQUFFLEdBQ04sTUFBTSxJQUFJLENBQUMsa0JBQWtCLENBQUMsbUNBQW1DLENBRy9EO1lBQ0EsT0FBTyxFQUFFLElBQUksQ0FBQyxnQkFBZ0I7WUFDOUIsaUJBQWlCLEVBQUUsdUJBQXVCLENBQUMsZUFBZSxFQUFFO1lBQzVELGFBQWEsRUFBRSxTQUFTO1NBQ3pCLENBQUMsQ0FBQztRQUVMLElBQ0UsQ0FBQyxDQUFBLE1BQUEsRUFBRSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsMENBQUUsT0FBTyxDQUFBO1lBQ3ZCLENBQUMsQ0FBQSxNQUFBLEVBQUUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLDBDQUFFLE9BQU8sQ0FBQTtZQUN2QixDQUFDLENBQUEsTUFBQSxFQUFFLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQywwQ0FBRSxPQUFPLENBQUE7WUFDdkIsQ0FBQyxDQUFBLE1BQUEsRUFBRSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsMENBQUUsT0FBTyxDQUFBLEVBQ3ZCO1lBQ0EsR0FBRyxDQUFDLElBQUksQ0FDTixFQUFFLE9BQU8sRUFBRSxFQUFFLENBQUMsT0FBTyxFQUFFLEVBQ3ZCLCtEQUErRCxDQUNoRSxDQUFDO1lBQ0YsTUFBTSxJQUFJLEtBQUssQ0FDYiwrREFBK0QsQ0FDaEUsQ0FBQztTQUNIO1FBRUQsTUFBTSxFQUFFLE1BQU0sRUFBRSxTQUFTLEVBQUUsR0FBRyxFQUFFLENBQUMsT0FBUSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzdDLE1BQU0sRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLEdBQUcsRUFBRSxDQUFDLE9BQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUMxQyxNQUFNLEVBQUUsTUFBTSxFQUFFLFFBQVEsRUFBRSxHQUFHLEVBQUUsQ0FBQyxPQUFRLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDNUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQUUsR0FBRyxFQUFFLENBQUMsT0FBUSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRTVDLE9BQU87WUFDTCxTQUFTLEVBQUUsU0FBUyxDQUFDLENBQUMsQ0FBQztZQUN2QixNQUFNLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQztZQUNqQixRQUFRLEVBQUUsUUFBUSxDQUFDLENBQUMsQ0FBQztZQUNyQixRQUFRLEVBQUUsUUFBUSxDQUFDLENBQUMsQ0FBQztTQUN0QixDQUFDO0lBQ0osQ0FBQztDQUNGO0FBYUQsTUFBTSxPQUFPLHVCQUF1QjtJQUtsQyxZQUNZLE9BQWdCLEVBQ2hCLFFBQXNCLEVBQ2hDLGNBQXVCO1FBRmIsWUFBTyxHQUFQLE9BQU8sQ0FBUztRQUNoQixhQUFRLEdBQVIsUUFBUSxDQUFjO1FBR2hDLElBQUksQ0FBQyxjQUFjLEdBQUcsY0FBYyxDQUFDLENBQUMsQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLG1CQUFtQixDQUFDO0lBQzlFLENBQUM7SUFFTSxLQUFLLENBQUMsVUFBVTtRQUNyQixNQUFNLGVBQWUsR0FBRyx3QkFBd0IsQ0FBQyxPQUFPLENBQ3RELElBQUksQ0FBQyxjQUFjLEVBQ25CLElBQUksQ0FBQyxRQUFRLENBQ2QsQ0FBQztRQUNGLE1BQU0sT0FBTyxHQUFHLE1BQU0sZUFBZSxDQUFDLGNBQWMsRUFBRSxDQUFDO1FBQ3ZELE9BQU87WUFDTCxVQUFVLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQztZQUN0QixnQkFBZ0IsRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDO1lBQzVCLGNBQWMsRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDO1NBQzNCLENBQUM7SUFDSixDQUFDO0NBQ0YifQ==