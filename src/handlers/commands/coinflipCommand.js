/**
 * Coinflip Command Handler
 */

import { InteractionResponseType } from "discord-interactions";
import { getCurrency, updateCurrency } from "../../services/currencyService.js";
import {
	canUseCoinflip,
	getNextCoinflipTime,
	recordCoinflipUsage,
} from "../../services/coinflipService.js";
import { editInteractionResponse } from "../../utils/discordUtils.js";

/**
 * Handles the /coinflip command.
 */
export async function handleCoinflipCommand(interaction, env, ctx) {
	ctx.waitUntil(
		(async () => {
			const userId = interaction.member.user.id;
			const userName = interaction.member.user.username;
			const userAvatar = `https://cdn.discordapp.com/avatars/${userId}/${interaction.member.user.avatar}.png`;

			// Check if user can use coinflip (once per day limit)
			const canFlip = await canUseCoinflip(userId, env);

			if (!canFlip) {
				const nextFlipTime = await getNextCoinflipTime(userId, env);
				await editInteractionResponse(interaction, env, {
					embeds: [
						{
							title: "⏰ Daily Coinflip Already Used",
							description: "You've already used your daily coinflip today!",
							color: 0xff6b6b, // Red
							thumbnail: { url: userAvatar },
							fields: [
								{
									name: "Next Coinflip Available",
									value: `<t:${Math.floor(nextFlipTime / 1000)}:R>`,
									inline: false,
								},
							],
							footer: { text: "Come back tomorrow to gamble again!" },
						},
					],
					flags: 64,
				});
				return;
			}

			// Get the bet amount from the command options
			const betAmount = interaction.data.options?.[0]?.value || 0;

			// Validate bet amount
			if (betAmount <= 0) {
				await editInteractionResponse(interaction, env, {
					embeds: [
						{
							title: "❌ Invalid Bet",
							description: "Please bet at least 1 coin!",
							color: 0xff6b6b,
							thumbnail: { url: userAvatar },
						},
					],
					flags: 64,
				});
				return;
			}

			const currentBalance = await getCurrency(userId, env);

			// Check if user has enough coins
			if (currentBalance < betAmount) {
				await editInteractionResponse(interaction, env, {
					embeds: [
						{
							title: "💸 Insufficient Funds",
							description: `You only have **${currentBalance.toLocaleString()} coins** but tried to bet **${betAmount.toLocaleString()} coins**!`,
							color: 0xff6b6b,
							thumbnail: { url: userAvatar },
							footer: { text: "Play more or use /daily to earn more coins" },
						},
					],
					flags: 64,
				});
				return;
			}

			// Record the coinflip usage
			const flipRecorded = await recordCoinflipUsage(userId, env);
			if (!flipRecorded) {
				await editInteractionResponse(interaction, env, {
					content:
						"There was an error recording your coinflip usage. Please try again later.",
					flags: 64,
				});
				return;
			}

			// Flip the coin (50/50 chance)
			const isWin = Math.random() < 0.5;
			const coinResult = isWin ? "heads" : "tails";
			const playerChoice = "heads"; // Player always calls heads for simplicity

			let newBalance;
			let resultTitle;
			let resultDescription;
			let resultColor;

			if (isWin) {
				// Player wins - double their bet
				const winnings = betAmount;
				newBalance = currentBalance + winnings;
				resultTitle = "🎉 You Won!";
				resultDescription = `The coin landed on **${coinResult}**!\nYou won **${winnings.toLocaleString()} coins**!`;
				resultColor = 0x4caf50; // Green
			} else {
				// Player loses - lose their bet
				newBalance = currentBalance - betAmount;
				resultTitle = "💸 You Lost!";
				resultDescription = `The coin landed on **${coinResult}**!\nYou lost **${betAmount.toLocaleString()} coins**!`;
				resultColor = 0xff6b6b; // Red
			}

			// Update the user's balance
			const balanceUpdated = await updateCurrency(userId, newBalance, env);
			if (!balanceUpdated) {
				await editInteractionResponse(interaction, env, {
					content:
						"There was an error updating your balance. Please try again later.",
					flags: 64,
				});
				return;
			}

			// Create the result embed
			const embed = {
				title: resultTitle,
				description: resultDescription,
				color: resultColor,
				thumbnail: { url: userAvatar },
				fields: [
					{
						name: "🪙 Your Bet",
						value: `**${betAmount.toLocaleString()} coins**`,
						inline: true,
					},
					{
						name: "🎯 Result",
						value: `**${coinResult.toUpperCase()}**`,
						inline: true,
					},
					{
						name: "💰 New Balance",
						value: `**${newBalance.toLocaleString()} coins**`,
						inline: true,
					},
				],
				footer: {
					text: isWin
						? "Lucky! Come back tomorrow to gamble again!"
						: "Better luck tomorrow!",
				},
				timestamp: new Date().toISOString(),
			};

			await editInteractionResponse(interaction, env, {
				embeds: [embed],
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
