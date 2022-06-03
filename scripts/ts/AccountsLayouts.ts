import { PublicKey } from "@solana/web3.js";
import { struct, u32, u8,  } from '@solana/buffer-layout';
import { publicKey, u64, bool } from '@solana/buffer-layout-utils';

export interface EscrowState {
    isInitialized: boolean;
    initializerPubkey: PublicKey;
    tempTokenAccountPubkey: PublicKey;
    initialzierTokenReceiveAccountPubkey: PublicKey;
    expectedAmount: bigint
}

export const EscrowAccountLayout = struct<EscrowState>([
    bool("isInitialized"),
    publicKey("initializerPubkey"),
    publicKey("tempTokenAccountPubkey"),
    publicKey("initialzierTokenReceiveAccountPubkey"),
    u64("expectedAmount")
])
