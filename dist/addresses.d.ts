import type { Dapp } from './note.js';
import type { Network } from './network.js';
export interface AnchorAddress {
    address: string;
    /** First day (UTC, YYYY-MM-DD) this address anchored. */
    from: string;
    /** Last day it anchored, or null while it is the active key. */
    to: string | null;
}
/**
 * Every public address each dapp has ever anchored from. Verify pages search all
 * of them, so a record stays verifiable after a key rotation. Add a new entry and
 * set `to` on the old one when rotating; never delete an entry.
 *
 * twg-creds is the ThriveWorks issuer: Kwame's Pera Wallet account (gate G5 on MainNet).
 */
export declare const ANCHOR_ADDRESSES: Record<Dapp, Record<Network, AnchorAddress[]>>;
export declare function addressesFor(dapp: Dapp, network: Network): string[];
export declare function activeAddress(dapp: Dapp, network: Network): string | null;
