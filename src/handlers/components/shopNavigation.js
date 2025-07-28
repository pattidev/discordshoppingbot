/**
 * Shop Navigation Component Handlers
 */

import { InteractionResponseType } from "discord-interactions";
import { getCurrency } from "../../services/currencyService.js";
import { getItems } from "../../services/itemService.js";
import { buildShopMessage } from "../../ui/shopBuilder.js";

/**
 * Handles the "Previous" and "Next" page buttons in the shop.
 */
export async function handlePageTurn(interaction, env) {
	const customId = interaction.data.custom_id;
	const currentPage = parseInt(customId.split("_").pop(), 10);
	const direction = customId.includes("next") ? 1 : -1;
	const newPage = currentPage + direction;

	const items = await getItems(env);
	const balance = await getCurrency(interaction.member.user.id, env); // Refetch balance in case it changed

	const { embed, components } = await buildShopMessage(items, balance, newPage);

	// Update the original message with the new page content
	return new Response(
		JSON.stringify({
			type: InteractionResponseType.UPDATE_MESSAGE,
			data: {
				embeds: [embed],
				components: components,
			},
		}),
		{ headers: { "Content-Type": "application/json" } }
	);
}

/**
 * Handles the "Back to Summary" button click.
 */
export async function handleSummaryPage(interaction, env) {
	const items = await getItems(env);
	const balance = await getCurrency(interaction.member.user.id, env);

	const { embed, components } = await buildShopMessage(items, balance, -1);

	return new Response(
		JSON.stringify({
			type: InteractionResponseType.UPDATE_MESSAGE,
			data: {
				embeds: [embed],
				components: components,
			},
		}),
		{ headers: { "Content-Type": "application/json" } }
	);
}

/**
 * Handles the "View Item Details" button click.
 */
export async function handleViewDetails(interaction, env) {
	const items = await getItems(env);
	const balance = await getCurrency(interaction.member.user.id, env);

	// Start viewing from the first item (page 0)
	const { embed, components } = await buildShopMessage(items, balance, 0);

	return new Response(
		JSON.stringify({
			type: InteractionResponseType.UPDATE_MESSAGE,
			data: {
				embeds: [embed],
				components: components,
			},
		}),
		{ headers: { "Content-Type": "application/json" } }
	);
}
