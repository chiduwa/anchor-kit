/**
 * Every public address each dapp has ever anchored from. Verify pages search all
 * of them, so a record stays verifiable after a key rotation. Add a new entry and
 * set `to` on the old one when rotating; never delete an entry.
 *
 * twg-creds is the ThriveWorks issuer: Kwame's Pera Wallet account (gate G5 on MainNet).
 */
export const ANCHOR_ADDRESSES = {
    'fcs-signals': {
        testnet: [{ address: 'GQWTEXM65LYXWZA5MHFOPBQ73D32Y27JFYQPWDEGZDQ3JRZLLNTVILDIKY', from: '2026-10-16', to: null }],
        mainnet: [],
    },
    'kce-handover': {
        testnet: [{ address: 'GOJHOLZY77OBH552BABZZKMSMJIF3FLLZN6E6XAPBKPMH7MYSL72LMD4L4', from: '2026-10-16', to: null }],
        mainnet: [],
    },
    'kce-books': {
        testnet: [{ address: 'A5COSBQR2XMSO2HN2FGQFW3POCAEHP3OQ5GZNEBXHLVAINAUO7EWNBDPMA', from: '2026-10-16', to: null }],
        mainnet: [],
    },
    'twg-creds': { testnet: [], mainnet: [] },
};
export function addressesFor(dapp, network) {
    return ANCHOR_ADDRESSES[dapp][network].map((entry) => entry.address);
}
export function activeAddress(dapp, network) {
    return ANCHOR_ADDRESSES[dapp][network].find((entry) => entry.to === null)?.address ?? null;
}
