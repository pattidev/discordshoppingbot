/**
 * Discord Utilities
 */

/**
 * Edits the original interaction response.
 * @param {object} interaction - The interaction object from Discord.
 * @param {object} env - The Cloudflare Worker environment variables.
 * @param {object} data - The new message data.
 */
export async function editInteractionResponse(interaction, env, data) {
	const url = `https://discord.com/api/v10/webhooks/${env.DISCORD_CLIENT_ID}/${interaction.token}/messages/@original`;

	try {
		const response = await fetch(url, {
			method: "PATCH",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(data),
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error(
				"Failed to edit interaction response:",
				response.status,
				errorText
			);
		}
	} catch (error) {
		console.error("Error editing interaction response:", error);
	}
}
