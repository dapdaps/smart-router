import { CHAIN_TO_ADDRESSES_MAP, ChainId, Token } from '@uniswap/sdk-core';
import { FACTORY_ADDRESS } from '@uniswap/v3-sdk';
import { NETWORKS_WITH_SAME_UNISWAP_ADDRESSES } from './chains';
export const BNB_TICK_LENS_ADDRESS = CHAIN_TO_ADDRESSES_MAP[ChainId.BNB].tickLensAddress;
export const BNB_NONFUNGIBLE_POSITION_MANAGER_ADDRESS = CHAIN_TO_ADDRESSES_MAP[ChainId.BNB].nonfungiblePositionManagerAddress;
// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
export const BNB_SWAP_ROUTER_02_ADDRESS = CHAIN_TO_ADDRESSES_MAP[ChainId.BNB].swapRouter02Address;
export const BNB_V3_MIGRATOR_ADDRESS = CHAIN_TO_ADDRESSES_MAP[ChainId.BNB].v3MigratorAddress;
export const V3_CORE_FACTORY_ADDRESSES = {
    ...constructSameAddressMap(FACTORY_ADDRESS),
    [ChainId.CELO]: CHAIN_TO_ADDRESSES_MAP[ChainId.CELO].v3CoreFactoryAddress,
    [ChainId.CELO_ALFAJORES]: CHAIN_TO_ADDRESSES_MAP[ChainId.CELO_ALFAJORES].v3CoreFactoryAddress,
    [ChainId.OPTIMISM_GOERLI]: CHAIN_TO_ADDRESSES_MAP[ChainId.OPTIMISM_GOERLI].v3CoreFactoryAddress,
    [ChainId.SEPOLIA]: CHAIN_TO_ADDRESSES_MAP[ChainId.SEPOLIA].v3CoreFactoryAddress,
    [ChainId.ARBITRUM_GOERLI]: CHAIN_TO_ADDRESSES_MAP[ChainId.ARBITRUM_GOERLI].v3CoreFactoryAddress,
    [ChainId.BNB]: CHAIN_TO_ADDRESSES_MAP[ChainId.BNB].v3CoreFactoryAddress,
    [ChainId.AVALANCHE]: CHAIN_TO_ADDRESSES_MAP[ChainId.AVALANCHE].v3CoreFactoryAddress,
    [ChainId.BASE_GOERLI]: CHAIN_TO_ADDRESSES_MAP[ChainId.BASE_GOERLI].v3CoreFactoryAddress,
    [ChainId.BASE]: CHAIN_TO_ADDRESSES_MAP[ChainId.BASE].v3CoreFactoryAddress,
    [ChainId.Linea_GOERLI]: CHAIN_TO_ADDRESSES_MAP[ChainId.Linea_GOERLI].v3CoreFactoryAddress,
    [ChainId.LINEA]: CHAIN_TO_ADDRESSES_MAP[ChainId.LINEA].v3CoreFactoryAddress,
    [ChainId.SCROLL]: CHAIN_TO_ADDRESSES_MAP[ChainId.SCROLL].v3CoreFactoryAddress,
    // TODO: Gnosis + Moonbeam contracts to be deployed
};
export const QUOTER_V2_ADDRESSES = {
    ...constructSameAddressMap('0x61fFE014bA17989E743c5F6cB21bF9697530B21e'),
    [ChainId.CELO]: CHAIN_TO_ADDRESSES_MAP[ChainId.CELO].quoterAddress,
    [ChainId.CELO_ALFAJORES]: CHAIN_TO_ADDRESSES_MAP[ChainId.CELO_ALFAJORES].quoterAddress,
    [ChainId.OPTIMISM_GOERLI]: CHAIN_TO_ADDRESSES_MAP[ChainId.OPTIMISM_GOERLI].quoterAddress,
    [ChainId.SEPOLIA]: CHAIN_TO_ADDRESSES_MAP[ChainId.SEPOLIA].quoterAddress,
    [ChainId.ARBITRUM_GOERLI]: CHAIN_TO_ADDRESSES_MAP[ChainId.ARBITRUM_GOERLI].quoterAddress,
    [ChainId.BNB]: CHAIN_TO_ADDRESSES_MAP[ChainId.BNB].quoterAddress,
    [ChainId.AVALANCHE]: CHAIN_TO_ADDRESSES_MAP[ChainId.AVALANCHE].quoterAddress,
    [ChainId.BASE_GOERLI]: CHAIN_TO_ADDRESSES_MAP[ChainId.BASE_GOERLI].quoterAddress,
    [ChainId.BASE]: CHAIN_TO_ADDRESSES_MAP[ChainId.BASE].quoterAddress,
    [ChainId.Linea_GOERLI]: CHAIN_TO_ADDRESSES_MAP[ChainId.Linea_GOERLI].quoterAddress,
    [ChainId.LINEA]: CHAIN_TO_ADDRESSES_MAP[ChainId.LINEA].quoterAddress,
    [ChainId.SCROLL]: CHAIN_TO_ADDRESSES_MAP[ChainId.SCROLL].quoterAddress,
    // TODO: Gnosis + Moonbeam contracts to be deployed
};
export const MIXED_ROUTE_QUOTER_V1_ADDRESSES = {
    [ChainId.MAINNET]: CHAIN_TO_ADDRESSES_MAP[ChainId.MAINNET].v1MixedRouteQuoterAddress,
    [ChainId.GOERLI]: CHAIN_TO_ADDRESSES_MAP[ChainId.GOERLI].v1MixedRouteQuoterAddress,
};
export const UNISWAP_MULTICALL_ADDRESSES = {
    ...constructSameAddressMap('0x1F98415757620B543A52E61c46B32eB19261F984'),
    [ChainId.CELO]: CHAIN_TO_ADDRESSES_MAP[ChainId.CELO].multicallAddress,
    [ChainId.CELO_ALFAJORES]: CHAIN_TO_ADDRESSES_MAP[ChainId.CELO_ALFAJORES].multicallAddress,
    [ChainId.OPTIMISM_GOERLI]: CHAIN_TO_ADDRESSES_MAP[ChainId.OPTIMISM_GOERLI].multicallAddress,
    [ChainId.SEPOLIA]: CHAIN_TO_ADDRESSES_MAP[ChainId.SEPOLIA].multicallAddress,
    [ChainId.ARBITRUM_GOERLI]: CHAIN_TO_ADDRESSES_MAP[ChainId.ARBITRUM_GOERLI].multicallAddress,
    [ChainId.BNB]: CHAIN_TO_ADDRESSES_MAP[ChainId.BNB].multicallAddress,
    [ChainId.AVALANCHE]: CHAIN_TO_ADDRESSES_MAP[ChainId.AVALANCHE].multicallAddress,
    [ChainId.BASE_GOERLI]: CHAIN_TO_ADDRESSES_MAP[ChainId.BASE_GOERLI].multicallAddress,
    [ChainId.BASE]: CHAIN_TO_ADDRESSES_MAP[ChainId.BASE].multicallAddress,
    [ChainId.Linea_GOERLI]: CHAIN_TO_ADDRESSES_MAP[ChainId.Linea_GOERLI].multicallAddress,
    [ChainId.LINEA]: CHAIN_TO_ADDRESSES_MAP[ChainId.LINEA].multicallAddress,
    [ChainId.SCROLL]: CHAIN_TO_ADDRESSES_MAP[ChainId.SCROLL].multicallAddress,
    // TODO: Gnosis + Moonbeam contracts to be deployed
};
export const SWAP_ROUTER_02_ADDRESSES = (chainId) => {
    if (chainId == ChainId.BNB) {
        return BNB_SWAP_ROUTER_02_ADDRESS;
    }
    return '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45';
};
export const OVM_GASPRICE_ADDRESS = '0x420000000000000000000000000000000000000F';
export const ARB_GASINFO_ADDRESS = '0x000000000000000000000000000000000000006C';
export const TICK_LENS_ADDRESS = CHAIN_TO_ADDRESSES_MAP[ChainId.ARBITRUM_ONE].tickLensAddress;
export const NONFUNGIBLE_POSITION_MANAGER_ADDRESS = CHAIN_TO_ADDRESSES_MAP[ChainId.MAINNET].nonfungiblePositionManagerAddress;
export const V3_MIGRATOR_ADDRESS = CHAIN_TO_ADDRESSES_MAP[ChainId.MAINNET].v3MigratorAddress;
export const MULTICALL2_ADDRESS = '0x5BA1e12693Dc8F9c48aAD8770482f4739bEeD696';
export function constructSameAddressMap(address, additionalNetworks = []) {
    return NETWORKS_WITH_SAME_UNISWAP_ADDRESSES.concat(additionalNetworks).reduce((memo, chainId) => {
        memo[chainId] = address;
        return memo;
    }, {});
}
export const WETH9 = {
    [ChainId.MAINNET]: new Token(ChainId.MAINNET, '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', 18, 'WETH', 'Wrapped Ether'),
    [ChainId.GOERLI]: new Token(ChainId.GOERLI, '0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6', 18, 'WETH', 'Wrapped Ether'),
    [ChainId.SEPOLIA]: new Token(ChainId.SEPOLIA, '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14', 18, 'WETH', 'Wrapped Ether'),
    [ChainId.OPTIMISM]: new Token(ChainId.OPTIMISM, '0x4200000000000000000000000000000000000006', 18, 'WETH', 'Wrapped Ether'),
    [ChainId.OPTIMISM_GOERLI]: new Token(ChainId.OPTIMISM_GOERLI, '0x4200000000000000000000000000000000000006', 18, 'WETH', 'Wrapped Ether'),
    [ChainId.ARBITRUM_ONE]: new Token(ChainId.ARBITRUM_ONE, '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', 18, 'WETH', 'Wrapped Ether'),
    [ChainId.ARBITRUM_GOERLI]: new Token(ChainId.ARBITRUM_GOERLI, '0xe39Ab88f8A4777030A534146A9Ca3B52bd5D43A3', 18, 'WETH', 'Wrapped Ether'),
    [ChainId.BASE_GOERLI]: new Token(ChainId.BASE_GOERLI, '0x4200000000000000000000000000000000000006', 18, 'WETH', 'Wrapped Ether'),
    [ChainId.BASE]: new Token(ChainId.BASE, '0x4200000000000000000000000000000000000006', 18, 'WETH', 'Wrapped Ether'),
    [ChainId.Linea_GOERLI]: new Token(ChainId.Linea_GOERLI, '0x2C1b868d6596a18e32E61B901E4060C872647b6C', 18, 'WETH', 'Wrapped Ether'),
    [ChainId.LINEA]: new Token(ChainId.LINEA, '0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f', 18, 'WETH', 'Wrapped Ether'),
    [ChainId.SCROLL]: new Token(ChainId.SCROLL, '0x5300000000000000000000000000000000000004', 18, 'WETH', 'Wrapped Ether'),
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWRkcmVzc2VzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL3V0aWwvYWRkcmVzc2VzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxzQkFBc0IsRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sbUJBQW1CLENBQUM7QUFDM0UsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBRWxELE9BQU8sRUFBRSxvQ0FBb0MsRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUVoRSxNQUFNLENBQUMsTUFBTSxxQkFBcUIsR0FBRyxzQkFBc0IsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsZUFBZSxDQUFDO0FBQ3pGLE1BQU0sQ0FBQyxNQUFNLHdDQUF3QyxHQUFHLHNCQUFzQixDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxpQ0FBaUMsQ0FBQztBQUM5SCxvRUFBb0U7QUFDcEUsTUFBTSxDQUFDLE1BQU0sMEJBQTBCLEdBQUcsc0JBQXNCLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLG1CQUFvQixDQUFDO0FBQ25HLE1BQU0sQ0FBQyxNQUFNLHVCQUF1QixHQUFHLHNCQUFzQixDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxpQkFBaUIsQ0FBQztBQUU3RixNQUFNLENBQUMsTUFBTSx5QkFBeUIsR0FBZTtJQUNuRCxHQUFHLHVCQUF1QixDQUFDLGVBQWUsQ0FBQztJQUMzQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFBRSxzQkFBc0IsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsb0JBQW9CO0lBQ3pFLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxFQUFFLHNCQUFzQixDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsQ0FBQyxvQkFBb0I7SUFDN0YsQ0FBQyxPQUFPLENBQUMsZUFBZSxDQUFDLEVBQUUsc0JBQXNCLENBQUMsT0FBTyxDQUFDLGVBQWUsQ0FB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