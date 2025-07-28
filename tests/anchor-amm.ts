import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AnchorAmm } from "../target/types/anchor_amm";

import {
	Address,
	address,
	getAddressEncoder,
	getProgramDerivedAddress,
} from "gill";
import { SYSTEM_PROGRAM_ADDRESS } from "gill/programs";
import {
	fetchMint,
	getAssociatedTokenAccountAddress,
	ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
	TOKEN_PROGRAM_ADDRESS,
} from "gill/programs/token";

describe("anchor-amm", () => {
	anchor.setProvider(anchor.AnchorProvider.env());

	const user = anchor.AnchorProvider.local().wallet;

	const program = anchor.workspace.anchorAmm as Program<AnchorAmm>;

	const mintX = address("Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr");
	const mintY = address("62hLevDvm2kowvfHjNwLrdnCTQ9pmJeYbyu8Z6nDfdhv");

	let config: Address;
	let mintLp: Address;
	let vaultX: Address;
	let vaultY: Address;

	const fee = 1000;
	const configId = new anchor.BN("11431744375459076608");
	const authority = user.publicKey;

	before(async () => {
		[config] = await getProgramDerivedAddress({
			programAddress: address(program.programId.toBase58()),
			seeds: [Buffer.from("config"), configId.toBuffer("le")],
		});

		[mintLp] = await getProgramDerivedAddress({
			programAddress: address(program.programId.toBase58()),
			// seeds: [Buffer.from("lp"), config],
			seeds: [Buffer.from("lp"), getAddressEncoder().encode(config)],
		});

		vaultX = await getAssociatedTokenAccountAddress(mintX, config);
		vaultY = await getAssociatedTokenAccountAddress(mintY, config);
	});

	it("Is initialized!", async () => {
		const tx = await program.methods
			.initialize(configId, fee, authority)
			.accountsStrict({
				initializer: user.publicKey,
				mintX,
				mintY,
				vaultX,
				vaultY,
				config,
				mintLp,
				associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
				tokenProgram: TOKEN_PROGRAM_ADDRESS,
				systemProgram: SYSTEM_PROGRAM_ADDRESS,
			})
			.rpc();
		console.log(`https://explorer.solana.com/tx/${tx}?cluster=devnet`);
	});

	it("Deposits into pool!", async () => {
		const depositor = address(user.publicKey.toBase58());

		const depositorXAta = await getAssociatedTokenAccountAddress(
			mintX,
			depositor
		);
		const depositorYAta = await getAssociatedTokenAccountAddress(
			mintY,
			depositor
		);
		const depositorLpAta = await getAssociatedTokenAccountAddress(
			mintLp,
			depositor
		);

		const amount = new anchor.BN(100000);
		const maxX = new anchor.BN(80000);
		const maxY = new anchor.BN(80000);

		const tx = await program.methods
			.deposit(amount, maxX, maxY)
			.accountsStrict({
				depositor,
				mintX,
				mintY,
				vaultX,
				vaultY,
				config,
				mintLp,
				depositorXAta,
				depositorYAta,
				depositorLpAta,
				associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
				tokenProgram: TOKEN_PROGRAM_ADDRESS,
				systemProgram: SYSTEM_PROGRAM_ADDRESS,
			})
			.rpc();
		console.log(`https://explorer.solana.com/tx/${tx}?cluster=devnet`);
	});

	it("Swaps token X for token Y!", async () => {
		const swapper = address(user.publicKey.toBase58());

		const swapperXAta = await getAssociatedTokenAccountAddress(
			mintX,
			swapper
		);
		const swapperYAta = await getAssociatedTokenAccountAddress(
			mintY,
			swapper
		);

		const amount = new anchor.BN(15000);
		const isX = true;
		const min = new anchor.BN(10000);

		const tx = await program.methods
			.swap(isX, amount, min)
			.accountsStrict({
				swapper,
				mintX,
				mintY,
				vaultX,
				vaultY,
				config,
				mintLp,
				swapperXAta,
				swapperYAta,
				associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
				tokenProgram: TOKEN_PROGRAM_ADDRESS,
				systemProgram: SYSTEM_PROGRAM_ADDRESS,
			})
			.rpc();
		console.log(`https://explorer.solana.com/tx/${tx}?cluster=devnet`);
	});

	it("Withdraws from pool!", async () => {
		const withdrawer = address(user.publicKey.toBase58());

		const withdrawerXAta = await getAssociatedTokenAccountAddress(
			mintX,
			withdrawer
		);
		const withdrawerYAta = await getAssociatedTokenAccountAddress(
			mintY,
			withdrawer
		);
		const withdrawerLpAta = await getAssociatedTokenAccountAddress(
			mintLp,
			withdrawer
		);

		const amount = new anchor.BN(100000);
		const minX = new anchor.BN(60000);
		const minY = new anchor.BN(60000);

		const tx = await program.methods
			.withdraw(amount, minX, minY)
			.accountsStrict({
				withdrawer,
				mintX,
				mintY,
				vaultX,
				vaultY,
				config,
				mintLp,
				withdrawerXAta,
				withdrawerYAta,
				withdrawerLpAta,
				associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
				tokenProgram: TOKEN_PROGRAM_ADDRESS,
				systemProgram: SYSTEM_PROGRAM_ADDRESS,
			})
			.rpc();
		console.log(`https://explorer.solana.com/tx/${tx}?cluster=devnet`);
	});
});
