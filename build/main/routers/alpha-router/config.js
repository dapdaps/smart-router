"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ETH_GAS_STATION_API_URL = exports.DEFAULT_ROUTING_CONFIG_BY_CHAIN = void 0;
const sdk_core_1 = require("@uniswap/sdk-core");
const DEFAULT_ROUTING_CONFIG_BY_CHAIN = (chainId) => {
    switch (chainId) {
        // Optimism
        case sdk_core_1.ChainId.OPTIMISM:
        case sdk_core_1.ChainId.OPTIMISM_GOERLI:
        case sdk_core_1.ChainId.BASE:
        case sdk_core_1.ChainId.BASE_GOERLI:
        case sdk_core_1.ChainId.BASE_SEPOLIA:
            return {
                v2PoolSelection: {
                    topN: 3,
                    topNDirectSwaps: 1,
                    topNTokenInOut: 5,
                    topNSecondHop: 2,
                    topNWithEachBaseToken: 2,
                    topNWithBaseToken: 6,
                },
                v3PoolSelection: {
                    topN: 2,
                    topNDirectSwaps: 2,
                    topNTokenInOut: 2,
                    topNSecondHop: 1,
                    topNWithEachBaseToken: 3,
                    topNWithBaseToken: 3,
                },
                maxSwapsPerPath: 3,
                minSplits: 1,
                maxSplits: 7,
                distributionPercent: 10,
                forceCrossProtocol: false,
            };
        // Arbitrum calls have lower gas limits and tend to timeout more, which causes us to reduce the multicall
        // batch size and send more multicalls per quote. To reduce the amount of requests each quote sends, we
        // have to adjust the routing config so we explore fewer routes.
        case sdk_core_1.ChainId.ARBITRUM_ONE:
        case sdk_core_1.ChainId.ARBITRUM_GOERLI:
        case sdk_core_1.ChainId.CELO:
        case sdk_core_1.ChainId.CELO_ALFAJORES:
            return {
                v2PoolSelection: {
                    topN: 3,
                    topNDirectSwaps: 1,
                    topNTokenInOut: 5,
                    topNSecondHop: 2,
                    topNWithEachBaseToken: 2,
                    topNWithBaseToken: 6,
                },
                v3PoolSelection: {
                    topN: 2,
                    topNDirectSwaps: 2,
                    topNTokenInOut: 2,
                    topNSecondHop: 1,
                    topNWithEachBaseToken: 3,
                    topNWithBaseToken: 2,
                },
                maxSwapsPerPath: 2,
                minSplits: 1,
                maxSplits: 7,
                distributionPercent: 25,
                forceCrossProtocol: false,
            };
        default:
            return {
                v2PoolSelection: {
                    topN: 3,
                    topNDirectSwaps: 1,
                    topNTokenInOut: 5,
                    topNSecondHop: 2,
                    topNWithEachBaseToken: 2,
                    topNWithBaseToken: 6,
                },
                v3PoolSelection: {
                    topN: 2,
                    topNDirectSwaps: 2,
                    topNTokenInOut: 3,
                    topNSecondHop: 1,
                    topNWithEachBaseToken: 3,
                    topNWithBaseToken: 5,
                },
                maxSwapsPerPath: 3,
                minSplits: 1,
                maxSplits: 7,
                distributionPercent: 5,
                forceCrossProtocol: false,
            };
    }
};
exports.DEFAULT_ROUTING_CONFIG_BY_CHAIN = DEFAULT_ROUTING_CONFIG_BY_CHAIN;
exports.ETH_GAS_STATION_API_URL = 'https://ethgasstation.info/api/ethgasAPI.json';
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uZmlnLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3JvdXRlcnMvYWxwaGEtcm91dGVyL2NvbmZpZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxnREFBNEM7QUFJckMsTUFBTSwrQkFBK0IsR0FBRyxDQUM3QyxPQUFnQixFQUNHLEVBQUU7SUFDckIsUUFBUSxPQUFPLEVBQUU7UUFDZixXQUFXO1FBQ1gsS0FBSyxrQkFBTyxDQUFDLFFBQVEsQ0FBQztRQUN0QixLQUFLLGtCQUFPLENBQUMsZUFBZSxDQUFDO1FBQzdCLEtBQUssa0JBQU8sQ0FBQyxJQUFJLENBQUM7UUFDbEIsS0FBSyxrQkFBTyxDQUFDLFdBQVcsQ0FBQztRQUN6QixLQUFLLGtCQUFPLENBQUMsWUFBWTtZQUN2QixPQUFPO2dCQUNMLGVBQWUsRUFBRTtvQkFDZixJQUFJLEVBQUUsQ0FBQztvQkFDUCxlQUFlLEVBQUUsQ0FBQztvQkFDbEIsY0FBYyxFQUFFLENBQUM7b0JBQ2pCLGFBQWEsRUFBRSxDQUFDO29CQUNoQixxQkFBcUIsRUFBRSxDQUFDO29CQUN4QixpQkFBaUIsRUFBRSxDQUFDO2lCQUNyQjtnQkFDRCxlQUFlLEVBQUU7b0JBQ2YsSUFBSSxFQUFFLENBQUM7b0JBQ1AsZUFBZSxFQUFFLENBQUM7b0JBQ2xCLGNBQWMsRUFBRSxDQUFDO29CQUNqQixhQUFhLEVBQUUsQ0FBQztvQkFDaEIscUJBQXFCLEVBQUUsQ0FBQztvQkFDeEIsaUJBQWlCLEVBQUUsQ0FBQztpQkFDckI7Z0JBQ0QsZUFBZSxFQUFFLENBQUM7Z0JBQ2xCLFNBQVMsRUFBRSxDQUFDO2dCQUNaLFNBQVMsRUFBRSxDQUFDO2dCQUNaLG1CQUFtQixFQUFFLEVBQUU7Z0JBQ3ZCLGtCQUFrQixFQUFFLEtBQUs7YUFDMUIsQ0FBQztRQUNKLHlHQUF5RztRQUN6Ryx1R0FBdUc7UUFDdkcsZ0VBQWdFO1FBQ2hFLEtBQUssa0JBQU8sQ0FBQyxZQUFZLENBQUM7UUFDMUIsS0FBSyxrQkFBTyxDQUFDLGVBQWUsQ0FBQztRQUM3QixLQUFLLGtCQUFPLENBQUMsSUFBSSxDQUFDO1FBQ2xCLEtBQUssa0JBQU8sQ0FBQyxjQUFjO1lBQ3pCLE9BQU87Z0JBQ0wsZUFBZSxFQUFFO29CQUNmLElBQUksRUFBRSxDQUFDO29CQUNQLGVBQWUsRUFBRSxDQUFDO29CQUNsQixjQUFjLEVBQUUsQ0FBQztvQkFDakIsYUFBYSxFQUFFLENBQUM7b0JBQ2hCLHFCQUFxQixFQUFFLENBQUM7b0JBQ3hCLGlCQUFpQixFQUFFLENBQUM7aUJBQ3JCO2dCQUNELGVBQWUsRUFBRTtvQkFDZixJQUFJLEVBQUUsQ0FBQztvQkFDUCxlQUFlLEVBQUUsQ0FBQztvQkFDbEIsY0FBYyxFQUFFLENBQUM7b0JBQ2pCLGFBQWEsRUFBRSxDQUFDO29CQUNoQixxQkFBcUIsRUFBRSxDQUFDO29CQUN4QixpQkFBaUIsRUFBRSxDQUFDO2lCQUNyQjtnQkFDRCxlQUFlLEVBQUUsQ0FBQztnQkFDbEIsU0FBUyxFQUFFLENBQUM7Z0JBQ1osU0FBUyxFQUFFLENBQUM7Z0JBQ1osbUJBQW1CLEVBQUUsRUFBRTtnQkFDdkIsa0JBQWtCLEVBQUUsS0FBSzthQUMxQixDQUFDO1FBQ0o7WUFDRSxPQUFPO2dCQUNMLGVBQWUsRUFBRTtvQkFDZixJQUFJLEVBQUUsQ0FBQztvQkFDUCxlQUFlLEVBQUUsQ0FBQztvQkFDbEIsY0FBYyxFQUFFLENBQUM7b0JBQ2pCLGFBQWEsRUFBRSxDQUFDO29CQUNoQixxQkFBcUIsRUFBRSxDQUFDO29CQUN4QixpQkFBaUIsRUFBRSxDQUFDO2lCQUNyQjtnQkFDRCxlQUFlLEVBQUU7b0JBQ2YsSUFBSSxFQUFFLENBQUM7b0JBQ1AsZUFBZSxFQUFFLENBQUM7b0JBQ2xCLGNBQWMsRUFBRSxDQUFDO29CQUNqQixhQUFhLEVBQUUsQ0FBQztvQkFDaEIscUJBQXFCLEVBQUUsQ0FBQztvQkFDeEIsaUJBQWlCLEVBQUUsQ0FBQztpQkFDckI7Z0JBQ0QsZUFBZSxFQUFFLENBQUM7Z0JBQ2xCLFNBQVMsRUFBRSxDQUFDO2dCQUNaLFNBQVMsRUFBRSxDQUFDO2dCQUNaLG1CQUFtQixFQUFFLENBQUM7Z0JBQ3RCLGtCQUFrQixFQUFFLEtBQUs7YUFDMUIsQ0FBQztLQUNMO0FBQ0gsQ0FBQyxDQUFDO0FBeEZXLFFBQUEsK0JBQStCLG1DQXdGMUM7QUFDVyxRQUFBLHVCQUF1QixHQUNsQywrQ0FBK0MsQ0FBQyJ9