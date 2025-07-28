const { REST, Routes } = require("discord.js");
require("dotenv").config();

// Your Discord bot credentials
const CLIENT_ID = process.env.CLIENT_ID;
const BOT_TOKEN = process.env.BOT_TOKEN;
const GUILD_ID = process.env.GUILD_ID;

const commands = [
	{
		name: "balance",
		description: "Check your current coin balance",
	},
	{
		name: "shop",
		description: "Browse and purchase roles from the shop",
	},
	{
		name: "equip",
		description: "Equip a role you have purchased",
	},
	{
		name: "leaderboard",
		description: "View the top users by coin spending",
	},
	{
		name: "daily",
		description: "Claim your daily coins",
	},
	{
		name: "coinflip",
		description:
			"Bet coins on a coinflip - win double or lose it all! (Once per day)",
		options: [
			{
				name: "amount",
				description: "Amount of coins to bet",
				type: 4, // INTEGER type
				required: true,
				min_value: 1,
			},
		],
	},
	{
		name: "giveaway",
		description: "Manage giveaways",
		options: [
			{
				name: "create",
				description: "Create a new giveaway",
				type: 1, // SUB_COMMAND
				options: [
					{
						name: "title",
						description: "Giveaway title",
						type: 3, // STRING
						required: true,
					},
					{
						name: "prize",
						description: "What the winner(s) will receive",
						type: 3, // STRING
						required: true,
					},
					{
						name: "duration",
						description: "Duration in minutes",
						type: 4, // INTEGER
						required: true,
						min_value: 1,
						max_value: 10080, // 1 week max
					},
					{
						name: "winners",
						description: "Number of winners (default: 1)",
						type: 4, // INTEGER
						required: false,
						min_value: 1,
						max_value: 20,
					},
					{
						name: "description",
						description: "Giveaway description (optional)",
						type: 3, // STRING
						required: false,
					},
				],
			},
			{
				name: "end",
				description: "End a giveaway early and pick winners",
				type: 1, // SUB_COMMAND
				options: [
					{
						name: "id",
						description: "Giveaway ID",
						type: 3, // STRING
						required: true,
					},
				],
			},
			{
				name: "reroll",
				description: "Reroll winners for an ended giveaway",
				type: 1, // SUB_COMMAND
				options: [
					{
						name: "id",
						description: "Giveaway ID",
						type: 3, // STRING
						required: true,
					},
				],
			},
		],
	},
];

const rest = new REST({ version: "10" }).setToken(BOT_TOKEN);

(async () => {
	try {
		console.log("Started refreshing application (/) commands.");
		// For guild-specific commands (faster, good for testing)
		if (GUILD_ID) {
			await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
				body: commands,
			});
			console.log("Successfully reloaded guild application (/) commands.");
		} else {
			// For global commands (takes up to 1 hour to propagate)
			await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
			console.log("Successfully reloaded global application (/) commands.");
		}
	} catch (error) {
		console.error(error);
	}
})();
