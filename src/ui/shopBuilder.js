/**
 * Shop UI Builder - Creates shop interface components
 */

import { getImageUrl } from "../services/itemService.js";

/**
 * Constructs the shop embed and buttons for a specific page.
 * @param {Array} items - The list of all shop items.
 * @param {number} balance - The user's current coin balance.
 * @param {number} page - The current page number (0-indexed, -1 for summary).
 * @returns {object} An object containing the embed and components.
 */
export async function buildShopMessage(items, balance, page) {
	// Page -1 is the summary page showing all items
	if (page === -1) {
		return await buildSummaryPage(items, balance);
	}

	const itemsPerPage = 1; // Individual item pages
	const totalPages = Math.ceil(items.length / itemsPerPage);
	const pageIndex = Math.max(0, Math.min(page, totalPages - 1)); // Clamp page index

	const startIndex = pageIndex * itemsPerPage;
	const endIndex = startIndex + itemsPerPage;
	const pageItems = items.slice(startIndex, endIndex);

	const embed = {
		title: "💸 Role Shop - Item Details",
		description: "Detailed view of the selected item",
		color: 0x3498db, // Blue
		fields: [
			{
				name: "Your Balance",
				value: `**${balance.toLocaleString()} coins**`,
				inline: true,
			},
			{ name: "Item", value: `${pageIndex + 1}/${totalPages}`, inline: true },
		],
		footer: {
			text: "Use 'Back to Summary' to see all items at once.",
		},
	};

	// Add item fields with descriptions and role mentions
	for (let i = 0; i < pageItems.length; i++) {
		const item = pageItems[i];
		let fieldValue = `**Role:** <@&${
			item.role_id
		}>\n**Price:** ${item.price.toLocaleString()} coins`;

		if (item.description && item.description !== "No description available.") {
			fieldValue += `\n**Description:** ${item.description}`;
		}

		if (balance < item.price) {
			fieldValue += "\n❌ *Not enough coins*";
		} else {
			fieldValue += "\n✅ *Available for purchase*";
		}

		embed.fields.push({
			name: `${item.name}`,
			value: fieldValue,
			inline: false,
		});
	}

	// Add the current item's image as the main embed image if available
	if (pageItems.length > 0 && pageItems[0].image_filename) {
		const imageUrl = await getImageUrl(pageItems[0].image_filename);
		if (imageUrl) {
			embed.image = { url: imageUrl };
		}
	}

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
				style: 1, // Primary style for summary button
				label: "📋 Back to Summary",
				custom_id: `summary_page`,
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

/**
 * Builds the summary page showing all items at once.
 * @param {Array} items - The list of all shop items.
 * @param {number} balance - The user's current coin balance.
 * @returns {object} An object containing the embed and components.
 */
async function buildSummaryPage(items, balance) {
	const embed = {
		title: "🛒 Role Shop - Summary",
		description:
			"Overview of all available roles. Click 'View Details' to see individual items with images.",
		color: 0x3498db, // Blue
		fields: [
			{
				name: "Your Balance",
				value: `**${balance.toLocaleString()} coins**`,
				inline: true,
			},
			{
				name: "Available Items",
				value: `**${items.length}** role${
					items.length === 1 ? "" : "s"
				} available`,
				inline: true,
			},
		],
		footer: {
			text: "Green items are affordable • Red items need more coins",
		},
	};

	// Add a field for each item in the summary
	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		const canAfford = balance >= item.price;
		const statusIcon = canAfford ? "✅" : "❌";

		let fieldValue = `<@&${
			item.role_id
		}> - **${item.price.toLocaleString()} coins** ${statusIcon}`;

		if (item.description && item.description !== "No description available.") {
			// Truncate long descriptions for summary
			const shortDesc =
				item.description.length > 50
					? item.description.substring(0, 47) + "..."
					: item.description;
			fieldValue += `\n*${shortDesc}*`;
		}

		embed.fields.push({
			name: `${i + 1}. ${item.name}`,
			value: fieldValue,
			inline: true,
		});
	}

	// Create buttons for detailed view and quick buy options
	const components = [];

	// View Details button
	components.push({
		type: 1,
		components: [
			{
				type: 2,
				style: 1, // Primary
				label: "🔍 View Item Details",
				custom_id: `view_details_0`,
			},
		],
	});

	// Add quick buy buttons for affordable items (max 5 buttons per row, max 25 total)
	const affordableItems = items
		.filter((item) => balance >= item.price)
		.slice(0, 20);

	if (affordableItems.length > 0) {
		const buttonRows = [];
		for (let i = 0; i < affordableItems.length; i += 5) {
			const rowItems = affordableItems.slice(i, i + 5);
			const buttons = rowItems.map((item) => ({
				type: 2,
				style: 3, // Success (green)
				label: `Buy ${item.name}`,
				custom_id: `buy_${item.role_id}`,
			}));

			buttonRows.push({
				type: 1,
				components: buttons,
			});
		}

		components.push(...buttonRows);
	}

	return { embed, components };
}
