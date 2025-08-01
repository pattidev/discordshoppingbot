/**
 * Equip Command Handler
 */

import { InteractionResponseType } from "discord-interactions";
import { getUnlockedRoles } from "../../services/userRoleService.js";
import { getItems } from "../../services/itemService.js";
import { editInteractionResponse } from "../../utils/discordUtils.js";

/**
 * Handles the /equip command.
 */
export async function handleEquipCommand(interaction, env, ctx) {
	ctx.waitUntil(
		(async () => {
			const userId = interaction.member.user.id;
			const unlockedRoles = await getUnlockedRoles(userId, env);
			const allItems = await getItems(env);
			console.log(`User ${userId} has unlocked roles:`, unlockedRoles);

			if (!unlockedRoles || unlockedRoles.length === 0) {
				await editInteractionResponse(interaction, env, {
					content:
						"You have not purchased any roles yet. Use `/shop` to see available roles.",
					flags: 64,
				});
				return;
			}

			const options = unlockedRoles
				.map((roleId) => {
					const item = allItems.find((i) => i.role_id === roleId);
					if (!item) return null;
					return {
						label: item.name,
						value: item.role_id,
						description: `Equip the ${item.name} role.`,
					};
				})
				.filter(Boolean);

			if (options.length === 0) {
				await editInteractionResponse(interaction, env, {
					content:
						"It seems your purchased roles are no longer available in the shop. Please contact an admin.",
					flags: 64,
				});
				return;
			}

			const components = [
				{
					type: 1, // Action Row
					components: [
						{
							type: 3, // String Select
							custom_id: "equip_select",
							placeholder: "Choose role(s) to equip",
							options: options,
							max_values: options.length, // Allow multiple selections
						},
					],
				},
			];

			await editInteractionResponse(interaction, env, {
				content: "Select the role(s) you want to equip:",
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
