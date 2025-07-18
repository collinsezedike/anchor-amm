use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{ Mint, Token, TokenAccount, Transfer, transfer },
};
use constant_product_curve::{ ConstantProduct, LiquidityPair };

use crate::{ error::AmmError, state::Config };

#[derive(Accounts)]
pub struct Swap<'info> {
    #[account(mut)]
    pub swapper: Signer<'info>,

    pub mint_x: Account<'info, Mint>,

    pub mint_y: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"lp", config.key().as_ref()],
        bump = config.lp_bump
    )]
    pub mint_lp: Account<'info, Mint>,

    #[account(
        mut, 
        associated_token::mint = mint_x, 
        associated_token::authority = config
    )]
    pub vault_x: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = mint_y,
        associated_token::authority = config
    )]
    pub vault_y: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = swapper,
        associated_token::mint = mint_x,
        associated_token::authority = swapper
    )]
    pub swapper_x_ata: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = swapper,
        associated_token::mint = mint_y,
        associated_token::authority = swapper
    )]
    pub swapper_y_ata: Account<'info, TokenAccount>,

    #[account(
        has_one = mint_x,
        has_one = mint_y,
        seeds = [b"config", config.config_id.to_le_bytes().as_ref()],
        bump = config.config_bump
    )]
    pub config: Account<'info, Config>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

impl<'info> Swap<'info> {
    pub fn swap(&mut self, is_x: bool, amount: u64, min: u64) -> Result<()> {
        require!(!self.config.locked, AmmError::PoolLocked);
        require!(amount > 0, AmmError::InvalidAmount);

        let mut curve = ConstantProduct::init(
            self.vault_x.amount, // x
            self.vault_y.amount, // y
            self.mint_lp.supply, // l
            self.config.fee, // fee
            None // precision
        ).map_err(AmmError::from)?;

        let liquiduty_pair = match is_x {
            true => LiquidityPair::X,
            false => LiquidityPair::Y,
        };

        let swap_result = curve.swap(liquiduty_pair, amount, min).map_err(AmmError::from)?;

        require!(swap_result.deposit != 0, AmmError::InvalidAmount);
        require!(swap_result.withdraw != 0, AmmError::InvalidAmount);

        // deposit tokens
        self.deposit_tokens(is_x, swap_result.deposit)?;

        // withdraw tokens
        self.withdraw_tokens(is_x, swap_result.withdraw)?;

        // transfer fee

        Ok(())
    }

    pub fn deposit_tokens(&mut self, is_x: bool, amount: u64) -> Result<()> {
        let (from, to) = match is_x {
            true => (self.swapper_x_ata.to_account_info(), self.vault_x.to_account_info()),
            false => (self.swapper_y_ata.to_account_info(), self.vault_y.to_account_info()),
        };

        let cpi_program = self.token_program.to_account_info();

        let accounts = Transfer {
            from,
            to,
            authority: self.swapper.to_account_info(),
        };

        let cpi_ctx = CpiContext::new(cpi_program, accounts);

        transfer(cpi_ctx, amount)?;

        Ok(())
    }

    pub fn withdraw_tokens(&mut self, is_x: bool, amount: u64) -> Result<()> {
        let (from, to) = match is_x {
            true => (self.vault_y.to_account_info(), self.swapper_y_ata.to_account_info()),
            false => (self.vault_x.to_account_info(), self.swapper_x_ata.to_account_info()),
        };

        let cpi_program = self.token_program.to_account_info();

        let accounts = Transfer {
            from,
            to,
            authority: self.config.to_account_info(),
        };

        let seeds = &[
            &b"config"[..],
            &self.config.config_id.to_le_bytes(),
            &[self.config.config_bump],
        ];
        let signer_seeds = &[&seeds[..]];

        let cpi_ctx = CpiContext::new_with_signer(cpi_program, accounts, signer_seeds);

        transfer(cpi_ctx, amount)?;

        Ok(())
    }
}
