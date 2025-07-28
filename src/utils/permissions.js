/**
 * Permission Utilities
 * Handles permission checking for Discord commands
 */

/**
 * Discord permission flags
 */
export const PERMISSIONS = {
	ADMINISTRATOR: 0x8,
	MANAGE_GUILD: 0x20,
	MANAGE_ROLES: 0x10000000,
	MANAGE_MESSAGES: 0x2000,
};

/**
 * Checks if a user has administrator permissions.
 * @param {object} interaction - The Discord interaction object
 * @returns {boolean} True if user has admin permissions
 */
export function hasAdminPermissions(interaction) {
	if (!interaction.member || !interaction.member.permissions) {
		return false;
	}

	const permissions = parseInt(interaction.member.permissions);
	return (
		(permissions & PERMISSIONS.ADMINISTRATOR) === PERMISSIONS.ADMINISTRATOR
	);
}

/**
 * Checks if a user has permissions to manage giveaways.
 * Currently requires administrator permissions, but could be expanded.
 * @param {object} interaction - The Discord interaction object
 * @returns {boolean} True if user can manage giveaways
 */
export function hasGiveawayPermissions(interaction) {
	// For now, require administrator permissions
	// Could be expanded to include specific roles or other permissions
	return hasAdminPermissions(interaction);
}

/**
 * Checks if a user has permissions to manage the shop.
 * @param {object} interaction - The Discord interaction object
 * @returns {boolean} True if user can manage shop
 */
export function hasShopPermissions(interaction) {
	if (!interaction.member || !interaction.member.permissions) {
		return false;
	}

	const permissions = parseInt(interaction.member.permissions);
	return (
		(permissions & PERMISSIONS.ADMINISTRATOR) === PERMISSIONS.ADMINISTRATOR ||
		(permissions & PERMISSIONS.MANAGE_GUILD) === PERMISSIONS.MANAGE_GUILD
	);
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
				description: `You don't have permission to ${action}.\n\nRequired: Administrator permissions`,
				color: 0xff6b6b, // Red
				footer: {
					text: "Contact a server administrator if you believe this is an error.",
				},
			},
		],
		flags: 64, // Ephemeral
	};
}
