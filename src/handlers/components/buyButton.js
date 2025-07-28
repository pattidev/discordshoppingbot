/**
 * Buy Button Component Handler
 */

import { InteractionResponseType } from "discord-interactions";
import { getCurrency, updateCurrency } from "../../services/currencyService.js";
import { getItems } from "../../services/itemService.js";
import {
	getUnlockedRoles,
	addUnlockedRole,
} from "../../services/userRoleService.js";
import { editInteractionResponse } from "../../utils/discordUtils.js";

/**
 * Handles the "Buy" button click.
 */
export async function handleBuyButton(interaction, env, ctx) {
	const userId = interaction.member.user.id;
	const roleIdToBuy = interaction.data.custom_id.split("_")[1];

	// Defer the response to avoid timeout
	const deferredPromise = new Response(
		JSON.stringify({
			type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
			data: { flags: 64 },
		}),
		{ headers: { "Content-Type": "application/json" } }
	);

	ctx.waitUntil(
		(async () => {
			const items = await getItems(env);
			const itemToBuy = items.find((item) => item.role_id === roleIdToBuy);

			if (!itemToBuy) {
				await editInteractionResponse(interaction, env, {
					content: "This item is no longer available.",
					flags: 64,
				});
				return;
			}

			// Check if user already owns the role
			const unlockedRoles = await getUnlockedRoles(userId, env);
			if (unlockedRoles.includes(roleIdToBuy)) {
				await editInteractionResponse(interaction, env, {
					content: "You already own this item.",
					flags: 64,
				});
				return;
			}

			const currentBalance = await getCurrency(userId, env);

			if (currentBalance < itemToBuy.price) {
				await editInteractionResponse(interaction, env, {
					content: "You do not have enough coins to purchase this item.",
					flags: 64,
				});
				return;
			}

			const newBalance = currentBalance - itemToBuy.price;
			const currencyUpdated = await updateCurrency(userId, newBalance, env);
			if (!currencyUpdated) {
				await editInteractionResponse(interaction, env, {
					content: "There was an error updating your balance. Purchase failed.",
					flags: 64,
				});
				return;
			}

			const roleUnlocked = await addUnlockedRole(
				userId,
				itemToBuy.role_id,
				env
			);
			if (!roleUnlocked) {
				// Attempt to refund user if unlocking fails
				await updateCurrency(userId, currentBalance, env);
				await editInteractionResponse(interaction, env, {
					content:
						"There was an error saving your purchase. Your coins have been refunded.",
					flags: 64,
				});
				return;
			}

			await editInteractionResponse(interaction, env, {
				content: `You have successfully purchased the **${itemToBuy.name}** role! Use the \`/equip\` command to apply it.`,
				flags: 64,
			});
		})()
	);

	return deferredPromise;
}
