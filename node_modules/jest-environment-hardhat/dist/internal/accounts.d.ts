import { ExternallyOwnedAccount } from '@ethersproject/abstract-signer';
import { HardhatNetworkAccountsConfig } from 'hardhat/types';
/** Derives ExternallyOwnedAccounts (ie private keys and addresses) from a hardhat accounts configuration. */
export declare function toExternallyOwnedAccounts(accounts: HardhatNetworkAccountsConfig): ExternallyOwnedAccount[];
