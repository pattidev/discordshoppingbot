/**
 * Leaderboard Command Handler
 */

import { InteractionResponseType } from "discord-interactions";
import { getLeaderboardData } from "../../services/leaderboardService.js";
import { editInteractionResponse } from "../../utils/discordUtils.js";

/**
 * Handles the /leaderboard command.
 */
export async function handleLeaderboardCommand(interaction, env, ctx) {
	ctx.waitUntil(
		(async () => {
			const leaderboardData = await getLeaderboardData(env);

			if (!leaderboardData || leaderboardData.length === 0) {
				await editInteractionResponse(interaction, env, {
					embeds: [
						{
							title: "🏆 Coin Earnings Leaderboard",
							description:
								"No earning data available yet. Claim daily rewards to appear on the leaderboard!",
							color: 0x3498db,
							footer: { text: "Use /daily to start earning coins" },
						},
					],
					// Remove flags: 64 to make it public
				});
				return;
			}

			const embed = {
				title: "🏆 Coin Earnings Leaderboard",
				description: "Top coin earners of all time",
				color: 0xffd700, // Gold
				fields: [],
				footer: { text: "Keep earning coins to climb the ranks!" },
				timestamp: new Date().toISOString(),
			};

			// Add top 10 earners to the leaderboard
			for (let i = 0; i < Math.min(leaderboardData.length, 10); i++) {
				const user = leaderboardData[i];
				const position = i + 1;
				let medal = "";

				if (position === 1) medal = "🥇";
				else if (position === 2) medal = "🥈";
				else if (position === 3) medal = "🥉";
				else medal = `${position}.`;

				embed.fields.push({
					name: `${medal} Rank ${position}`,
					value: `<@${
						user.userId
					}>\n💰 **${user.totalEarned.toLocaleString()} coins** earned\n🎁 **${
						user.dailyClaims
					}** daily rewards claimed`,
					inline: true,
				});
			}

			// Show user's ranking only if they're in the data
			const currentUserId = interaction.member.user.id;
			const userRank = leaderboardData.findIndex(
				(user) => user.userId === currentUserId
			);

			if (userRank >= 10 && userRank !== -1) {
				const userData = leaderboardData[userRank];
				embed.fields.push({
					name: "📍 Your Ranking",
					value: `**Rank ${userRank + 1}** out of ${
						leaderboardData.length
					}\n💰 **${userData.totalEarned.toLocaleString()} coins** earned\n🎁 **${
						userData.dailyClaims
					}** daily rewards claimed`,
					inline: false,
				});
			}

			await editInteractionResponse(interaction, env, {
				embeds: [embed],
				// Remove flags: 64 to make it public
			});
		})()
	);

	return new Response(
		JSON.stringify({
			type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
			// Remove flags: 64 to make it public
		}),
		{ headers: { "Content-Type": "application/json" } }
	);
}
