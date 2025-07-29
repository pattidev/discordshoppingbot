/**
 * Unequip Command Handler
 */

import { InteractionResponseType } from "discord-interactions";
import { getEquippedRoles } from "../../services/userRoleService.js";
import { getItems } from "../../services/itemService.js";
import { editInteractionResponse } from "../../utils/discordUtils.js";

/**
 * Handles the /unequip command.
 */
export async function handleUnequipCommand(interaction, env, ctx) {
	ctx.waitUntil(
		(async () => {
			const userId = interaction.member.user.id;
			const equippedRoles = await getEquippedRoles(userId, env);
			const allItems = await getItems(env);
			console.log(`User ${userId} has equipped roles:`, equippedRoles);

			if (!equippedRoles || equippedRoles.length === 0) {
				await editInteractionResponse(interaction, env, {
					content: "You don't have any roles equipped.",
					flags: 64,
				});
				return;
			}

			const options = equippedRoles
				.map((roleId) => {
					const item = allItems.find((i) => i.role_id === roleId);
					if (!item) return null;
					return {
						label: item.name,
						value: item.role_id,
						description: `Unequip the ${item.name} role.`,
					};
				})
				.filter(Boolean);

			if (options.length === 0) {
				await editInteractionResponse(interaction, env, {
					content:
						"It seems your equipped roles are no longer available in the shop. Please contact an admin.",
					flags: 64,
				});
				return;
			}

			// Add an "Unequip All" option if user has multiple roles
			if (options.length > 1) {
				options.unshift({
					label: "🚫 Unequip All Roles",
					value: "unequip_all",
					description: "Remove all equipped roles at once.",
				});
			}

			const components = [
				{
					type: 1, // Action Row
					components: [
						{
							type: 3, // String Select
							custom_id: "unequip_select",
							placeholder: "Choose role(s) to unequip",
							options: options,
							max_values: options.length, // Allow multiple selections
						},
					],
				},
			];

			await editInteractionResponse(interaction, env, {
				content: "Select the role(s) you want to unequip:",
				components: components,
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
