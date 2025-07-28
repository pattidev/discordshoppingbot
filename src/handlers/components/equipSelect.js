/**
 * Equip Select Component Handler
 */

import { InteractionResponseType } from "discord-interactions";
import {
	getEquippedRole,
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
	const roleIdToEquip = interaction.data.values[0];

	// Defer the update to give us time to process
	const deferredPromise = new Response(
		JSON.stringify({ type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE }),
		{ headers: { "Content-Type": "application/json" } }
	);

	ctx.waitUntil(
		(async () => {
			try {
				const currentEquippedRole = await getEquippedRole(userId, env);
				console.log(
					`Current equipped role for user ${userId}:`,
					currentEquippedRole
				);

				// If user is trying to equip the same role, do nothing.
				if (currentEquippedRole === roleIdToEquip) {
					await editInteractionResponse(interaction, env, {
						content: "You already have this role equipped.",
						components: [], // Remove the dropdown
						flags: 64,
					});
					return;
				}

				// Remove the old role if it exists
				if (currentEquippedRole) {
					await removeRoleFromUser(userId, currentEquippedRole, guildId, env);
				}

				// Add the new role
				const roleAssigned = await addRoleToUser(
					userId,
					roleIdToEquip,
					guildId,
					env
				);
				if (!roleAssigned) {
					await editInteractionResponse(interaction, env, {
						content:
							"Failed to apply the new role. Please check bot permissions and try again.",
						components: [],
						flags: 64,
					});
					// Try to re-add the old role if it existed, to prevent user from being role-less
					if (currentEquippedRole) {
						await addRoleToUser(userId, currentEquippedRole, guildId, env);
					}
					return;
				}

				// Update the database
				await setEquippedRole(userId, roleIdToEquip, env);

				const allItems = await getItems(env);
				const equippedItem = allItems.find((i) => i.role_id === roleIdToEquip);
				const roleName = equippedItem ? equippedItem.name : "the selected role";

				await editInteractionResponse(interaction, env, {
					content: `You have successfully equipped the **${roleName}** role!`,
					components: [], // Remove the dropdown after selection
					flags: 64,
				});
			} catch (error) {
				console.error("Error in handleEquipSelect:", error);
				await editInteractionResponse(interaction, env, {
					content: "An unexpected error occurred while equipping the role.",
					components: [],
					flags: 64,
				});
			}
		})()
	);

	return deferredPromise;
}
