/**
 * Item Service - Handles shop item operations
 */

import { getGoogleAuthToken } from "../utils/googleAuth.js";

/**
 * Retrieves the list of all available items from the "Items" sheet.
 * @param {object} env - The Cloudflare Worker environment variables.
 * @returns {Promise<Array<object>>} A list of item objects.
 */
export async function getItems(env) {
	const sheetName = "Items";
	const token = await getGoogleAuthToken(env);
	const range = `${sheetName}!A2:E`; // Start from row 2 to skip headers
	const url = `https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}/values/${range}`;

	try {
		const response = await fetch(url, {
			headers: { Authorization: `Bearer ${token}` },
		});
		const data = await response.json();
		const rows = data.values || [];

		return rows
			.map((row) => ({
				name: row[0] || "Unnamed Item",
				price: parseInt(row[1], 10) || 999999,
				role_id: row[2] || "0",
				image_filename: row[3] || null, // Now used for image support
				description: row[4] || "No description available.", // Now used for descriptions
			}))
			.filter((item) => item.role_id !== "0"); // Filter out invalid items
	} catch (e) {
		console.error("Error in getItems:", e);
		return [];
	}
}

/**
 * Gets the image URL for an item, supporting Discord CDN links and other direct URLs.
 * @param {string} imageIdentifier - A direct image URL (Discord CDN, etc.) or Google Drive file ID.
 * @returns {Promise<string|null>} The image URL or null if not available.
 */
export async function getImageUrl(imageIdentifier) {
	if (!imageIdentifier) return null;

	// Check if it's already a direct URL (Discord CDN, HTTP/HTTPS)
	if (
		imageIdentifier.startsWith("http://") ||
		imageIdentifier.startsWith("https://")
	) {
		return imageIdentifier;
	}

	// Check if it's a Discord CDN link without protocol
	if (
		imageIdentifier.startsWith("cdn.discordapp.com/") ||
		imageIdentifier.startsWith("media.discordapp.net/")
	) {
		return `https://${imageIdentifier}`;
	}

	// Assume it's a Google Drive file ID and construct the direct link
	// Format: https://drive.google.com/uc?id=FILE_ID&export=view
	if (imageIdentifier.length > 10) {
		// Basic check for Drive file ID format
		return `https://drive.google.com/uc?id=${imageIdentifier}&export=view`;
	}

	return null;
}
