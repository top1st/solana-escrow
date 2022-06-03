import { Connection, Keypair, PublicKey } from '@solana/web3.js'
import { writeFileSync, readFileSync } from 'fs'
import * as BufferLayout from '@solana/buffer-layout'

export const writePublicKey = (publicKey: PublicKey, name: string) => {
    writeFileSync(
        `./keys/${name}_pub.json`,
        JSON.stringify(publicKey.toString())
    )
}

export const getPublicKey = (name: string) =>
    new PublicKey(
        JSON.parse(readFileSync(`./keys/${name}_pub.json`) as unknown as string)
    )

export const getPrivateKey = (name: string) =>
    Uint8Array.from(
        JSON.parse(readFileSync(`./keys/${name}.json`) as unknown as string)
    )

export const getKeypair = (name: string) =>
    new Keypair({
        publicKey: getPublicKey(name).toBytes(),
        secretKey: getPrivateKey(name),
    })

export const getProgramId = () => {
    try {
        return getPublicKey('program')
    } catch (e) {
        console.error('Given programId is missing or incorrect')
        process.exit(1)
    }
}

export const getTokenBalance = async (
    pubkey: PublicKey,
    connection: Connection
) => {
    return (await connection.getTokenAccountBalance(pubkey)).value.uiAmount
}

export const getTerms = (): {
    aliceExpectedAmount: number
    bobExpectedAmount: number
} => {
    return JSON.parse(readFileSync(`./terms.json`) as unknown as string)
}

export interface EscrowLayout {
    isInitialized: number
    initializerPubkey: Uint8Array
    tempTokenAccountPubkey: Uint8Array
    initializerTokenReceveAccountPubkey: Uint8Array
    expectedAmount: Uint8Array
}

// export const ESCROW_ACCOUNT_DATA_LAYOUT =  BufferLayout.struct<EscrowLayout>([BufferLayout.u8("isInitialized"), publicKey])
