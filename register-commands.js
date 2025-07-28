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
