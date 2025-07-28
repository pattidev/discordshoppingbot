/**
 * Currency Service - Handles user currency operations
 */

import { getGoogleAuthToken } from "../utils/googleAuth.js";

/**
 * Retrieves the currency balance for a given user ID.
 * If the user doesn't exist in the sheet, they are created with a balance of 0.
 * @param {string} userId - The Discord user's ID.
 * @param {object} env - The Cloudflare Worker environment variables.
 * @returns {Promise<number>} The user's currency balance.
 */
export async function getCurrency(userId, env) {
	const sheetName = "Currency";
	const token = await getGoogleAuthToken(env);
	const range = `${sheetName}!A:B`;
	const url = `https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}/values/${range}`;

	try {
		const response = await fetch(url, {
			headers: { Authorization: `Bearer ${token}` },
		});
		const data = await response.json();
		const rows = data.values || [];

		const userRowIndex = rows.findIndex((row) => row[0] === userId);

		if (userRowIndex !== -1) {
			return parseInt(rows[userRowIndex][1], 10) || 0;
		} else {
			// User not found, add them to the sheet
			const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}/values/${sheetName}!A1:append?valueInputOption=USER_ENTERED`;
			await fetch(appendUrl, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ values: [[userId, "0"]] }),
			});
			return 0;
		}
	} catch (e) {
		console.error("Error in getCurrency:", e);
		return 0;
	}
}

/**
 * Updates the currency balance for a given user ID.
 * @param {string} userId - The Discord user's ID.
 * @param {number} amount - The new balance amount.
 * @param {object} env - The Cloudflare Worker environment variables.
 * @returns {Promise<boolean>} True if the update was successful, false otherwise.
 */
export async function updateCurrency(userId, amount, env) {
	const sheetName = "Currency";
	const token = await getGoogleAuthToken(env);

	// First, find the row of the user
	const findRange = `${sheetName}!A:A`;
	const findUrl = `https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}/values/${findRange}`;

	try {
		const findResponse = await fetch(findUrl, {
			headers: { Authorization: `Bearer ${token}` },
		});
		const findData = await findResponse.json();
		const rows = findData.values || [];
		const userRowIndex = rows.findIndex((row) => row[0] === userId);

		if (userRowIndex === -1) {
			console.error(`User ${userId} not found for currency update.`);
			return false;
		}

		const rowToUpdate = userRowIndex + 1; // Sheets are 1-indexed
		const updateRange = `${sheetName}!B${rowToUpdate}`;
		const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}/values/${updateRange}?valueInputOption=USER_ENTERED`;

		const updateResponse = await fetch(updateUrl, {
			method: "PUT",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ values: [[amount.toString()]] }),
		});

		return updateResponse.ok;
	} catch (e) {
		console.error("Error in updateCurrency:", e);
		return false;
	}
}
