/**
 * Giveaway Service
 * Manages giveaway creation, participation, and winner selection
 */

import { getGoogleAuthToken } from "../utils/googleAuth.js";

/**
 * Creates a new giveaway in the Google Sheet.
 * @param {string} title - The giveaway title
 * @param {string} description - The giveaway description
 * @param {string} prize - The prize description
 * @param {number} winnersCount - Number of winners to select
 * @param {string} endTime - ISO string of when giveaway ends
 * @param {string} channelId - Discord channel ID where giveaway is posted
 * @param {string} messageId - Discord message ID of the giveaway
 * @param {string} creatorId - Discord user ID of who created it
 * @param {object} env - Environment variables
 * @param {string} [giveawayId=null] - Optional pre-generated giveaway ID
 * @returns {Promise<string|null>} The giveaway ID or null if failed
 */
export async function createGiveaway(
	title,
	description,
	prize,
	winnersCount,
	endTime,
	channelId,
	messageId,
	creatorId,
	env,
	giveawayId = null
) {
	const sheetName = "Giveaways";
	const token = await getGoogleAuthToken(env);
	const finalGiveawayId = giveawayId || Date.now().toString(); // Use provided ID or generate new one
	const createdAt = new Date().toISOString();

	try {
		const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}/values/${sheetName}!A1:append?valueInputOption=USER_ENTERED`;

		const response = await fetch(appendUrl, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				values: [
					[
						finalGiveawayId,
						title,
						description,
						prize,
						winnersCount.toString(),
						endTime,
						channelId,
						messageId,
						creatorId,
						createdAt,
						"active", // status
					],
				],
			}),
		});

		return response.ok ? finalGiveawayId : null;
	} catch (e) {
		console.error("Error in createGiveaway:", e);
		return null;
	}
}

/**
 * Adds a participant to a giveaway.
 * @param {string} giveawayId - The giveaway ID
 * @param {string} userId - Discord user ID
 * @param {object} env - Environment variables
 * @returns {Promise<boolean>} True if successful
 */
export async function joinGiveaway(giveawayId, userId, env) {
	const sheetName = "GiveawayParticipants";
	const token = await getGoogleAuthToken(env);
	const joinedAt = new Date().toISOString();

	console.log(
		`joinGiveaway called with giveawayId: ${giveawayId} (type: ${typeof giveawayId}), userId: ${userId}`
	);

	try {
		// Verify giveaway exists first
		const giveaway = await getGiveaway(giveawayId, env);
		if (!giveaway) {
			console.error(`Giveaway ${giveawayId} not found in Giveaways sheet!`);
			return false;
		}
		console.log(`Giveaway found:`, giveaway);

		// Check if user already joined
		const isAlreadyJoined = await hasUserJoined(giveawayId, userId, env);
		if (isAlreadyJoined) {
			return false; // User already joined
		}
		const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}/values/${sheetName}!A1:append?valueInputOption=USER_ENTERED`;

		console.log(
			`Adding participant - giveawayId: ${giveawayId}, userId: ${userId}`
		);

		const response = await fetch(appendUrl, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				values: [[giveawayId, userId, joinedAt]],
			}),
		});

		return response.ok;
	} catch (e) {
		console.error("Error in joinGiveaway:", e);
		return false;
	}
}

/**
 * Checks if a user has already joined a giveaway.
 * @param {string} giveawayId - The giveaway ID
 * @param {string} userId - Discord user ID
 * @param {object} env - Environment variables
 * @returns {Promise<boolean>} True if user has joined
 */
export async function hasUserJoined(giveawayId, userId, env) {
	const sheetName = "GiveawayParticipants";
	const token = await getGoogleAuthToken(env);
	const range = `${sheetName}!A:B`;
	const url = `https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}/values/${range}`;

	console.log(
		`hasUserJoined called with giveawayId: ${giveawayId} (type: ${typeof giveawayId}), userId: ${userId}`
	);

	try {
		const response = await fetch(url, {
			headers: { Authorization: `Bearer ${token}` },
		});
		const data = await response.json();
		const rows = data.values || [];

		console.log(`All participants data:`, rows);
		console.log(
			`Filtering for giveaway ${giveawayId}:`,
			rows.filter((row) => {
				console.log(
					`Comparing: "${
						row[0]
					}" (${typeof row[0]}) === "${giveawayId}" (${typeof giveawayId})`
				);
				return row[0] === giveawayId;
			})
		);

		return rows.some((row) => row[0] === giveawayId && row[1] === userId);
	} catch (e) {
		console.error("Error in hasUserJoined:", e);
		return false;
	}
}

/**
 * Gets all participants for a giveaway.
 * @param {string} giveawayId - The giveaway ID
 * @param {object} env - Environment variables
 * @returns {Promise<Array<string>>} Array of user IDs
 */
export async function getGiveawayParticipants(giveawayId, env) {
	const sheetName = "GiveawayParticipants";
	const token = await getGoogleAuthToken(env);
	const range = `${sheetName}!A:B`;
	const url = `https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}/values/${range}`;

	try {
		const response = await fetch(url, {
			headers: { Authorization: `Bearer ${token}` },
		});
		const data = await response.json();
		const rows = data.values || [];

		return rows.filter((row) => row[0] === giveawayId).map((row) => row[1]);
	} catch (e) {
		console.error("Error in getGiveawayParticipants:", e);
		return [];
	}
}

/**
 * Gets giveaway details by ID.
 * @param {string} giveawayId - The giveaway ID
 * @param {object} env - Environment variables
 * @returns {Promise<object|null>} Giveaway details or null
 */
export async function getGiveaway(giveawayId, env) {
	const sheetName = "Giveaways";
	const token = await getGoogleAuthToken(env);
	const range = `${sheetName}!A:K`;
	const url = `https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}/values/${range}`;

	console.log(
		`getGiveaway called with giveawayId: ${giveawayId} (type: ${typeof giveawayId})`
	);

	try {
		const response = await fetch(url, {
			headers: { Authorization: `Bearer ${token}` },
		});
		const data = await response.json();
		const rows = data.values || [];

		console.log(`All giveaways data:`, rows);
		console.log(
			`Looking for giveaway ${giveawayId}:`,
			rows.filter((row) => {
				console.log(
					`Comparing: "${
						row[0]
					}" (${typeof row[0]}) === "${giveawayId}" (${typeof giveawayId})`
				);
				return row[0] === giveawayId;
			})
		);

		const giveawayRow = rows.find((row) => row[0] === giveawayId);
		if (!giveawayRow) return null;

		return {
			id: giveawayRow[0],
			title: giveawayRow[1],
			description: giveawayRow[2],
			prize: giveawayRow[3],
			winnersCount: parseInt(giveawayRow[4], 10),
			endTime: giveawayRow[5],
			channelId: giveawayRow[6],
			messageId: giveawayRow[7],
			creatorId: giveawayRow[8],
			createdAt: giveawayRow[9],
			status: giveawayRow[10] || "active",
		};
	} catch (e) {
		console.error("Error in getGiveaway:", e);
		return null;
	}
}

/**
 * Gets recent winners to enforce fairness (exclude from new giveaways).
 * @param {object} env - Environment variables
 * @param {number} daysCooldown - Number of days to exclude recent winners (default: 30)
 * @returns {Promise<Array<string>>} Array of user IDs who won recently
 */
export async function getRecentWinners(env, daysCooldown = 60) {
	const sheetName = "GiveawayWinners";
	const token = await getGoogleAuthToken(env);
	const range = `${sheetName}!A:C`;
	const url = `https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}/values/${range}`;

	try {
		const response = await fetch(url, {
			headers: { Authorization: `Bearer ${token}` },
		});
		const data = await response.json();
		const rows = data.values || [];

		const cutoffDate = new Date();
		cutoffDate.setDate(cutoffDate.getDate() - daysCooldown);

		return rows
			.filter((row) => {
				const winDate = new Date(row[2]); // Assuming column C has win date
				return winDate >= cutoffDate;
			})
			.map((row) => row[1]); // Column B has user ID
	} catch (e) {
		console.error("Error in getRecentWinners:", e);
		return [];
	}
}

/**
 * Records winners in the winners sheet.
 * @param {string} giveawayId - The giveaway ID
 * @param {Array<string>} winners - Array of winner user IDs
 * @param {object} env - Environment variables
 * @returns {Promise<boolean>} True if successful
 */
export async function recordWinners(giveawayId, winners, env) {
	const sheetName = "GiveawayWinners";
	const token = await getGoogleAuthToken(env);
	const winDate = new Date().toISOString();

	try {
		const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}/values/${sheetName}!A1:append?valueInputOption=USER_ENTERED`;

		const values = winners.map((userId) => [giveawayId, userId, winDate]);

		const response = await fetch(appendUrl, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ values }),
		});

		return response.ok;
	} catch (e) {
		console.error("Error in recordWinners:", e);
		return false;
	}
}

/**
 * Selects random winners from giveaway participants.
 * @param {string} giveawayId - The giveaway ID
 * @param {number} winnersCount - Number of winners to select
 * @param {object} env - Environment variables
 * @returns {Promise<Array<string>>} Array of winner user IDs
 */
export async function selectWinners(giveawayId, winnersCount, env) {
	const participants = await getGiveawayParticipants(giveawayId, env);

	if (participants.length === 0) return [];

	// Get recent winners to exclude for fairness
	const recentWinners = await getRecentWinners(env);
	const eligibleParticipants = participants.filter(
		(userId) => !recentWinners.includes(userId)
	);

	// If no eligible participants after filtering, use all participants
	const finalParticipants =
		eligibleParticipants.length > 0 ? eligibleParticipants : participants;

	// Shuffle array and take the first N participants as winners
	const shuffled = finalParticipants.sort(() => 0.5 - Math.random());
	const selectedWinners = shuffled.slice(
		0,
		Math.min(winnersCount, finalParticipants.length)
	);

	// Record the winners
	if (selectedWinners.length > 0) {
		await recordWinners(giveawayId, selectedWinners, env);
	}

	return selectedWinners;
}

/**
 * Updates giveaway status (e.g., from "active" to "ended").
 * @param {string} giveawayId - The giveaway ID
 * @param {string} status - New status
 * @param {object} env - Environment variables
 * @returns {Promise<boolean>} True if successful
 */
export async function updateGiveawayStatus(giveawayId, status, env) {
	const sheetName = "Giveaways";
	const token = await getGoogleAuthToken(env);

	try {
		// Find the row with this giveaway ID
		const findRange = `${sheetName}!A:A`;
		const findUrl = `https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}/values/${findRange}`;

		const findResponse = await fetch(findUrl, {
			headers: { Authorization: `Bearer ${token}` },
		});
		const findData = await findResponse.json();
		const rows = findData.values || [];
		const rowIndex = rows.findIndex((row) => row[0] === giveawayId);

		if (rowIndex === -1) return false;

		// Update the status column (column K, index 10)
		const updateRange = `${sheetName}!K${rowIndex + 1}`;
		const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}/values/${updateRange}?valueInputOption=USER_ENTERED`;

		const updateResponse = await fetch(updateUrl, {
			method: "PUT",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ values: [[status]] }),
		});

		return updateResponse.ok;
	} catch (e) {
		console.error("Error in updateGiveawayStatus:", e);
		return false;
	}
}

/**
 * Gets all active giveaways that have ended.
 * @param {object} env - Environment variables
 * @returns {Promise<Array<object>>} Array of ended giveaways
 */
export async function getEndedGiveaways(env) {
	const sheetName = "Giveaways";
	const token = await getGoogleAuthToken(env);
	const range = `${sheetName}!A:K`;
	const url = `https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}/values/${range}`;

	try {
		const response = await fetch(url, {
			headers: { Authorization: `Bearer ${token}` },
		});
		const data = await response.json();
		const rows = data.values || [];
		const now = new Date();

		return rows
			.slice(1) // Skip header
			.filter((row) => {
				const status = row[10] || "active";
				const endTime = new Date(row[5]);
				return status === "active" && endTime <= now;
			})
			.map((row) => ({
				id: row[0],
				title: row[1],
				description: row[2],
				prize: row[3],
				winnersCount: parseInt(row[4], 10),
				endTime: row[5],
				channelId: row[6],
				messageId: row[7],
				creatorId: row[8],
				createdAt: row[9],
				status: row[10] || "active",
			}));
	} catch (e) {
		console.error("Error in getEndedGiveaways:", e);
		return [];
	}
}
