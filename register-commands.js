const { REST, Routes } = require("discord.js");

// Your Discord bot credentials
const CLIENT_ID = "1398373714029973535";
const BOT_TOKEN =
	"MTM5ODM3MzcxNDAyOTk3MzUzNQ.GTFNWs.bpL8CQ4TqWALMDDYGCCi0N9yYuKorfCQywD870";
const GUILD_ID = "1374851182245187707"; // Optional: for guild-specific commands (faster testing)

const commands = [
	{
		name: "balance",
		description: "Check your current coin balance",
	},
	{
		name: "shop",
		description: "Browse and purchase roles from the shop",
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
