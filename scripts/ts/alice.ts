import {
    PublicKey,
    Connection,
    Keypair,
    SystemProgram,
    TransactionInstruction,
    SYSVAR_RENT_PUBKEY,
    Transaction,
} from '@solana/web3.js'
import * as spl_token from '@solana/spl-token'
import { AccountLayout, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import BN from 'bn.js'

import {
    getKeypair,
    getProgramId,
    getPublicKey,
    getTerms,
    getTokenBalance,
    writePublicKey,
} from './utils'
import { EscrowAccountLayout } from './AccountsLayouts'

const alice = async () => {
    const connection = new Connection('http://localhost:8899', 'confirmed')
    const terms = getTerms()
    const escrowProgramId = getProgramId()

    const aliceXTokenAccountPubkey = getPublicKey('alice_x')
    const aliceYTokenAccountPubkey = getPublicKey('alice_y')
    const XTokenMintPubkey = getPublicKey('mint_x')
    const aliceKeypair = getKeypair('alice')

    // const aliceXAccount = await spl_token.getAccount(
    //     connection,
    //     aliceXTokenAccountPubkey
    // )

    const tempXTokenAccountKeyPair = new Keypair()
    // const aliceX2Account = await spl_token.createAccount(connection, aliceKeypair, XTokenMintPubkey, aliceKeypair.publicKey, tempXTokenAccountKeyPair)
    const createTempTokenAccountIx = SystemProgram.createAccount({
        programId: TOKEN_PROGRAM_ID,
        space: AccountLayout.span,
        lamports: await connection.getMinimumBalanceForRentExemption(
            AccountLayout.span
        ),
        fromPubkey: aliceKeypair.publicKey,
        newAccountPubkey: tempXTokenAccountKeyPair.publicKey,
    })

    const initTempAccountIx = spl_token.createInitializeAccountInstruction(
        tempXTokenAccountKeyPair.publicKey,
        XTokenMintPubkey,
        aliceKeypair.publicKey
    )

    const transferXTokensToTempAccIx = spl_token.createTransferInstruction(
        aliceXTokenAccountPubkey,
        tempXTokenAccountKeyPair.publicKey,
        aliceKeypair.publicKey,
        terms.bobExpectedAmount
    )

    const escrowKeypair = new Keypair()
    const createEscrowAccountIx = SystemProgram.createAccount({
        space: EscrowAccountLayout.span,
        lamports: await connection.getMinimumBalanceForRentExemption(
            EscrowAccountLayout.span
        ),
        fromPubkey: aliceKeypair.publicKey,
        newAccountPubkey: escrowKeypair.publicKey,
        programId: escrowProgramId,
    })

    const initEscrowTx = new TransactionInstruction({
        programId: escrowProgramId,
        keys: [
            {
                pubkey: aliceKeypair.publicKey,
                isSigner: true,
                isWritable: false,
            },
            {
                pubkey: tempXTokenAccountKeyPair.publicKey,
                isSigner: false,
                isWritable: true,
            },
            {
                pubkey: aliceYTokenAccountPubkey,
                isSigner: false,
                isWritable: false,
            },
            {
                pubkey: escrowKeypair.publicKey,
                isSigner: false,
                isWritable: true,
            },
            { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
            { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        data: Buffer.from(
            Uint8Array.of(
                0,
                ...new BN(terms.aliceExpectedAmount).toArray('le', 8)
            )
        ),
    })

    const tx = new Transaction().add(
        createTempTokenAccountIx,
        initTempAccountIx,
        transferXTokensToTempAccIx,
        createEscrowAccountIx,
        initEscrowTx
    )

    console.log("Sending Alice's transaction...")
    await connection.sendTransaction(
        tx,
        [aliceKeypair, tempXTokenAccountKeyPair, escrowKeypair],
        { skipPreflight: false, preflightCommitment: 'confirmed' }
    )

    // sleep to allow time to update
    await new Promise((resolve) => setTimeout(resolve, 1000))

    const escrowAccount = await connection.getAccountInfo(
        escrowKeypair.publicKey
    )

    if (escrowAccount === null || escrowAccount.data.length === 0) {
        console.error('Escrow state account has not been initialized properly')
        process.exit(1)
    }

    const encodedEscrowState = escrowAccount.data
    const decodedEscrowState = EscrowAccountLayout.decode(encodedEscrowState)

    if (!decodedEscrowState.isInitialized) {
        console.error('Escrow state initialization flag has not been set')
        process.exit(1)
    } else if (
        !decodedEscrowState.initializerPubkey.equals(aliceKeypair.publicKey)
    ) {
        console.error(
            "InitializerPubkey has not been set correctly / not been set to Alice's public key"
        )
        process.exit(1)
    } else if (
        !decodedEscrowState.initialzierTokenReceiveAccountPubkey.equals(
            aliceYTokenAccountPubkey
        )
    ) {
        console.error(
            "initializerReceivingTokenAccountPubkey has not been set correctly / not been set to Alice's Y public key"
        )
        process.exit(1)
    } else if (
        !decodedEscrowState.tempTokenAccountPubkey.equals(
            tempXTokenAccountKeyPair.publicKey
        )
    ) {
        console.error(
            'initializerTempTokenAccountPubkey has not been set correctly / not been set to temp X token account public key'
        )
        process.exit(1)
    }
    console.log(
        `✨Escrow successfully initialized. Alice is offering ${terms.bobExpectedAmount}X for ${terms.aliceExpectedAmount}Y✨\n`
    )
    writePublicKey(escrowKeypair.publicKey, 'escrow')

    console.table([
        {
            'Alice Token Account X': await getTokenBalance(
                aliceXTokenAccountPubkey,
                connection
            ),
            'Alice Token Account Y': await getTokenBalance(
                aliceYTokenAccountPubkey,
                connection
            ),
            'Bob Token Account X': await getTokenBalance(
                getPublicKey('bob_x'),
                connection
            ),
            'Bob Token Account Y': await getTokenBalance(
                getPublicKey('bob_y'),
                connection
            ),
            'Temporary Token Account X': await getTokenBalance(
                tempXTokenAccountKeyPair.publicKey,
                connection
            ),
        },
    ])

    console.log('')

    // console.log(aliceNewAccount.toString())

    // // const accounts = await connection.getTokenAccountsByOwner(aliceKeypair.publicKey, {mint: XTokenMintPubkey});

    // const accounts = await connection.getParsedProgramAccounts(TOKEN_PROGRAM_ID, { filters: [{dataSize: 165}, {memcmp: { bytes: XTokenMintPubkey.toString(), offset: 0 } }] })
    // console.log(accounts)

    // const accounts = await connection.getParsedTokenAccountsByOwner(
    //     aliceKeypair.publicKey,
    //     { mint: XTokenMintPubkey }
    // )
    // accounts.value.map((v) =>
    //     console.log(v.account.data.parsed, v.pubkey.toString())
    // )
}

alice()
