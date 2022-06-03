import { TOKEN_PROGRAM_ID } from '@solana/spl-token'
import {
    Connection,
    PublicKey,
    Transaction,
    TransactionInstruction,
} from '@solana/web3.js'
import { BN } from 'bn.js'
import { EscrowAccountLayout } from './AccountsLayouts'
import {
    getKeypair,
    getProgramId,
    getPublicKey,
    getTerms,
    getTokenBalance,
} from './utils'

const bob = async () => {
    const bobKeypair = getKeypair('bob')
    const bobXTokenAccountPubkey = getPublicKey('bob_x')
    const bobYTokenAccountPubkey = getPublicKey('bob_y')
    const escrowStateAccountPubkey = getPublicKey('escrow')
    const escrowProgramId = getProgramId()
    const terms = getTerms()

    const connection = new Connection('http://localhost:8899', 'confirmed')
    const escrowAccount = await connection.getAccountInfo(
        escrowStateAccountPubkey
    )
    if (escrowAccount === null) {
        console.error('Could not find escrow at given address!')
        process.exit(1)
    }

    const encodedEscrowState = escrowAccount.data
    const escrowState = EscrowAccountLayout.decode(encodedEscrowState)

    const PDA = await PublicKey.findProgramAddress(
        [Buffer.from('escrow')],
        escrowProgramId
    )

    const exchangeInstruction = new TransactionInstruction({
        programId: escrowProgramId,
        data: Buffer.from(
            Uint8Array.of(
                1,
                ...new BN(terms.bobExpectedAmount).toArray('le', 8)
            )
        ),
        keys: [
            { pubkey: bobKeypair.publicKey, isSigner: true, isWritable: false },
            {
                pubkey: bobYTokenAccountPubkey,
                isSigner: false,
                isWritable: true,
            },
            {
                pubkey: bobXTokenAccountPubkey,
                isSigner: false,
                isWritable: true,
            },
            {
                pubkey: escrowState.tempTokenAccountPubkey,
                isSigner: false,
                isWritable: true,
            },
            {
                pubkey: escrowState.initializerPubkey,
                isSigner: false,
                isWritable: true,
            },
            {
                pubkey: escrowState.initialzierTokenReceiveAccountPubkey,
                isSigner: false,
                isWritable: true,
            },
            {
                pubkey: escrowStateAccountPubkey,
                isSigner: false,
                isWritable: true,
            },
            { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
            { pubkey: PDA[0], isSigner: false, isWritable: false },
        ],
    })

    const aliceYTokenAccountPubkey = getPublicKey('alice_y')
    const [aliceYbalance, bobXbalance] = await Promise.all([
        getTokenBalance(aliceYTokenAccountPubkey, connection),
        getTokenBalance(bobXTokenAccountPubkey, connection),
    ])
    console.log("Sending Bob's transaction...")
    await connection.sendTransaction(
        new Transaction().add(exchangeInstruction),
        [bobKeypair],
        { skipPreflight: false, preflightCommitment: 'confirmed' }
    )

    // sleep to allow time to update
    await new Promise((resolve) => setTimeout(resolve, 1000))

    if ((await connection.getAccountInfo(escrowStateAccountPubkey)) != null) {
        console.error('Escrow account has not been closed')
        process.exit(1)
    }

    if (
        (await connection.getAccountInfo(
            escrowState.tempTokenAccountPubkey
        )) !== null
    ) {
        console.error('Temporary X token account has not been closed')
        process.exit(1)
    }

    const newAliceYbalance = await getTokenBalance(
        aliceYTokenAccountPubkey,
        connection
    )

    if (newAliceYbalance != aliceYbalance! + terms.aliceExpectedAmount) {
        console.error(
            `Alice's Y balance should be ${
                aliceYbalance! + terms.aliceExpectedAmount
            } but is ${newAliceYbalance}`
        )
        process.exit(1)
    }

    const newBobXbalance = await getTokenBalance(
        bobXTokenAccountPubkey,
        connection
    )
    if (newBobXbalance != bobXbalance! + terms.bobExpectedAmount) {
        console.error(
            `Bob's balance should be ${
                bobXbalance! + terms.bobExpectedAmount
            } but is ${newBobXbalance}`
        )
        process.exit(1)
    }

    console.log(
        '✨Trade successfully executed. All temporary accounts closed✨\n'
    )

    console.table([
        {
            'Alice Token Account X': await getTokenBalance(
                getPublicKey('alice_x'),
                connection
            ),
            'Alice Token Account Y': newAliceYbalance,
            'Bob Token Account X': newBobXbalance,
            'Bob Token Account Y': await getTokenBalance(
                bobYTokenAccountPubkey,
                connection
            ),
        },
    ])
    console.log('')
}

bob()
