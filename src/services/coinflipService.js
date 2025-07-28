/**
 * Coinflip Service - Handles coinflip gambling functionality
 */

import { getGoogleAuthToken } from "../utils/googleAuth.js";

/**
 * Checks if a user can use coinflip (once per day limit).
 * @param {string} userId - The Discord user's ID.
 * @param {object} env - The Cloudflare Worker environment variables.
 * @returns {Promise<boolean>} True if the user can flip, false otherwise.
 */
export async function canUseCoinflip(userId, env) {
	const sheetName = "CoinflipUsage";
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

		if (!userRow) {
			// User hasn't used coinflip before, they can use it
			return true;
		}

		const lastUsageDate = new Date(userRow[1]);
		const now = new Date();
		const timeDiff = now.getTime() - lastUsageDate.getTime();
		const hoursDiff = timeDiff / (1000 * 3600);

		// Can use if it's been more than 24 hours
		return hoursDiff >= 24;
	} catch (e) {
		console.error("Error in canUseCoinflip:", e);
		return true; // Default to allowing usage if there's an error
	}
}

/**
 * Gets the next time a user can use coinflip.
 * @param {string} userId - The Discord user's ID.
 * @param {object} env - The Cloudflare Worker environment variables.
 * @returns {Promise<number>} Timestamp of next usage time.
 */
export async function getNextCoinflipTime(userId, env) {
	const sheetName = "CoinflipUsage";
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

		if (!userRow) {
			return Date.now(); // Can use now
		}

		const lastUsageDate = new Date(userRow[1]);
		return lastUsageDate.getTime() + 24 * 60 * 60 * 1000; // 24 hours later
	} catch (e) {
		console.error("Error in getNextCoinflipTime:", e);
		return Date.now();
	}
}

/**
 * Records a coinflip usage for a user.
 * @param {string} userId - The Discord user's ID.
 * @param {object} env - The Cloudflare Worker environment variables.
 * @returns {Promise<boolean>} True if successful.
 */
export async function recordCoinflipUsage(userId, env) {
	const sheetName = "CoinflipUsage";
	const token = await getGoogleAuthToken(env);
	const now = new Date().toISOString();

	try {
		// First check if user already has a record
		const findRange = `${sheetName}!A:A`;
		const findUrl = `https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}/values/${findRange}`;

		const findResponse = await fetch(findUrl, {
			headers: { Authorization: `Bearer ${token}` },
		});
		const findData = await findResponse.json();
		const rows = findData.values || [];
		const userRowIndex = rows.findIndex((row) => row[0] === userId);

		if (userRowIndex !== -1) {
			// Update existing record
			const rowToUpdate = userRowIndex + 1; // Sheets are 1-indexed
			const updateRange = `${sheetName}!B${rowToUpdate}`;
			const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}/values/${updateRange}?valueInputOption=USER_ENTERED`;

			const updateResponse = await fetch(updateUrl, {
				method: "PUT",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ values: [[now]] }),
			});

			return updateResponse.ok;
		} else {
			// Create new record
			const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}/values/${sheetName}!A1:append?valueInputOption=USER_ENTERED`;

			const appendResponse = await fetch(appendUrl, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ values: [[userId, now]] }),
			});

			return appendResponse.ok;
		}
	} catch (e) {
		console.error("Error in recordCoinflipUsage:", e);
		return false;
	}
}
