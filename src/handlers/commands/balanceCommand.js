/**
 * Balance Command Handler
 */

import { InteractionResponseType } from "discord-interactions";
import { getCurrency } from "../../services/currencyService.js";

/**
 * Handles the /balance command.
 */
export async function handleBalanceCommand(interaction, env) {
	const userId = interaction.member.user.id;
	const userAvatar = `https://cdn.discordapp.com/avatars/${userId}/${interaction.member.user.avatar}.png`;

	const balance = await getCurrency(userId, env);

	const embed = {
		title: "🪙 Your Balance",
		description: `You currently have **${balance.toLocaleString()} coins**`,
		color: 0xbd89f4,
		thumbnail: { url: userAvatar },
		footer: { text: "Use /shop to browse available items" },
	};

	return new Response(
		JSON.stringify({
			type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
			data: {
				embeds: [embed],
				flags: 64, // Ephemeral flag (only visible to the user)
			},
		}),
		{ headers: { "Content-Type": "application/json" } }
	);
}
