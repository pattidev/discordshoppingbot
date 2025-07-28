/**
 * Leaderboard Service - Handles leaderboard functionality
 */

import { getGoogleAuthToken } from "../utils/googleAuth.js";

/**
 * Gets leaderboard data sorted by total lifetime earnings.
 * @param {object} env - The Cloudflare Worker environment variables.
 * @returns {Promise<Array<object>>} Array of user earnings data.
 */
export async function getLeaderboardData(env) {
	const sheetName = "Leaderboard";
	const token = await getGoogleAuthToken(env);
	const range = `${sheetName}!A:C`;
	const url = `https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}/values/${range}`;

	try {
		const response = await fetch(url, {
			headers: { Authorization: `Bearer ${token}` },
		});
		const data = await response.json();
		const rows = data.values || [];

		// Skip header row and convert to objects
		const leaderboardData = rows
			.slice(1)
			.map((row) => ({
				userId: row[0] || "",
				totalEarned: parseInt(row[1], 10) || 0,
				dailyClaims: parseInt(row[2], 10) || 0,
			}))
			.filter((user) => user.userId && user.totalEarned > 0);

		// Sort by total earned (descending)
		return leaderboardData.sort((a, b) => b.totalEarned - a.totalEarned);
	} catch (e) {
		console.error("Error in getLeaderboardData:", e);
		return [];
	}
}

/**
 * Records earnings for leaderboard tracking.
 * @param {string} userId - The Discord user's ID.
 * @param {number} amount - The amount earned.
 * @param {object} env - The Cloudflare Worker environment variables.
 * @returns {Promise<boolean>} True if successful.
 */
export async function recordEarnings(userId, amount, env) {
	const sheetName = "Leaderboard";
	const token = await getGoogleAuthToken(env);

	try {
		// First check if user already has a record
		const findRange = `${sheetName}!A:C`;
		const findUrl = `https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}/values/${findRange}`;

		const findResponse = await fetch(findUrl, {
			headers: { Authorization: `Bearer ${token}` },
		});
		const findData = await findResponse.json();
		const rows = findData.values || [];

		// Find user row (skip header)
		const userRowIndex = rows.slice(1).findIndex((row) => row[0] === userId);

		if (userRowIndex !== -1) {
			// Update existing record (add 1 to account for header row)
			const actualRowIndex = userRowIndex + 2; // +1 for header, +1 for 0-based to 1-based
			const currentEarned = parseInt(rows[userRowIndex + 1][1], 10) || 0;
			const currentClaims = parseInt(rows[userRowIndex + 1][2], 10) || 0;

			const newTotalEarned = currentEarned + amount;
			const newClaimsCount = currentClaims + 1;

			// Update both total earned and daily claims
			const batchUpdateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}/values/${sheetName}!B${actualRowIndex}:C${actualRowIndex}?valueInputOption=USER_ENTERED`;

			const updateResponse = await fetch(batchUpdateUrl, {
				method: "PUT",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					values: [[newTotalEarned.toString(), newClaimsCount.toString()]],
				}),
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
				body: JSON.stringify({
					values: [[userId, amount.toString(), "1"]],
				}),
			});

			return appendResponse.ok;
		}
	} catch (e) {
		console.error("Error in recordEarnings:", e);
		return false;
	}
}
