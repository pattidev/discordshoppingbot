/**
 * Discord API Service - Handles Discord API operations
 */

/**
 * Adds a role to a user via the Discord API.
 * @param {string} userId - The Discord user's ID.
 * @param {string} roleId - The role ID to assign.
 * @param {string} guildId - The guild (server) ID.
 * @param {object} env - The Cloudflare Worker environment variables.
 * @returns {Promise<boolean>} True if the role was successfully assigned, false otherwise.
 */
export async function addRoleToUser(userId, roleId, guildId, env) {
	const url = `https://discord.com/api/v10/guilds/${guildId}/members/${userId}/roles/${roleId}`;

	try {
		const response = await fetch(url, {
			method: "PUT",
			headers: {
				Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
				"Content-Type": "application/json",
				"X-Audit-Log-Reason": "Role equipped via shop bot",
			},
		});
		if (response.ok || response.status === 204) {
			console.log(`Successfully added role ${roleId} to user ${userId}`);
			return true;
		} else {
			const errorText = await response.text();
			console.error(
				`Failed to add role ${roleId} to user ${userId}:`,
				response.status,
				errorText
			);
			return false;
		}
	} catch (error) {
		console.error("Error adding role to user:", error);
		return false;
	}
}

/**
 * Removes a role from a user via the Discord API.
 * @param {string} userId - The Discord user's ID.
 * @param {string} roleId - The role ID to remove.
 * @param {string} guildId - The guild (server) ID.
 * @param {object} env - The Cloudflare Worker environment variables.
 * @returns {Promise<boolean>} True if the role was successfully removed, false otherwise.
 */
export async function removeRoleFromUser(userId, roleId, guildId, env) {
	const url = `https://discord.com/api/v10/guilds/${guildId}/members/${userId}/roles/${roleId}`;

	try {
		const response = await fetch(url, {
			method: "DELETE",
			headers: {
				Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
				"X-Audit-Log-Reason": "Role unequipped via shop bot",
			},
		});
		if (response.ok || response.status === 204) {
			console.log(`Successfully removed role ${roleId} from user ${userId}`);
			return true;
		} else {
			const errorText = await response.text();
			console.error(
				`Failed to remove role ${roleId} from user ${userId}:`,
				response.status,
				errorText
			);
			return false;
		}
	} catch (error) {
		console.error("Error removing role from user:", error);
		return false;
	}
}
