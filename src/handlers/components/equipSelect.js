/**
 * Equip Select Component Handler
 */

import { InteractionResponseType } from "discord-interactions";
import {
	getEquippedRoles,
	setEquippedRole,
} from "../../services/userRoleService.js";
import {
	addRoleToUser,
	removeRoleFromUser,
} from "../../services/discordApiService.js";
import { getItems } from "../../services/itemService.js";
import { editInteractionResponse } from "../../utils/discordUtils.js";

/**
 * Handles the role selection from the /equip command.
 */
export async function handleEquipSelect(interaction, env, ctx) {
	const userId = interaction.member.user.id;
	const guildId = interaction.guild_id;
	const selectedRoleIds = interaction.data.values;

	// Defer the update to give us time to process
	const deferredPromise = new Response(
		JSON.stringify({ type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE }),
		{ headers: { "Content-Type": "application/json" } }
	);

	ctx.waitUntil(
		(async () => {
			try {
				const currentEquippedRoles = await getEquippedRoles(userId, env);
				console.log(
					`Current equipped roles for user ${userId}:`,
					currentEquippedRoles
				);

				const allItems = await getItems(env);
				const successfullyEquipped = [];
				const failedToEquip = [];
				const alreadyEquipped = [];

				for (const roleIdToEquip of selectedRoleIds) {
					// Check if user already has this role equipped
					if (currentEquippedRoles.includes(roleIdToEquip)) {
						alreadyEquipped.push(roleIdToEquip);
						continue;
					}

					// Add the new role to Discord
					const roleAssigned = await addRoleToUser(
						userId,
						roleIdToEquip,
						guildId,
						env
					);

					if (!roleAssigned) {
						failedToEquip.push(roleIdToEquip);
						continue;
					}

					// Update the database
					const dbResult = await setEquippedRole(userId, roleIdToEquip, env);
					if (!dbResult) {
						failedToEquip.push(roleIdToEquip);
						// Try to remove the role from Discord since DB update failed
						await removeRoleFromUser(userId, roleIdToEquip, guildId, env);
						continue;
					}

					successfullyEquipped.push(roleIdToEquip);
				}

				// Build response message
				let responseMessage = "";

				if (successfullyEquipped.length > 0) {
					const roleNames = successfullyEquipped
						.map((roleId) => {
							const item = allItems.find((i) => i.role_id === roleId);
							return item ? `**${item.name}**` : "Unknown Role";
						})
						.join(", ");

					responseMessage += `Successfully equipped: ${roleNames}`;
				}

				if (alreadyEquipped.length > 0) {
					const alreadyEquippedNames = alreadyEquipped
						.map((roleId) => {
							const item = allItems.find((i) => i.role_id === roleId);
							return item ? `**${item.name}**` : "Unknown Role";
						})
						.join(", ");

					if (responseMessage) responseMessage += "\n\n";
					responseMessage += `Already equipped: ${alreadyEquippedNames}`;
				}

				if (failedToEquip.length > 0) {
					const failedRoleNames = failedToEquip
						.map((roleId) => {
							const item = allItems.find((i) => i.role_id === roleId);
							return item ? `**${item.name}**` : "Unknown Role";
						})
						.join(", ");

					if (responseMessage) responseMessage += "\n\n";
					responseMessage += `Failed to equip: ${failedRoleNames}. Please check bot permissions and try again.`;
				}

				if (!responseMessage) {
					responseMessage = "No roles were equipped.";
				}

				await editInteractionResponse(interaction, env, {
					content: responseMessage,
					components: [], // Remove the dropdown after selection
					flags: 64,
				});
			} catch (error) {
				console.error("Error in handleEquipSelect:", error);
				await editInteractionResponse(interaction, env, {
					content: "An unexpected error occurred while equipping roles.",
					components: [],
					flags: 64,
				});
			}
		})()
	);

	return deferredPromise;
}
