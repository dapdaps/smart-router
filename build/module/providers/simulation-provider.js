import { TradeType } from '@uniswap/sdk-core';
import { PERMIT2_ADDRESS } from '@uniswap/universal-router-sdk';
import { BigNumber } from 'ethers/lib/ethers';
import { SwapType } from '../routers';
import { Erc20__factory } from '../types/other/factories/Erc20__factory';
import { Permit2__factory } from '../types/other/factories/Permit2__factory';
import { log, SWAP_ROUTER_02_ADDRESSES, } from '../util';
export var SimulationStatus;
(function (SimulationStatus) {
    SimulationStatus[SimulationStatus["NotSupported"] = 0] = "NotSupported";
    SimulationStatus[SimulationStatus["Failed"] = 1] = "Failed";
    SimulationStatus[SimulationStatus["Succeeded"] = 2] = "Succeeded";
    SimulationStatus[SimulationStatus["InsufficientBalance"] = 3] = "InsufficientBalance";
    SimulationStatus[SimulationStatus["NotApproved"] = 4] = "NotApproved";
})(SimulationStatus || (SimulationStatus = {}));
/**
 * Provider for dry running transactions.
 *
 * @export
 * @class Simulator
 */
export class Simulator {
    /**
     * Returns a new SwapRoute with simulated gas estimates
     * @returns SwapRoute
     */
    constructor(provider, portionProvider, chainId) {
        this.chainId = chainId;
        this.provider = provider;
        this.portionProvider = portionProvider;
    }
    async simulate(fromAddress, swapOptions, swapRoute, amount, quote, l2GasData, providerConfig) {
        if (await this.userHasSufficientBalance(fromAddress, swapRoute.trade.tradeType, amount, quote)) {
            log.info('User has sufficient balance to simulate. Simulating transaction.');
            try {
                return this.simulateTransaction(fromAddress, swapOptions, swapRoute, l2GasData, providerConfig);
            }
            catch (e) {
                log.error({ e }, 'Error simulating transaction');
                return {
                    ...swapRoute,
                    simulationStatus: SimulationStatus.Failed,
                };
            }
        }
        else {
            log.error('User does not have sufficient balance to simulate.');
            return {
                ...swapRoute,
                simulationStatus: SimulationStatus.InsufficientBalance,
            };
        }
    }
    async userHasSufficientBalance(fromAddress, tradeType, amount, quote) {
        try {
            const neededBalance = tradeType == TradeType.EXACT_INPUT ? amount : quote;
            let balance;
            if (neededBalance.currency.isNative) {
                balance = await this.provider.getBalance(fromAddress);
            }
            else {
                const tokenContract = Erc20__factory.connect(neededBalance.currency.address, this.provider);
                balance = await tokenContract.balanceOf(fromAddress);
            }
            const hasBalance = balance.gte(BigNumber.from(neededBalance.quotient.toString()));
            log.info({
                fromAddress,
                balance: balance.toString(),
                neededBalance: neededBalance.quotient.toString(),
                neededAddress: neededBalance.wrapped.currency.address,
                hasBalance,
            }, 'Result of balance check for simulation');
            return hasBalance;
        }
        catch (e) {
            log.error(e, 'Error while checking user balance');
            return false;
        }
    }
    async checkTokenApproved(fromAddress, inputAmount, swapOptions, provider) {
        // Check token has approved Permit2 more than expected amount.
        const tokenContract = Erc20__factory.connect(inputAmount.currency.wrapped.address, provider);
        if (swapOptions.type == SwapType.UNIVERSAL_ROUTER) {
            const permit2Allowance = await tokenContract.allowance(fromAddress, PERMIT2_ADDRESS);
            // If a permit has been provided we don't need to check if UR has already been allowed.
            if (swapOptions.inputTokenPermit) {
                log.info({
                    permitAllowance: permit2Allowance.toString(),
                    inputAmount: inputAmount.quotient.toString(),
                }, 'Permit was provided for simulation on UR, checking that Permit2 has been approved.');
                return permit2Allowance.gte(BigNumber.from(inputAmount.quotient.toString()));
            }
            // Check UR has been approved from Permit2.
            const permit2Contract = Permit2__factory.connect(PERMIT2_ADDRESS, provider);
            const { amount: universalRouterAllowance, expiration: tokenExpiration } = await permit2Contract.allowance(fromAddress, inputAmount.currency.wrapped.address, SWAP_ROUTER_02_ADDRESSES(this.chainId));
            const nowTimestampS = Math.round(Date.now() / 1000);
            const inputAmountBN = BigNumber.from(inputAmount.quotient.toString());
            const permit2Approved = permit2Allowance.gte(inputAmountBN);
            const universalRouterApproved = universalRouterAllowance.gte(inputAmountBN);
            const expirationValid = tokenExpiration > nowTimestampS;
            log.info({
                permitAllowance: permit2Allowance.toString(),
                tokenAllowance: universalRouterAllowance.toString(),
                tokenExpirationS: tokenExpiration,
                nowTimestampS,
                inputAmount: inputAmount.quotient.toString(),
                permit2Approved,
                universalRouterApproved,
                expirationValid,
            }, `Simulating on UR, Permit2 approved: ${permit2Approved}, UR approved: ${universalRouterApproved}, Expiraton valid: ${expirationValid}.`);
            return permit2Approved && universalRouterApproved && expirationValid;
        }
        else if (swapOptions.type == SwapType.SWAP_ROUTER_02) {
            if (swapOptions.inputTokenPermit) {
                log.info({
                    inputAmount: inputAmount.quotient.toString(),
                }, 'Simulating on SwapRouter02 info - Permit was provided for simulation. Not checking allowances.');
                return true;
            }
            const allowance = await tokenContract.allowance(fromAddress, SWAP_ROUTER_02_ADDRESSES(this.chainId));
            const hasAllowance = allowance.gte(BigNumber.from(inputAmount.quotient.toString()));
            log.info({
                hasAllowance,
                allowance: allowance.toString(),
                inputAmount: inputAmount.quotient.toString(),
            }, `Simulating on SwapRouter02 - Has allowance: ${hasAllowance}`);
            // Return true if token allowance is greater than input amount
            return hasAllowance;
        }
        throw new Error(`Unsupported swap type ${swapOptions}`);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2ltdWxhdGlvbi1wcm92aWRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9wcm92aWRlcnMvc2ltdWxhdGlvbi1wcm92aWRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFDQSxPQUFPLEVBQVcsU0FBUyxFQUFFLE1BQU0sbUJBQW1CLENBQUM7QUFDdkQsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQ2hFLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxtQkFBbUIsQ0FBQztBQUU5QyxPQUFPLEVBQTBCLFFBQVEsRUFBRSxNQUFNLFlBQVksQ0FBQztBQUM5RCxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDekUsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDN0UsT0FBTyxFQUVMLEdBQUcsRUFDSCx3QkFBd0IsR0FDekIsTUFBTSxTQUFTLENBQUM7QUFXakIsTUFBTSxDQUFOLElBQVksZ0JBTVg7QUFORCxXQUFZLGdCQUFnQjtJQUMxQix1RUFBZ0IsQ0FBQTtJQUNoQiwyREFBVSxDQUFBO0lBQ1YsaUVBQWEsQ0FBQTtJQUNiLHFGQUF1QixDQUFBO0lBQ3ZCLHFFQUFlLENBQUE7QUFDakIsQ0FBQyxFQU5XLGdCQUFnQixLQUFoQixnQkFBZ0IsUUFNM0I7QUFFRDs7Ozs7R0FLRztBQUNILE1BQU0sT0FBZ0IsU0FBUztJQUk3Qjs7O09BR0c7SUFDSCxZQUFZLFFBQXlCLEVBQUUsZUFBaUMsRUFBWSxPQUFnQjtRQUFoQixZQUFPLEdBQVAsT0FBTyxDQUFTO1FBQ2xHLElBQUksQ0FBQyxRQUFRLEdBQUcsUUFBUSxDQUFDO1FBQ3pCLElBQUksQ0FBQyxlQUFlLEdBQUcsZUFBZSxDQUFDO0lBQ3pDLENBQUM7SUFFTSxLQUFLLENBQUMsUUFBUSxDQUNuQixXQUFtQixFQUNuQixXQUF3QixFQUN4QixTQUFvQixFQUNwQixNQUFzQixFQUN0QixLQUFx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