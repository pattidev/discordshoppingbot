/**
 * Giveaway Command Handler
 */

import { InteractionResponseType } from "discord-interactions";
import {
	createGiveaway,
	selectWinners,
	getGiveaway,
	getGiveawayParticipants,
	updateGiveawayStatus,
} from "../../services/giveawayService.js";
import { editInteractionResponse } from "../../utils/discordUtils.js";
import {
	hasGiveawayPermissions,
	createPermissionDeniedResponse,
} from "../../utils/permissions.js";

/**
 * Handles the /giveaway command with subcommands.
 */
export async function handleGiveawayCommand(interaction, env, ctx) {
	const subcommand = interaction.data.options?.[0]?.name;

	switch (subcommand) {
		case "create":
			return await handleCreateGiveaway(interaction, env, ctx);
		case "end":
			return await handleEndGiveaway(interaction, env, ctx);
		case "reroll":
			return await handleRerollGiveaway(interaction, env, ctx);
		default:
			return new Response(
				JSON.stringify({
					type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
					data: {
						content: "Unknown giveaway subcommand.",
						flags: 64,
					},
				}),
				{ headers: { "Content-Type": "application/json" } }
			);
	}
}

/**
 * Handles the /giveaway create subcommand.
 */
async function handleCreateGiveaway(interaction, env, ctx) {
	// Check permissions first
	if (!hasGiveawayPermissions(interaction)) {
		return new Response(
			JSON.stringify({
				type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
				data: createPermissionDeniedResponse("create giveaways"),
			}),
			{ headers: { "Content-Type": "application/json" } }
		);
	}

	ctx.waitUntil(
		(async () => {
			const options = interaction.data.options[0].options;
			const title = options.find((opt) => opt.name === "title")?.value;
			const prize = options.find((opt) => opt.name === "prize")?.value;
			const duration = options.find((opt) => opt.name === "duration")?.value;
			const winners = options.find((opt) => opt.name === "winners")?.value || 1;
			const description =
				options.find((opt) => opt.name === "description")?.value ||
				"React with 🎉 to enter!";

			// Calculate end time
			const endTime = new Date(Date.now() + duration * 60 * 1000);

			// Generate giveaway ID first
			const giveawayId = Date.now().toString();

			// Create the giveaway embed
			const embed = {
				title: `🎉 ${title}`,
				description: `${description}\n\n**Prize:** ${prize}\n**Winners:** ${winners}\n**Ends:** <t:${Math.floor(
					endTime.getTime() / 1000
				)}:R>`,
				color: 0xff6b6b,
				footer: {
					text: "React with 🎉 to enter the giveaway!",
				},
				timestamp: endTime.toISOString(),
			};

			// Send the giveaway message with the correct giveaway ID
			await editInteractionResponse(interaction, env, {
				embeds: [embed],
				components: [
					{
						type: 1,
						components: [
							{
								type: 2,
								style: 1,
								label: "🎉 Enter Giveaway",
								custom_id: `giveaway_enter_${giveawayId}`,
							},
						],
					},
				],
			});

			// Get the message ID (this would need to be handled differently in production)
			// For now, we'll use a placeholder
			const messageId = "placeholder_message_id";
			const channelId = interaction.channel_id;
			const creatorId = interaction.member.user.id;

			// Store giveaway in database using the same ID
			const createdGiveawayId = await createGiveaway(
				title,
				description,
				prize,
				winners,
				endTime.toISOString(),
				channelId,
				messageId,
				creatorId,
				env,
				giveawayId // Pass the pre-generated ID
			);

			if (!createdGiveawayId) {
				console.error("Failed to create giveaway in database");
			}
		})()
	);

	return new Response(
		JSON.stringify({
			type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
		}),
		{ headers: { "Content-Type": "application/json" } }
	);
}

/**
 * Handles the /giveaway end subcommand.
 */
async function handleEndGiveaway(interaction, env, ctx) {
	// Check permissions first
	if (!hasGiveawayPermissions(interaction)) {
		return new Response(
			JSON.stringify({
				type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
				data: createPermissionDeniedResponse("end giveaways"),
			}),
			{ headers: { "Content-Type": "application/json" } }
		);
	}

	ctx.waitUntil(
		(async () => {
			const options = interaction.data.options[0].options;
			const giveawayId = options.find((opt) => opt.name === "id")?.value;

			const giveaway = await getGiveaway(giveawayId, env);
			if (!giveaway) {
				await editInteractionResponse(interaction, env, {
					content: "Giveaway not found!",
					flags: 64,
				});
				return;
			}

			if (giveaway.status !== "active") {
				await editInteractionResponse(interaction, env, {
					content: "This giveaway has already ended!",
					flags: 64,
				});
				return;
			}

			// Select winners
			const winners = await selectWinners(
				giveawayId,
				giveaway.winnersCount,
				env
			);
			const participants = await getGiveawayParticipants(giveawayId, env);

			// Update giveaway status
			await updateGiveawayStatus(giveawayId, "ended", env);

			// Create results embed
			const embed = {
				title: `🎉 Giveaway Ended: ${giveaway.title}`,
				description: `**Prize:** ${giveaway.prize}\n**Total Participants:** ${participants.length}`,
				color: 0x4caf50,
				fields: [],
				timestamp: new Date().toISOString(),
			};

			if (winners.length > 0) {
				embed.fields.push({
					name: `🏆 Winner${winners.length > 1 ? "s" : ""}`,
					value: winners.map((id) => `<@${id}>`).join("\n"),
					inline: false,
				});
				embed.description += `\n**Winner${
					winners.length > 1 ? "s" : ""
				}:** ${winners.map((id) => `<@${id}>`).join(", ")}`;
			} else {
				embed.fields.push({
					name: "❌ No Winners",
					value: "Not enough participants to select winners.",
					inline: false,
				});
			}

			await editInteractionResponse(interaction, env, {
				embeds: [embed],
			});
		})()
	);

	return new Response(
		JSON.stringify({
			type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
		}),
		{ headers: { "Content-Type": "application/json" } }
	);
}

/**
 * Handles the /giveaway reroll subcommand.
 */
async function handleRerollGiveaway(interaction, env, ctx) {
	// Check permissions first
	if (!hasGiveawayPermissions(interaction)) {
		return new Response(
			JSON.stringify({
				type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
				data: createPermissionDeniedResponse("reroll giveaways"),
			}),
			{ headers: { "Content-Type": "application/json" } }
		);
	}

	ctx.waitUntil(
		(async () => {
			const options = interaction.data.options[0].options;
			const giveawayId = options.find((opt) => opt.name === "id")?.value;

			const giveaway = await getGiveaway(giveawayId, env);
			if (!giveaway) {
				await editInteractionResponse(interaction, env, {
					content: "Giveaway not found!",
					flags: 64,
				});
				return;
			}

			if (giveaway.status !== "ended") {
				await editInteractionResponse(interaction, env, {
					content: "This giveaway is still active or hasn't been ended yet!",
					flags: 64,
				});
				return;
			}

			// Select new winners
			const newWinners = await selectWinners(
				giveawayId,
				giveaway.winnersCount,
				env
			);
			const participants = await getGiveawayParticipants(giveawayId, env);

			// Create reroll results embed
			const embed = {
				title: `🔄 Giveaway Rerolled: ${giveaway.title}`,
				description: `**Prize:** ${giveaway.prize}\n**Total Participants:** ${participants.length}`,
				color: 0xffd700,
				fields: [],
				timestamp: new Date().toISOString(),
			};

			if (newWinners.length > 0) {
				embed.fields.push({
					name: `🏆 New Winner${newWinners.length > 1 ? "s" : ""}`,
					value: newWinners.map((id) => `<@${id}>`).join("\n"),
					inline: false,
				});
			} else {
				embed.fields.push({
					name: "❌ No Winners",
					value: "Not enough participants to select winners.",
					inline: false,
				});
			}

			await editInteractionResponse(interaction, env, {
				embeds: [embed],
			});
		})()
	);

	return new Response(
		JSON.stringify({
			type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
		}),
		{ headers: { "Content-Type": "application/json" } }
	);
}
