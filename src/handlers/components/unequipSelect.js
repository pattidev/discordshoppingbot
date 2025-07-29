/**
 * Unequip Select Component Handler
 */

import { InteractionResponseType } from "discord-interactions";
import {
	getEquippedRoles,
	removeEquippedRole,
	removeAllEquippedRoles,
} from "../../services/userRoleService.js";
import {
	removeRoleFromUser,
	addRoleToUser,
} from "../../services/discordApiService.js";
import { getItems } from "../../services/itemService.js";
import { editInteractionResponse } from "../../utils/discordUtils.js";

/**
 * Handles the role unequipping from the /unequip command.
 */
export async function handleUnequipSelect(interaction, env, ctx) {
	const userId = interaction.member.user.id;
	const guildId = interaction.guild_id;
	const selectedValues = interaction.data.values;

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

				// Handle "unequip all" option
				if (selectedValues.includes("unequip_all")) {
					let allSuccessful = true;

					// Remove all roles from Discord
					for (const roleId of currentEquippedRoles) {
						const roleRemoved = await removeRoleFromUser(
							userId,
							roleId,
							guildId,
							env
						);
						if (!roleRemoved) {
							allSuccessful = false;
						}
					}

					if (!allSuccessful) {
						await editInteractionResponse(interaction, env, {
							content:
								"Failed to remove some roles from Discord. Please check bot permissions and try again.",
							components: [],
							flags: 64,
						});
						return;
					}

					// Remove all from database
					const dbResult = await removeAllEquippedRoles(userId, env);
					if (!dbResult) {
						await editInteractionResponse(interaction, env, {
							content:
								"Roles were removed from Discord but there was an error updating the database.",
							components: [],
							flags: 64,
						});
						return;
					}

					await editInteractionResponse(interaction, env, {
						content: "You have successfully unequipped **all roles**!",
						components: [],
						flags: 64,
					});
					return;
				}

				// Handle individual role unequipping
				const allItems = await getItems(env);
				const successfullyUnequipped = [];
				const failedToUnequip = [];

				for (const roleId of selectedValues) {
					// Check if user actually has this role equipped
					if (!currentEquippedRoles.includes(roleId)) {
						continue;
					}

					// Remove role from Discord
					const roleRemoved = await removeRoleFromUser(
						userId,
						roleId,
						guildId,
						env
					);
					if (!roleRemoved) {
						failedToUnequip.push(roleId);
						continue;
					}

					// Remove from database
					const dbResult = await removeEquippedRole(userId, roleId, env);
					if (!dbResult) {
						failedToUnequip.push(roleId);
						// Try to re-add the role to Discord since DB update failed
						await addRoleToUser(userId, roleId, guildId, env);
						continue;
					}

					successfullyUnequipped.push(roleId);
				}

				// Build response message
				let responseMessage = "";

				if (successfullyUnequipped.length > 0) {
					const roleNames = successfullyUnequipped
						.map((roleId) => {
							const item = allItems.find((i) => i.role_id === roleId);
							return item ? `**${item.name}**` : "Unknown Role";
						})
						.join(", ");

					responseMessage += `Successfully unequipped: ${roleNames}`;
				}

				if (failedToUnequip.length > 0) {
					const failedRoleNames = failedToUnequip
						.map((roleId) => {
							const item = allItems.find((i) => i.role_id === roleId);
							return item ? `**${item.name}**` : "Unknown Role";
						})
						.join(", ");

					if (responseMessage) responseMessage += "\n\n";
					responseMessage += `Failed to unequip: ${failedRoleNames}. Please check bot permissions and try again.`;
				}

				if (!responseMessage) {
					responseMessage = "No roles were unequipped.";
				}

				await editInteractionResponse(interaction, env, {
					content: responseMessage,
					components: [],
					flags: 64,
				});
			} catch (error) {
				console.error("Error in handleUnequipSelect:", error);
				await editInteractionResponse(interaction, env, {
					content: "An unexpected error occurred while unequipping roles.",
					components: [],
					flags: 64,
				});
			}
		})()
	);

	return deferredPromise;
}
