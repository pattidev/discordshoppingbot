/**
 * Welcome to your Discord bot's home on Cloudflare Workers!
 *
 * This single file contains all the logic for a Discord shop bot that uses Google Sheets as a database.
 * It handles slash commands, button interactions, and communicates with the Google Sheets API.
 *
 * How to use this:
 * 1. Create a new Cloudflare Worker.
 * 2. Paste this entire code into the worker's editor.
 * 3. Set up the required Environment Variables in your Worker's settings (see below).
 * 4. Use the "Deploy" button.
 * 5. Take the worker's URL (e.g., `your-worker.your-subdomain.workers.dev`) and set it as the
 * "Interactions Endpoint URL" in your Discord Developer Portal application.
 *
 * Required Environment Variables (Set in Cloudflare Dashboard -> Workers -> Your Worker -> Settings -> Variables):
 * - DISCORD_PUBLIC_KEY: Your Discord application's public key.
 * - DISCORD_BOT_TOKEN: Your Discord bot's token. Used for API calls like adding roles.
 * - DISCORD_CLIENT_ID: Your Discord application's client ID.
 * - SPREADSHEET_ID: The ID of your Google Sheet. Found in the sheet's URL.
 * - GDRIVE_API_CREDENTIALS: The JSON credentials for your Google Service Account.
 * - Create a service account in the Google Cloud Console.
 * - Enable the Google Sheets and Google Drive APIs.
 * - Share your Google Sheet with the service account's email address.
 * - Generate a JSON key for the service account and paste its entire content as the value for this variable.
 */

// We use the 'jose' library for signing the JWT for Google API authentication.
// It's a modern, platform-agnostic JWT library.
import { SignJWT } from "jose";

// We use 'discord-interactions' to easily verify incoming webhooks from Discord.
import {
	InteractionType,
	InteractionResponseType,
	verifyKey,
} from "discord-interactions";

// --- Main Worker Entry Point ---
export default {
	async fetch(request, env, ctx) {
		// A worker's fetch handler is the main entry point for all requests.
		if (request.method !== "POST") {
			return new Response(
				"Hello! This is a Discord bot. It only accepts POST requests from Discord.",
				{ status: 200 }
			);
		}

		// 1. Verify the request is from Discord
		const signature = request.headers.get("x-signature-ed25519");
		const timestamp = request.headers.get("x-signature-timestamp");
		const body = await request.text();

		const isValidRequest = verifyKey(
			body,
			signature,
			timestamp,
			env.DISCORD_PUBLIC_KEY
		);

		if (!isValidRequest) {
			console.error("Invalid request signature");
			return new Response("Bad request signature.", { status: 401 });
		}

		const interaction = JSON.parse(body);

		// 2. Handle different interaction types
		try {
			switch (interaction.type) {
				case InteractionType.PING:
					// Discord pings to check if the endpoint is alive.
					return new Response(
						JSON.stringify({ type: InteractionResponseType.PONG }),
						{
							headers: { "Content-Type": "application/json" },
						}
					);

				case InteractionType.APPLICATION_COMMAND:
					// This is a slash command.
					return await handleApplicationCommand(interaction, env);

				case InteractionType.MESSAGE_COMPONENT:
					// This is a button click.
					return await handleMessageComponent(interaction, env);

				default:
					console.error("Unknown interaction type:", interaction.type);
					return new Response("Unknown interaction type.", { status: 400 });
			}
		} catch (error) {
			console.error("Error handling interaction:", error);
			// Generic error response
			return new Response(
				JSON.stringify({
					type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
					data: {
						content:
							"Oops! Something went wrong while processing your request.",
						flags: 64, // Ephemeral flag
					},
				}),
				{ headers: { "Content-Type": "application/json" } }
			);
		}
	},
};

// --- Interaction Handlers ---

/**
 * Handles incoming slash commands from Discord.
 * @param {object} interaction The interaction object from Discord.
 * @param {object} env The Cloudflare Worker environment variables.
 */
async function handleApplicationCommand(interaction, env) {
	const commandName = interaction.data.name;

	switch (commandName) {
		case "balance":
			return await handleBalanceCommand(interaction, env);
		case "shop":
			return await handleShopCommand(interaction, env);
		default:
			console.error(`Unknown command: ${commandName}`);
			return new Response(`Unknown command: ${commandName}`, { status: 400 });
	}
}

/**
 * Handles incoming button clicks from Discord.
 * @param {object} interaction The interaction object from Discord.
 * @param {object} env The Cloudflare Worker environment variables.
 */
async function handleMessageComponent(interaction, env) {
	const customId = interaction.data.custom_id;

	if (customId.startsWith("buy_")) {
		return await handleBuyButton(interaction, env);
	} else if (
		customId.startsWith("prev_page_") ||
		customId.startsWith("next_page_")
	) {
		return await handlePageTurn(interaction, env);
	} else {
		console.error(`Unknown component custom_id: ${customId}`);
		return new Response(`Unknown component: ${customId}`, { status: 400 });
	}
}

// --- Command Logic ---

/**
 * Handles the /balance command.
 */
async function handleBalanceCommand(interaction, env) {
	const userId = interaction.member.user.id;
	const userAvatar = `https://cdn.discordapp.com/avatars/${userId}/${interaction.member.user.avatar}.png`;

	const balance = await getCurrency(userId, env);

	const embed = {
		title: "💰 Your Balance",
		description: `You currently have **${balance.toLocaleString()} coins**`,
		color: 0xffd700, // Gold
		thumbnail: { url: userAvatar },
		footer: { text: "Use /shop to browse available items" },
	};

	return new Response(
		JSON.stringify({
			type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
			data: {
				embeds: [embed],
				flags: 64, // Ephemeral flag (only visible to the user)
			},
		}),
		{ headers: { "Content-Type": "application/json" } }
	);
}

/**
 * Handles the /shop command.
 */
async function handleShopCommand(interaction, env) {
	const userId = interaction.member.user.id;
	const items = await getItems(env);

	if (!items || items.length === 0) {
		return new Response(
			JSON.stringify({
				type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
				data: { content: "The shop is currently empty.", flags: 64 },
			}),
			{ headers: { "Content-Type": "application/json" } }
		);
	}

	const balance = await getCurrency(userId, env);
	const { embed, components } = await buildShopMessage(items, balance, 0);

	return new Response(
		JSON.stringify({
			type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
			data: {
				embeds: [embed],
				components: components,
				flags: 64, // Ephemeral
			},
		}),
		{ headers: { "Content-Type": "application/json" } }
	);
}

// --- Component Logic ---

/**
 * Handles the "Buy" button click.
 */
async function handleBuyButton(interaction, env) {
	const userId = interaction.member.user.id;
	const roleIdToBuy = interaction.data.custom_id.split("_")[1];

	const items = await getItems(env);
	const itemToBuy = items.find((item) => item.role_id === roleIdToBuy);

	if (!itemToBuy) {
		return new Response(
			JSON.stringify({
				type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
				data: { content: "This item is no longer available.", flags: 64 },
			}),
			{ headers: { "Content-Type": "application/json" } }
		);
	}

	const currentBalance = await getCurrency(userId, env);

	if (currentBalance < itemToBuy.price) {
		return new Response(
			JSON.stringify({
				type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
				data: {
					content: "You do not have enough coins to purchase this item.",
					flags: 64,
				},
			}),
			{ headers: { "Content-Type": "application/json" } }
		);
	}

	const newBalance = currentBalance - itemToBuy.price;
	const success = await updateCurrency(userId, newBalance, env);

	if (!success) {
		return new Response(
			JSON.stringify({
				type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
				data: {
					content:
						"There was an error updating your balance. Please try again.",
					flags: 64,
				},
			}),
			{ headers: { "Content-Type": "application/json" } }
		);
	}

	// Note: The original python script mentioned role adding would be handled elsewhere.
	// To add a role, you would make a call to the Discord API here.
	// Example: await addRoleToUser(userId, itemToBuy.role_id, interaction.guild_id, env);

	return new Response(
		JSON.stringify({
			type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
			data: {
				content: `You have successfully purchased the **${
					itemToBuy.name
				}** role! Your new balance is ${newBalance.toLocaleString()} coins.`,
				flags: 64,
			},
		}),
		{ headers: { "Content-Type": "application/json" } }
	);
}

/**
 * Handles the "Previous" and "Next" page buttons in the shop.
 */
async function handlePageTurn(interaction, env) {
	const customId = interaction.data.custom_id;
	const currentPage = parseInt(customId.split("_").pop(), 10);
	const direction = customId.includes("next") ? 1 : -1;
	const newPage = currentPage + direction;

	const items = await getItems(env);
	const balance = await getCurrency(interaction.member.user.id, env); // Refetch balance in case it changed

	const { embed, components } = await buildShopMessage(items, balance, newPage);

	// Update the original message with the new page content
	return new Response(
		JSON.stringify({
			type: InteractionResponseType.UPDATE_MESSAGE,
			data: {
				embeds: [embed],
				components: components,
			},
		}),
		{ headers: { "Content-Type": "application/json" } }
	);
}

// --- UI Builder ---

/**
 * Constructs the shop embed and buttons for a specific page.
 * @param {Array} items - The list of all shop items.
 * @param {number} balance - The user's current coin balance.
 * @param {number} page - The current page number (0-indexed).
 * @returns {object} An object containing the embed and components.
 */
async function buildShopMessage(items, balance, page) {
	const itemsPerPage = 3;
	const totalPages = Math.ceil(items.length / itemsPerPage);
	const pageIndex = Math.max(0, Math.min(page, totalPages - 1)); // Clamp page index

	const startIndex = pageIndex * itemsPerPage;
	const endIndex = startIndex + itemsPerPage;
	const pageItems = items.slice(startIndex, endIndex);

	const embed = {
		title: "🛒 Role Shop",
		description: "Browse and purchase roles with your currency!",
		color: 0x3498db, // Blue
		fields: [
			{
				name: "Your Balance",
				value: `**${balance.toLocaleString()} coins**`,
				inline: true,
			},
			{ name: "Page", value: `${pageIndex + 1}/${totalPages}`, inline: true },
		],
		footer: {
			text: "Items you can afford are shown with a green 'Buy' button.",
		},
	};

	const itemComponents = pageItems.map((item) => ({
		type: 2, // Button component type
		style: balance >= item.price ? 3 : 4, // 3 = Green (Success), 4 = Red (Destructive)
		label: `Buy ${item.name} (${item.price.toLocaleString()} coins)`,
		custom_id: `buy_${item.role_id}`,
		disabled: balance < item.price,
	}));

	const navigationButtons = {
		type: 1, // Action Row component type
		components: [
			{
				type: 2,
				style: 2,
				label: "◀️ Previous",
				custom_id: `prev_page_${pageIndex}`,
				disabled: pageIndex === 0,
			},
			{
				type: 2,
				style: 2,
				label: "Next ▶️",
				custom_id: `next_page_${pageIndex}`,
				disabled: pageIndex >= totalPages - 1,
			},
		],
	};

	const components = [];
	if (itemComponents.length > 0) {
		components.push({ type: 1, components: itemComponents });
	}
	components.push(navigationButtons);

	return { embed, components };
}

// --- Google Sheets API Helpers ---

// A simple in-memory cache for the Google Auth Token to avoid regenerating it on every request.
// Cloudflare may spin down idle workers, so this cache is not guaranteed to persist for long.
let googleAuthToken = null;
let tokenExpiry = 0;

/**
 * Gets a Google API auth token, using a cached one if available and not expired.
 * @param {object} env - The Cloudflare Worker environment variables.
 * @returns {Promise<string>} The Google API access token.
 */
async function getGoogleAuthToken(env) {
	if (googleAuthToken && Date.now() < tokenExpiry) {
		return googleAuthToken;
	}

	const credentials = JSON.parse(env.GDRIVE_API_CREDENTIALS);
	const scope =
		"https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive";
	const aud = "https://oauth2.googleapis.com/token";

	// Import the private key
	const privateKey = await crypto.subtle.importKey(
		"pkcs8",
		((str) => {
			const r = str.replace(/(-{5}[^-]+-{5})|\s/g, "");
			const b = atob(r);
			const a = new Uint8Array(b.length);
			for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i);
			return a;
		})(credentials.private_key),
		{ name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
		false,
		["sign"]
	);

	const now = Math.floor(Date.now() / 1000);
	const jwt = await new SignJWT({ scope })
		.setProtectedHeader({ alg: "RS256", typ: "JWT" })
		.setIssuedAt(now)
		.setExpirationTime(now + 3600)
		.setIssuer(credentials.client_email)
		.setAudience(aud)
		.sign(privateKey);

	const response = await fetch(aud, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
	});

	const tokenData = await response.json();
	if (!tokenData.access_token) {
		console.error("Failed to get Google auth token:", tokenData);
		throw new Error("Could not authenticate with Google.");
	}

	googleAuthToken = tokenData.access_token;
	tokenExpiry = Date.now() + (tokenData.expires_in - 60) * 1000; // Refresh 60s before expiry

	return googleAuthToken;
}

/**
 * Retrieves the currency balance for a given user ID.
 * If the user doesn't exist in the sheet, they are created with a balance of 0.
 * @param {string} userId - The Discord user's ID.
 * @param {object} env - The Cloudflare Worker environment variables.
 * @returns {Promise<number>} The user's currency balance.
 */
async function getCurrency(userId, env) {
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
async function updateCurrency(userId, amount, env) {
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

/**
 * Retrieves the list of all available items from the "Items" sheet.
 * @param {object} env - The Cloudflare Worker environment variables.
 * @returns {Promise<Array<object>>} A list of item objects.
 */
async function getItems(env) {
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
				// image_filename: row[3] || null, // Not used in this version
				// description: row[4] || 'No description available.', // Not used in this version
			}))
			.filter((item) => item.role_id !== "0"); // Filter out invalid items
	} catch (e) {
		console.error("Error in getItems:", e);
		return [];
	}
}
