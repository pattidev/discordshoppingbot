/**
 * User Role Service - Handles user role management
 */

import { getGoogleAuthToken } from "../utils/googleAuth.js";

/**
 * Adds a record of a purchased role for a user.
 * @param {string} userId - The Discord user's ID.
 * @param {string} roleId - The role ID purchased.
 * @param {object} env - The Cloudflare Worker environment variables.
 * @returns {Promise<boolean>} True if successful.
 */
export async function addUnlockedRole(userId, roleId, env) {
	const sheetName = "UserRoles";
	const token = await getGoogleAuthToken(env);
	const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}/values/${sheetName}!A1:append?valueInputOption=USER_ENTERED`;

	try {
		const response = await fetch(appendUrl, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ values: [[userId, roleId]] }),
		});
		return response.ok;
	} catch (e) {
		console.error("Error in addUnlockedRole:", e);
		return false;
	}
}

/**
 * Retrieves all roles a user has purchased.
 * @param {string} userId - The Discord user's ID.
 * @param {object} env - The Cloudflare Worker environment variables.
 * @returns {Promise<Array<string>>} A list of role IDs.
 */
export async function getUnlockedRoles(userId, env) {
	const sheetName = "UserRoles";
	const token = await getGoogleAuthToken(env);
	const range = `${sheetName}!A:B`;
	const url = `https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}/values/${range}?majorDimension=COLUMNS`;

	try {
		const response = await fetch(url, {
			headers: { Authorization: `Bearer ${token}` },
		});
		const data = await response.json();
		if (!data.values || data.values.length < 2) {
			return [];
		}
		const userIds = data.values[0];
		const roleIds = data.values[1];
		const unlocked = [];
		for (let i = 0; i < userIds.length; i++) {
			if (userIds[i] === userId) {
				unlocked.push(roleIds[i]);
			}
		}
		return unlocked;
	} catch (e) {
		console.error("Error in getUnlockedRoles:", e);
		return [];
	}
}

/**
 * Gets the currently equipped role for a user.
 * @param {string} userId - The Discord user's ID.
 * @param {object} env - The Cloudflare Worker environment variables.
 * @returns {Promise<string|null>} The equipped role ID or null.
 */
export async function getEquippedRole(userId, env) {
	const equippedRoles = await getEquippedRoles(userId, env);
	return equippedRoles.length > 0 ? equippedRoles[0] : null;
}

/**
 * Gets all currently equipped roles for a user.
 * @param {string} userId - The Discord user's ID.
 * @param {object} env - The Cloudflare Worker environment variables.
 * @returns {Promise<Array<string>>} Array of equipped role IDs.
 */
export async function getEquippedRoles(userId, env) {
	const sheetName = "EquippedRoles";
	const token = await getGoogleAuthToken(env);
	const range = `${sheetName}!A:B`;
	const url = `https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}/values/${range}?majorDimension=COLUMNS`;

	try {
		const response = await fetch(url, {
			headers: { Authorization: `Bearer ${token}` },
		});
		const data = await response.json();
		if (!data.values || data.values.length < 2) {
			return [];
		}
		const userIds = data.values[0];
		const roleIds = data.values[1];
		const equipped = [];
		for (let i = 0; i < userIds.length; i++) {
			if (userIds[i] === userId) {
				equipped.push(roleIds[i]);
			}
		}
		return equipped;
	} catch (e) {
		console.error("Error in getEquippedRoles:", e);
		return [];
	}
}

/**
 * Sets the equipped role for a user, updating or creating as needed.
 * @param {string} userId - The Discord user's ID.
 * @param {string} roleId - The role ID to equip.
 * @param {object} env - The Cloudflare Worker environment variables.
 * @returns {Promise<boolean>} True if successful.
 */
export async function setEquippedRole(userId, roleId, env) {
	const sheetName = "EquippedRoles";
	const token = await getGoogleAuthToken(env);
	const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}/values/${sheetName}!A1:append?valueInputOption=USER_ENTERED`;

	try {
		const response = await fetch(appendUrl, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ values: [[userId, roleId]] }),
		});
		console.log(`User ${userId} equipped role ${roleId}.`);
		return response.ok;
	} catch (e) {
		console.error("Error in setEquippedRole:", e);
		return false;
	}
}

/**
 * Removes an equipped role for a user.
 * @param {string} userId - The Discord user's ID.
 * @param {string} roleId - The role ID to unequip.
 * @param {object} env - The Cloudflare Worker environment variables.
 * @returns {Promise<boolean>} True if successful.
 */
export async function removeEquippedRole(userId, roleId, env) {
	const sheetName = "EquippedRoles";
	const token = await getGoogleAuthToken(env);
	const range = `${sheetName}!A:B`;
	const url = `https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}/values/${range}`;

	try {
		// First, get all the data to find which rows to delete
		const response = await fetch(url, {
			headers: { Authorization: `Bearer ${token}` },
		});
		const data = await response.json();
		const rows = data.values || [];

		// Find the row indices that match the user and role
		const rowsToDelete = [];
		for (let i = 0; i < rows.length; i++) {
			if (rows[i][0] === userId && rows[i][1] === roleId) {
				rowsToDelete.push(i + 1); // Google Sheets is 1-indexed
			}
		}

		if (rowsToDelete.length === 0) {
			console.log(`No equipped role ${roleId} found for user ${userId}`);
			return true; // Consider it successful if the role wasn't equipped anyway
		}

		// Delete rows (start from the end to maintain indices)
		for (let i = rowsToDelete.length - 1; i >= 0; i--) {
			const rowIndex = rowsToDelete[i];
			const deleteUrl = `https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}:batchUpdate`;
			const deleteResponse = await fetch(deleteUrl, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					requests: [
						{
							deleteDimension: {
								range: {
									sheetId: 0, // Assuming first sheet
									dimension: "ROWS",
									startIndex: rowIndex - 1,
									endIndex: rowIndex,
								},
							},
						},
					],
				}),
			});

			if (!deleteResponse.ok) {
				console.error(
					`Failed to delete row ${rowIndex} for user ${userId} role ${roleId}`
				);
				return false;
			}
		}

		console.log(`User ${userId} unequipped role ${roleId}.`);
		return true;
	} catch (e) {
		console.error("Error in removeEquippedRole:", e);
		return false;
	}
}

/**
 * Removes all equipped roles for a user.
 * @param {string} userId - The Discord user's ID.
 * @param {object} env - The Cloudflare Worker environment variables.
 * @returns {Promise<boolean>} True if successful.
 */
export async function removeAllEquippedRoles(userId, env) {
	const equippedRoles = await getEquippedRoles(userId, env);
	let success = true;

	for (const roleId of equippedRoles) {
		const result = await removeEquippedRole(userId, roleId, env);
		if (!result) {
			success = false;
		}
	}

	return success;
}
