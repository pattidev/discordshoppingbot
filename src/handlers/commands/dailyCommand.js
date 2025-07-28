/**
 * Daily Command Handler
 */

import { InteractionResponseType } from "discord-interactions";
import { getCurrency, updateCurrency } from "../../services/currencyService.js";
import {
	canClaimDailyReward,
	getNextClaimTime,
	recordDailyClaim,
} from "../../services/dailyRewardService.js";
import { recordEarnings } from "../../services/leaderboardService.js";
import { editInteractionResponse } from "../../utils/discordUtils.js";

/**
 * Handles the /daily command.
 */
export async function handleDailyCommand(interaction, env, ctx) {
	ctx.waitUntil(
		(async () => {
			const userId = interaction.member.user.id;
			const userName = interaction.member.user.username;
			const userAvatar = `https://cdn.discordapp.com/avatars/${userId}/${interaction.member.user.avatar}.png`;

			// Check if user can claim daily reward
			const canClaim = await canClaimDailyReward(userId, env);

			if (!canClaim) {
				const nextClaimTime = await getNextClaimTime(userId, env);
				await editInteractionResponse(interaction, env, {
					embeds: [
						{
							title: "⏰ Daily Reward Already Claimed",
							description: `You've already claimed your daily reward today!`,
							color: 0xff6b6b, // Red
							thumbnail: { url: userAvatar },
							fields: [
								{
									name: "Next Claim Available",
									value: `<t:${Math.floor(nextClaimTime / 1000)}:R>`,
									inline: false,
								},
							],
							footer: { text: "Come back tomorrow for your next reward!" },
						},
					],
					flags: 64,
				});
				return;
			}

			// Give daily reward
			const rewardAmount = 10;
			const currentBalance = await getCurrency(userId, env);
			const newBalance = currentBalance + rewardAmount;

			const balanceUpdated = await updateCurrency(userId, newBalance, env);
			if (!balanceUpdated) {
				await editInteractionResponse(interaction, env, {
					content:
						"There was an error updating your balance. Please try again later.",
					flags: 64,
				});
				return;
			}

			// Record the claim
			const claimRecorded = await recordDailyClaim(userId, env);
			if (!claimRecorded) {
				// Try to refund the coins if recording fails
				await updateCurrency(userId, currentBalance, env);
				await editInteractionResponse(interaction, env, {
					content:
						"There was an error recording your daily claim. Please try again later.",
					flags: 64,
				});
				return;
			}

			// Record the earnings for leaderboard tracking
			await recordEarnings(userId, rewardAmount, env);

			// Success response
			await editInteractionResponse(interaction, env, {
				embeds: [
					{
						title: "🎁 Daily Reward Claimed!",
						description: `**${userName}** claimed their daily reward!`,
						color: 0x4caf50, // Green
						thumbnail: { url: userAvatar },
						fields: [
							{
								name: "💰 Reward",
								value: `**+${rewardAmount.toLocaleString()} coins**`,
								inline: true,
							},
							{
								name: "💳 New Balance",
								value: `**${newBalance.toLocaleString()} coins**`,
								inline: true,
							},
							{
								name: "⏰ Next Reward",
								value: "Available in 24 hours",
								inline: false,
							},
						],
						footer: { text: "Come back tomorrow for another reward!" },
						timestamp: new Date().toISOString(),
					},
				],
				flags: 64,
			});
		})()
	);

	return new Response(
		JSON.stringify({
			type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
			data: { flags: 64 },
		}),
		{ headers: { "Content-Type": "application/json" } }
	);
}
