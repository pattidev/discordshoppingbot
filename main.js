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
import { SignJWT, importPKCS8 } from "jose";

// We use 'discord-interactions' to easily verify incoming webhooks from Discord.
import {
	InteractionType,
	InteractionResponseType,
	verifyKey,
} from "discord-interactions";

// --- Main Worker Entry Point
export default {
	async fetch(request, env, ctx) {
		// A worker's fetch handler is the main entry point for all requests.
		if (request.method !== "POST") {
			return new Response(
				"Hello! This is a Discord bot. It only accepts POST requests from Discord.",
				{ status: 200 }
			);
		}

		// // Log environment variables for debugging
		// console.log("Environment variables check:", {
		// 	DISCORD_PUBLIC_KEY: env.DISCORD_PUBLIC_KEY ? "set" : "not set",
		// 	DISCORD_BOT_TOKEN: env.DISCORD_BOT_TOKEN ? "set" : "not set",
		// 	DISCORD_CLIENT_ID: env.DISCORD_CLIENT_ID ? "set" : "not set",
		// 	SPREADSHEET_ID: env.SPREADSHEET_ID ? "set" : "not set",
		// 	GDRIVE_API_CREDENTIALS: env.GDRIVE_API_CREDENTIALS ? "set" : "not set",
		// });

		// 1. Verify the request is from Discord - CORRECTED BACK TO LOWERCASE
		const signature = request.headers.get("x-signature-ed25519");
		const timestamp = request.headers.get("x-signature-timestamp");
		const body = await request.text();

		// Log request details for debugging
		// console.log("Request details:", {
		// 	signature: signature ? "present" : "missing",
		// 	timestamp: timestamp ? "present" : "missing",
		// 	bodyLength: body.length,
		// 	contentType: request.headers.get("content-type"),
		// 	userAgent: request.headers.get("user-agent"),
		// 	bodyPreview: body.substring(0, 100),
		// });

		const isValidRequest = await verifyKey(
			body,
			signature,
			timestamp,
			env.DISCORD_PUBLIC_KEY
		);

		console.log("Signature verification result:", isValidRequest);

		if (!isValidRequest) {
			console.error("Invalid request signature");
			console.log("Verification failed details:", {
				signaturePresent: !!signature,
				timestampPresent: !!timestamp,
				publicKeyPresent: !!env.DISCORD_PUBLIC_KEY,
				publicKeyLength: env.DISCORD_PUBLIC_KEY
					? env.DISCORD_PUBLIC_KEY.length
					: 0,
			});
			return new Response("Bad request signature.", { status: 401 });
		}

		const interaction = JSON.parse(body);
		console.log("Interaction type:", interaction.type);
		// 2. Handle different interaction types
		try {
			switch (interaction.type) {
				case InteractionType.PING:
					// Discord pings to check if the endpoint is alive.
					console.log("Handling PING interaction - sending PONG");
					return new Response(
						JSON.stringify({ type: InteractionResponseType.PONG }),
						{
							headers: { "Content-Type": "application/json" },
						}
					);
				case InteractionType.APPLICATION_COMMAND:
					// This is a slash command.
					return await handleApplicationCommand(interaction, env, ctx);

				case InteractionType.MESSAGE_COMPONENT:
					// This is a button click.
					return await handleMessageComponent(interaction, env, ctx);

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
async function handleApplicationCommand(interaction, env, ctx) {
	const commandName = interaction.data.name;

	switch (commandName) {
		case "balance":
			return await handleBalanceCommand(interaction, env);
		case "shop":
			return await handleShopCommand(interaction, env, ctx);
		case "equip":
			return await handleEquipCommand(interaction, env, ctx);
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
async function handleMessageComponent(interaction, env, ctx) {
	const customId = interaction.data.custom_id;

	if (customId.startsWith("buy_")) {
		return await handleBuyButton(interaction, env, ctx);
	} else if (customId.startsWith("equip_select")) {
		return await handleEquipSelect(interaction, env, ctx);
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
async function handleShopCommand(interaction, env, ctx) {
	// Use waitUntil to perform async tasks after responding.
	ctx.waitUntil(
		(async () => {
			const userId = interaction.member.user.id;
			const items = await getItems(env);

			if (!items || items.length === 0) {
				await editInteractionResponse(interaction, env, {
					content: "The shop is currently empty.",
					flags: 64,
				});
				return;
			}

			const balance = await getCurrency(userId, env);
			const { embed, components } = await buildShopMessage(items, balance, 0);

			await editInteractionResponse(interaction, env, {
				embeds: [embed],
				components: components,
				flags: 64, // Ephemeral
			});
		})()
	);

	// Immediately return a deferred response to avoid timeout.
	return new Response(
		JSON.stringify({
			type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
			data: {
				flags: 64, // Ephemeral
			},
		}),
		{ headers: { "Content-Type": "application/json" } }
	);
}

/**
 * Handles the /equip command.
 */
async function handleEquipCommand(interaction, env, ctx) {
	ctx.waitUntil(
		(async () => {
			const userId = interaction.member.user.id;
			const unlockedRoles = await getUnlockedRoles(userId, env);
			const allItems = await getItems(env);
			console.log(`User ${userId} has unlocked roles:`, unlockedRoles);
			if (!unlockedRoles || unlockedRoles.length === 0) {
				await editInteractionResponse(interaction, env, {
					content:
						"You have not purchased any roles yet. Use `/shop` to see available roles.",
					flags: 64,
				});
				return;
			}

			const options = unlockedRoles
				.map((roleId) => {
					const item = allItems.find((i) => i.role_id === roleId);
					if (!item) return null;
					return {
						label: item.name,
						value: item.role_id,
						description: `Equip the ${item.name} role.`,
					};
				})
				.filter(Boolean);

			if (options.length === 0) {
				await editInteractionResponse(interaction, env, {
					content:
						"It seems your purchased roles are no longer available in the shop. Please contact an admin.",
					flags: 64,
				});
				return;
			}

			const components = [
				{
					type: 1, // Action Row
					components: [
						{
							type: 3, // String Select
							custom_id: "equip_select",
							placeholder: "Choose a role to equip",
							options: options,
						},
					],
				},
			];

			await editInteractionResponse(interaction, env, {
				content: "Select a role you own to apply it to your profile.",
				components: components,
				flags: 64,
			});
		})()
	);

	return new Response(
		JSON.stringify({
			type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
			data: { flags: 64 },
		}),
		{ headers: { "Content-Type": "application/json" } }
	);
}

// --- Component Logic ---

/**
 * Handles the "Buy" button click.
 */
async function handleBuyButton(interaction, env, ctx) {
	const userId = interaction.member.user.id;
	const roleIdToBuy = interaction.data.custom_id.split("_")[1];

	// Defer the response to avoid timeout
	const deferredPromise = new Response(
		JSON.stringify({
			type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
			data: { flags: 64 },
		}),
		{ headers: { "Content-Type": "application/json" } }
	);

	ctx.waitUntil(
		(async () => {
			const items = await getItems(env);
			const itemToBuy = items.find((item) => item.role_id === roleIdToBuy);

			if (!itemToBuy) {
				await editInteractionResponse(interaction, env, {
					content: "This item is no longer available.",
					flags: 64,
				});
				return;
			}
			// Check if user already owns the role
			const unlockedRoles = await getUnlockedRoles(userId, env);
			if (unlockedRoles.includes(roleIdToBuy)) {
				await editInteractionResponse(interaction, env, {
					content: "You already own this item.",
					flags: 64,
				});
				return;
			}

			const currentBalance = await getCurrency(userId, env);

			if (currentBalance < itemToBuy.price) {
				await editInteractionResponse(interaction, env, {
					content: "You do not have enough coins to purchase this item.",
					flags: 64,
				});
				return;
			}

			const newBalance = currentBalance - itemToBuy.price;
			const currencyUpdated = await updateCurrency(userId, newBalance, env);
			if (!currencyUpdated) {
				await editInteractionResponse(interaction, env, {
					content: "There was an error updating your balance. Purchase failed.",
					flags: 64,
				});
				return;
			}

			const roleUnlocked = await addUnlockedRole(
				userId,
				itemToBuy.role_id,
				env
			);
			if (!roleUnlocked) {
				// Attempt to refund user if unlocking fails
				await updateCurrency(userId, currentBalance, env);
				await editInteractionResponse(interaction, env, {
					content:
						"There was an error saving your purchase. Your coins have been refunded.",
					flags: 64,
				});
				return;
			}

			await editInteractionResponse(interaction, env, {
				content: `You have successfully purchased the **${itemToBuy.name}** role! Use the \`/equip\` command to apply it.`,
				flags: 64,
			});
		})()
	);

	return deferredPromise;
}

/**
 * Handles the role selection from the /equip command.
 */
async function handleEquipSelect(interaction, env, ctx) {
	const userId = interaction.member.user.id;
	const guildId = interaction.guild_id;
	const roleIdToEquip = interaction.data.values[0];

	// Defer the update to give us time to process
	const deferredPromise = new Response(
		JSON.stringify({ type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE }),
		{ headers: { "Content-Type": "application/json" } }
	);

	ctx.waitUntil(
		(async () => {
			try {
				const currentEquippedRole = await getEquippedRole(userId, env);
				console.log(
					`Current equipped role for user ${userId}:`,
					currentEquippedRole
				);
				// If user is trying to equip the same role, do nothing.
				if (currentEquippedRole === roleIdToEquip) {
					await editInteractionResponse(interaction, env, {
						content: "You already have this role equipped.",
						components: [], // Remove the dropdown
						flags: 64,
					});
					return;
				}

				// Remove the old role if it exists
				if (currentEquippedRole) {
					await removeRoleFromUser(userId, currentEquippedRole, guildId, env);
				}

				// Add the new role
				const roleAssigned = await addRoleToUser(
					userId,
					roleIdToEquip,
					guildId,
					env
				);
				if (!roleAssigned) {
					await editInteractionResponse(interaction, env, {
						content:
							"Failed to apply the new role. Please check bot permissions and try again.",
						components: [],
						flags: 64,
					});
					// Try to re-add the old role if it existed, to prevent user from being role-less
					if (currentEquippedRole) {
						await addRoleToUser(userId, currentEquippedRole, guildId, env);
					}
					return;
				}

				// Update the database
				await setEquippedRole(userId, roleIdToEquip, env);

				const allItems = await getItems(env);
				const equippedItem = allItems.find((i) => i.role_id === roleIdToEquip);
				const roleName = equippedItem ? equippedItem.name : "the selected role";

				await editInteractionResponse(interaction, env, {
					content: `You have successfully equipped the **${roleName}** role!`,
					components: [], // Remove the dropdown after selection
					flags: 64,
				});
			} catch (error) {
				console.error("Error in handleEquipSelect:", error);
				await editInteractionResponse(interaction, env, {
					content: "An unexpected error occurred while equipping the role.",
					components: [],
					flags: 64,
				});
			}
		})()
	);

	return deferredPromise;
}

/**
 * Edits the original interaction response.
 * @param {object} interaction - The interaction object from Discord.
 * @param {object} env - The Cloudflare Worker environment variables.
 * @param {object} data - The new message data.
 */
async function editInteractionResponse(interaction, env, data) {
	const url = `https://discord.com/api/v10/webhooks/${env.DISCORD_CLIENT_ID}/${interaction.token}/messages/@original`;

	try {
		const response = await fetch(url, {
			method: "PATCH",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(data),
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error(
				"Failed to edit interaction response:",
				response.status,
				errorText
			);
		}
	} catch (error) {
		console.error("Error editing interaction response:", error);
	}
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
async function createJWT(payload, privateKeyPem) {
	// Create header
	const header = {
		alg: "RS256",
		typ: "JWT",
	};

	// Base64URL encode
	const base64UrlEncode = (obj) => {
		return btoa(JSON.stringify(obj))
			.replace(/\+/g, "-")
			.replace(/\//g, "_")
			.replace(/=/g, "");
	};

	const encodedHeader = base64UrlEncode(header);
	const encodedPayload = base64UrlEncode(payload);
	const message = `${encodedHeader}.${encodedPayload}`;

	// Import private key
	const pemHeader = "-----BEGIN PRIVATE KEY-----";
	const pemFooter = "-----END PRIVATE KEY-----";
	const pemContents = privateKeyPem
		.replace(pemHeader, "")
		.replace(pemFooter, "")
		.replace(/\s/g, "");

	const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

	const cryptoKey = await crypto.subtle.importKey(
		"pkcs8",
		binaryDer,
		{
			name: "RSASSA-PKCS1-v1_5",
			hash: "SHA-256",
		},
		false,
		["sign"]
	);

	// Sign
	const signature = await crypto.subtle.sign(
		"RSASSA-PKCS1-v1_5",
		cryptoKey,
		new TextEncoder().encode(message)
	);

	// Encode signature
	const encodedSignature = btoa(
		String.fromCharCode(...new Uint8Array(signature))
	)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=/g, "");

	return `${message}.${encodedSignature}`;
}

/**
 * Gets a Google API auth token, using a cached one if available and not expired.
 * @param {object} env - The Cloudflare Worker environment variables.
 * @returns {Promise<string>} The Google API access token.
 */
async function getGoogleAuthToken(env) {
	if (googleAuthToken && Date.now() < tokenExpiry) {
		return googleAuthToken;
	}

	try {
		const credentials = JSON.parse(env.GDRIVE_API_CREDENTIALS);
		const scope =
			"https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive";
		const aud = "https://oauth2.googleapis.com/token";

		const now = Math.floor(Date.now() / 1000);

		const payload = {
			iss: credentials.client_email,
			scope: scope,
			aud: aud,
			iat: now,
			exp: now + 3600,
		};

		const jwt = await createJWT(payload, credentials.private_key);

		const response = await fetch(aud, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`HTTP ${response.status}: ${errorText}`);
		}

		const tokenData = await response.json();
		if (!tokenData.access_token) {
			console.error("Failed to get Google auth token:", tokenData);
			throw new Error(
				"Could not authenticate with Google: " +
					(tokenData.error_description || tokenData.error || "Unknown error")
			);
		}

		googleAuthToken = tokenData.access_token;
		tokenExpiry = Date.now() + (tokenData.expires_in - 60) * 1000;

		return googleAuthToken;
	} catch (error) {
		console.error("Error getting Google auth token:", error);
		throw new Error("Google authentication failed: " + error.message);
	}
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

/**
 * Adds a record of a purchased role for a user.
 * @param {string} userId - The Discord user's ID.
 * @param {string} roleId - The role ID purchased.
 * @param {object} env - The Cloudflare Worker environment variables.
 * @returns {Promise<boolean>} True if successful.
 */
async function addUnlockedRole(userId, roleId, env) {
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
async function getUnlockedRoles(userId, env) {
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
async function getEquippedRole(userId, env) {
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
async function setEquippedRole(userId, roleId, env) {
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

// --- Discord API Helpers ---

/**
 * Adds a role to a user via the Discord API.
 * @param {string} userId - The Discord user's ID.
 * @param {string} roleId - The role ID to assign.
 * @param {string} guildId - The guild (server) ID.
 * @param {object} env - The Cloudflare Worker environment variables.
 * @returns {Promise<boolean>} True if the role was successfully assigned, false otherwise.
 */
async function addRoleToUser(userId, roleId, guildId, env) {
	const url = `https://discord.com/api/v10/guilds/${guildId}/members/${userId}/roles/${roleId}`;

	try {
		const response = await fetch(url, {
			method: "PUT",
			headers: {
				Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
				"Content-Type": "application/json",
				"X-Audit-Log-Reason": "Role equipped via shop bot",
			},
		});
		if (response.ok || response.status === 204) {
			console.log(`Successfully added role ${roleId} to user ${userId}`);
			return true;
		} else {
			const errorText = await response.text();
			console.error(
				`Failed to add role ${roleId} to user ${userId}:`,
				response.status,
				errorText
			);
			return false;
		}
	} catch (error) {
		console.error("Error adding role to user:", error);
		return false;
	}
}

/**
 * Removes a role from a user via the Discord API.
 * @param {string} userId - The Discord user's ID.
 * @param {string} roleId - The role ID to remove.
 * @param {string} guildId - The guild (server) ID.
 * @param {object} env - The Cloudflare Worker environment variables.
 * @returns {Promise<boolean>} True if the role was successfully removed, false otherwise.
 */
async function removeRoleFromUser(userId, roleId, guildId, env) {
	const url = `https://discord.com/api/v10/guilds/${guildId}/members/${userId}/roles/${roleId}`;

	try {
		const response = await fetch(url, {
			method: "DELETE",
			headers: {
				Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
				"X-Audit-Log-Reason": "Role unequipped via shop bot",
			},
		});
		if (response.ok || response.status === 204) {
			console.log(`Successfully removed role ${roleId} from user ${userId}`);
			return true;
		} else {
			const errorText = await response.text();
			console.error(
				`Failed to remove role ${roleId} from user ${userId}:`,
				response.status,
				errorText
			);
			return false;
		}
	} catch (error) {
		console.error("Error removing role from user:", error);
		return false;
	}
}
