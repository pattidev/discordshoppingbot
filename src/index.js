/**
 * Discord Shop Bot - Cloudflare Worker Entry Point
 *
 * This is the main entry point for the Discord bot running on Cloudflare Workers.
 * It handles request verification and routes interactions to appropriate handlers.
 */

import {
	InteractionType,
	InteractionResponseType,
	verifyKey,
} from "discord-interactions";

import { handleApplicationCommand } from "./handlers/commandHandler.js";
import { handleMessageComponent } from "./handlers/componentHandler.js";

export default {
	async fetch(request, env, ctx) {
		// Only accept POST requests from Discord
		if (request.method !== "POST") {
			return new Response(
				"Hello! This is a Discord bot. It only accepts POST requests from Discord.",
				{ status: 200 }
			);
		}

		// Verify the request is from Discord
		const signature = request.headers.get("x-signature-ed25519");
		const timestamp = request.headers.get("x-signature-timestamp");
		const body = await request.text();

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

		// Handle different interaction types
		try {
			switch (interaction.type) {
				case InteractionType.PING:
					// Discord pings to check if the endpoint is alive
					console.log("Handling PING interaction - sending PONG");
					return new Response(
						JSON.stringify({ type: InteractionResponseType.PONG }),
						{
							headers: { "Content-Type": "application/json" },
						}
					);

				case InteractionType.APPLICATION_COMMAND:
					// This is a slash command
					return await handleApplicationCommand(interaction, env, ctx);

				case InteractionType.MESSAGE_COMPONENT:
					// This is a button click or select menu
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
