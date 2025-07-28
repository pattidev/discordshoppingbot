/**
 * Command Handler - Handles all slash commands
 */

import { InteractionResponseType } from "discord-interactions";
import {
	handleBalanceCommand,
	handleShopCommand,
	handleEquipCommand,
	handleDailyCommand,
	handleLeaderboardCommand,
	handleCoinflipCommand,
	handleGiveawayCommand,
} from "./commands/index.js";

/**
 * Handles incoming slash commands from Discord.
 * @param {object} interaction The interaction object from Discord.
 * @param {object} env The Cloudflare Worker environment variables.
 * @param {object} ctx The execution context.
 */
export async function handleApplicationCommand(interaction, env, ctx) {
	const commandName = interaction.data.name;

	switch (commandName) {
		case "balance":
			return await handleBalanceCommand(interaction, env);
		case "shop":
			return await handleShopCommand(interaction, env, ctx);
		case "equip":
			return await handleEquipCommand(interaction, env, ctx);
		case "daily":
			return await handleDailyCommand(interaction, env, ctx);
		case "leaderboard":
			return await handleLeaderboardCommand(interaction, env, ctx);
		case "coinflip":
			return await handleCoinflipCommand(interaction, env, ctx);
		case "giveaway":
			return await handleGiveawayCommand(interaction, env, ctx);
		default:
			console.error(`Unknown command: ${commandName}`);
			return new Response(
				JSON.stringify({
					type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
					data: {
						content: `Unknown command: ${commandName}`,
						flags: 64,
					},
				}),
				{ headers: { "Content-Type": "application/json" } }
			);
	}
}
