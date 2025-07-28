/**
 * Component Handler - Handles button clicks and select menu interactions
 */

import {
	handleBuyButton,
	handleEquipSelect,
	handlePageTurn,
	handleSummaryPage,
	handleViewDetails,
} from "./components/index.js";
import { handleGiveawayEnter } from "./components/giveawayButton.js";

/**
 * Handles incoming button clicks and component interactions from Discord.
 * @param {object} interaction The interaction object from Discord.
 * @param {object} env The Cloudflare Worker environment variables.
 * @param {object} ctx The execution context.
 */
export async function handleMessageComponent(interaction, env, ctx) {
	const customId = interaction.data.custom_id;

	if (customId.startsWith("buy_")) {
		return await handleBuyButton(interaction, env, ctx);
	} else if (customId.startsWith("equip_select")) {
		return await handleEquipSelect(interaction, env, ctx);
	} else if (
		customId.startsWith("prev_page_") ||
		customId.startsWith("next_page_")
	) {
		return await handlePageTurn(interaction, env);
	} else if (customId === "summary_page") {
		return await handleSummaryPage(interaction, env);
	} else if (customId.startsWith("view_details_")) {
		return await handleViewDetails(interaction, env);
	} else if (customId.startsWith("giveaway_enter_")) {
		return await handleGiveawayEnter(interaction, env, ctx);
	} else {
		console.error(`Unknown component custom_id: ${customId}`);
		return new Response(`Unknown component: ${customId}`, { status: 400 });
	}
}
