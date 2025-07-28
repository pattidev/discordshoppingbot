/**
 * Giveaway Button Component Handler
 */

import { InteractionResponseType } from "discord-interactions";
import { joinGiveaway, hasUserJoined } from "../../services/giveawayService.js";

/**
 * Handles giveaway enter button clicks.
 */
export async function handleGiveawayEnter(interaction, env, ctx) {
	const customId = interaction.data.custom_id;
	console.log("interaction data:", interaction.data);
	console.log(`Full custom_id received: "${customId}"`);
	console.log(`Custom_id parts:`, customId.split("_"));

	// Extract ID - adjust this based on your actual custom_id format
	// If custom_id is "giveaway_enter_1753731275366", then index 2 is correct
	// If it's different, we need to adjust the index
	const giveawayId = customId.split("_")[2]; // Extract ID from custom_id

	console.log(`Extracted Giveaway ID: "${giveawayId}"`);

	const userId = interaction.member.user.id;

	// Check if user already joined
	const alreadyJoined = await hasUserJoined(giveawayId, userId, env);

	if (alreadyJoined) {
		return new Response(
			JSON.stringify({
				type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
				data: {
					content: "You have already entered this giveaway!",
					flags: 64, // Ephemeral
				},
			}),
			{ headers: { "Content-Type": "application/json" } }
		);
	}

	// Join the giveaway
	const joined = await joinGiveaway(giveawayId, userId, env);
	if (joined) {
		console.log(`User ${userId} joined giveaway ${giveawayId}: ${joined}`);

		return new Response(
			JSON.stringify({
				type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
				data: {
					content: "🎉 You have successfully entered the giveaway! Good luck!",
					flags: 64, // Ephemeral
				},
			}),
			{ headers: { "Content-Type": "application/json" } }
		);
	} else {
		return new Response(
			JSON.stringify({
				type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
				data: {
					content: "❌ Failed to enter the giveaway. Please try again later.",
					flags: 64, // Ephemeral
				},
			}),
			{ headers: { "Content-Type": "application/json" } }
		);
	}
}
