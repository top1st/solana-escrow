use crate::error::EscrowError::InvalidInstruction;
use solana_program::program_error::ProgramError;
use std::convert::TryInto;

pub enum EscrowInstruction {
    /// Starts the trade by creating and populating an escrow account and transfering ownership of the given temp token account to the PDA
    ///
    ///
    /// Accounts expected:
    ///
    /// 0. `[signer]` initializer
    /// 1. `[writable]` tmp token account created prior to this instruction and owned by initializer
    /// 2. `[]` initializer recieve token account
    /// 3. `[writable]` escrow account // program data
    /// 4. `[]` rent
    /// 5. `[]` token program
    InitEscrow {
        /// want to receive
        amount: u64,
    },

    /// Accepts a trade
    ///
    ///
    /// Accounts expected:
    ///
    /// 0. `[signer]` The account who take the trade
    /// 1. `[writable]` The taker's token account for the token they send
    /// 2. `[writable]` The taker's recieve token account
    /// 3. `[writable]` The PDA's temp token account to get tokens from and eventually close
    /// 4. `[writable]` The initializer's main account to send their rent fees to
    /// 5. `[writable]` The iniitalizer's token account that will receive tokens
    /// 6. `[writable]` The escrow account holding the escrow info
    /// 7. `[]` The token program
    /// 8. `[]` The PDA account
    Exchange {
        /// the amount the taker expect to be paid in other token u64
        amount: u64,
    },
}

impl EscrowInstruction {
    /// Unpack a byte buffer into a [EscrowInstruction]
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        let (tag, rest) = input.split_first().ok_or(InvalidInstruction)?;

        Ok(match tag {
            0 => Self::InitEscrow {
                amount: Self::unpack_amount(rest)?,
            },
            1 => Self::Exchange {
                amount: Self::unpack_amount(rest)?,
            },
            _ => return Err(InvalidInstruction.into()),
        })
    }

    fn unpack_amount(input: &[u8]) -> Result<u64, ProgramError> {
        let amount = input
            .get(..8)
            .and_then(|slice| slice.try_into().ok())
            .map(u64::from_le_bytes)
            .ok_or(InvalidInstruction)?;
        Ok(amount)
    }
}
