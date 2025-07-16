pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("FwZrAy3nYYhtrD4gVLgmDQA5gQxhLt9d91FyQCqCzuK9");

#[program]
pub mod anchor_amm {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        config_id: u64,
        fee: u16,
        locked: bool,
        authority: Option<Pubkey>
    ) -> Result<()> {
        ctx.accounts.initialize(config_id, fee, locked, authority, &ctx.bumps)
    }
}
