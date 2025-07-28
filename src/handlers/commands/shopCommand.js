/**
 * Shop Command Handler
 */

import { InteractionResponseType } from "discord-interactions";
import { getCurrency } from "../../services/currencyService.js";
import { getItems } from "../../services/itemService.js";
import { buildShopMessage } from "../../ui/shopBuilder.js";
import { editInteractionResponse } from "../../utils/discordUtils.js";

/**
 * Handles the /shop command.
 */
export async function handleShopCommand(interaction, env, ctx) {
	// Use waitUntil to perform async tasks after responding.
	ctx.waitUntil(
		(async () => {
			const userId = interaction.member.user.id;
			const items = await getItems(env);

			if (!items || items.length === 0) {
				await editInteractionResponse(interaction, env, {
					content: "The shop is currently empty.",
					flags: 64,
				});
				return;
			}

			const balance = await getCurrency(userId, env);
			// Start with summary page (page -1)
			const { embed, components } = await buildShopMessage(items, balance, -1);

			await editInteractionResponse(interaction, env, {
				embeds: [embed],
				components: components,
				flags: 64, // Ephemeral
			});
		})()
	);

	// Immediately return a deferred response to avoid timeout.
	return new Response(
		JSON.stringify({
			type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
			data: {
				flags: 64, // Ephemeral
			},
		}),
		{ headers: { "Content-Type": "application/json" } }
	);
}
