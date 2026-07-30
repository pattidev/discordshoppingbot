/**
 * Permission Utilities
 * Handles permission checking for Discord commands
 */

/**
 * Discord permission flags
 */
export const PERMISSIONS = {
	ADMINISTRATOR: 0x8n,
	MANAGE_GUILD: 0x20n,
	MANAGE_ROLES: 0x10000000n,
	MANAGE_MESSAGES: 0x2000n,
};

/**
 * Checks if a user has administrator permissions.
 * @param {object} interaction - The Discord interaction object
 * @param {object} env - The Cloudflare Worker environment variables
 * @returns {boolean} True if user has admin permissions
 */
export function hasAdminPermissions(interaction, env) {
	// Config failsafe override
	const userId = interaction.member?.user?.id || interaction.user?.id;
	if (env && env.ADMIN_USER_ID && userId === env.ADMIN_USER_ID) {
		return true;
	}

	if (!interaction.member || !interaction.member.permissions) {
		return false;
	}

	try {
		const permissions = BigInt(interaction.member.permissions);
		return (permissions & PERMISSIONS.ADMINISTRATOR) === PERMISSIONS.ADMINISTRATOR;
	} catch (e) {
		return false;
	}
}

/**
 * Checks if a user has permissions to manage giveaways.
 * @param {object} interaction - The Discord interaction object
 * @param {object} env - The Cloudflare Worker environment variables
 * @returns {boolean} True if user can manage giveaways
 */
export function hasGiveawayPermissions(interaction, env) {
	// Allow Admin override from config
	const userId = interaction.member?.user?.id || interaction.user?.id;
	if (env && env.ADMIN_USER_ID && userId === env.ADMIN_USER_ID) {
		return true;
	}

	if (!interaction.member || !interaction.member.permissions) {
		return false;
	}

	try {
		const permissions = BigInt(interaction.member.permissions);
		return (
			(permissions & PERMISSIONS.ADMINISTRATOR) === PERMISSIONS.ADMINISTRATOR ||
			(permissions & PERMISSIONS.MANAGE_GUILD) === PERMISSIONS.MANAGE_GUILD
		);
	} catch (e) {
		return false;
	}
}

/**
 * Checks if a user has permissions to manage the shop.
 * @param {object} interaction - The Discord interaction object
 * @param {object} env - The Cloudflare Worker environment variables
 * @returns {boolean} True if user can manage shop
 */
export function hasShopPermissions(interaction, env) {
	return hasGiveawayPermissions(interaction, env);
}

/**
 * Creates a permission denied response.
 * @param {string} action - The action that was denied (e.g., "create giveaways")
 * @returns {object} Discord interaction response
 */
export function createPermissionDeniedResponse(action) {
	return {
		embeds: [
			{
				title: "❌ Permission Denied",
				description: `You don't have permission to ${action}.\n\nRequired: Administrator or Manage Server permissions.`,
				color: 0xff6b6b, // Red
				footer: {
					text: "Contact a server administrator if you believe this is an error.",
				},
			},
		],
		flags: 64, // Ephemeral
	};
}
