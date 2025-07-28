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
	const sheetName = "EquippedRoles";
	const token = await getGoogleAuthToken(env);
	const range = `${sheetName}!A:B`;
	const url = `https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}/values/${range}`;

	try {
		const response = await fetch(url, {
			headers: { Authorization: `Bearer ${token}` },
		});
		const data = await response.json();
		const rows = data.values || [];
		const userRow = rows.find((row) => row[0] === userId);
		return userRow ? userRow[1] : null;
	} catch (e) {
		console.error("Error in getEquippedRole:", e);
		return null;
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
	const findRange = `${sheetName}!A:A`;
	const findUrl = `https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}/values/${findRange}`;

	try {
		const findResponse = await fetch(findUrl, {
			headers: { Authorization: `Bearer ${token}` },
		});
		const findData = await findResponse.json();
		const rows = findData.values || [];
		const userRowIndex = rows.findIndex((row) => row[0] === userId);

		if (userRowIndex !== -1) {
			// User exists, update their role
			const rowToUpdate = userRowIndex + 1;
			const updateRange = `${sheetName}!B${rowToUpdate}`;
			const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}/values/${updateRange}?valueInputOption=USER_ENTERED`;
			const updateResponse = await fetch(updateUrl, {
				method: "PUT",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ values: [[roleId]] }),
			});
			console.log(`User ${userId} updated equipped role to ${roleId}.`);

			return updateResponse.ok;
		} else {
			// User not found, append a new row
			const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}/values/${sheetName}!A1:append?valueInputOption=USER_ENTERED`;
			const appendResponse = await fetch(appendUrl, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ values: [[userId, roleId]] }),
			});
			console.log(`User ${userId} not found, created new equipped role entry.`);
			return appendResponse.ok;
		}
	} catch (e) {
		console.error("Error in setEquippedRole:", e);
		return false;
	}
}
