# Discord Shopping Bot - Modular Structure

## Project Structure

```
src/
├── index.js                 # Main entry point and request handling
├── handlers/                # Request handlers
│   ├── commandHandler.js    # Slash command routing
│   ├── componentHandler.js  # Button/component routing
│   ├── commands/            # Individual command handlers
│   │   ├── index.js
│   │   ├── balanceCommand.js
│   │   ├── shopCommand.js
│   │   ├── equipCommand.js
│   │   ├── unequipCommand.js
│   │   ├── dailyCommand.js
│   │   ├── leaderboardCommand.js
│   │   ├── coinflipCommand.js
│   │   └── giveawayCommand.js
│   └── components/          # Individual component handlers
│       ├── index.js
│       ├── buyButton.js
│       ├── equipSelect.js
│       ├── unequipSelect.js
│       ├── giveawayButton.js
│       └── shopNavigation.js
├── services/                # Business logic services
│   ├── currencyService.js   # User currency management
│   ├── itemService.js       # Shop item management
│   ├── userRoleService.js   # User role management (multi-role support)
│   ├── dailyRewardService.js # Daily reward system
│   ├── coinflipService.js   # Coinflip gambling system
│   ├── leaderboardService.js # Leaderboard functionality
│   ├── giveawayService.js   # Giveaway management
│   └── discordApiService.js # Discord API operations
├── utils/                   # Utility functions
│   ├── googleAuth.js        # Google Sheets authentication
│   ├── discordUtils.js      # Discord utility functions
│   └── permissions.js       # Permission checking utilities
└── ui/                      # UI builders
    └── shopBuilder.js       # Shop interface builder
```

## Key Benefits of the Modular Structure

### 1. **Separation of Concerns**
- **Handlers**: Route requests and manage interaction flow
- **Services**: Contain business logic and data operations
- **Utils**: Provide shared utility functions
- **UI**: Build user interface components

### 2. **Maintainability**
- Each module has a single responsibility
- Easy to locate and modify specific functionality
- Changes in one module don't affect others

### 3. **Testability**
- Individual modules can be tested in isolation
- Services can be mocked for testing handlers
- Clear interfaces between modules

### 4. **Scalability**
- New commands can be added by creating new command handlers
- New services can be added without modifying existing code
- Easy to extend functionality

## Module Descriptions

### Handlers
- **commandHandler.js**: Routes slash commands to appropriate handlers
- **componentHandler.js**: Routes button clicks and select menus to handlers
- **commands/**: Individual command implementations (balance, shop, equip, unequip, etc.)
- **components/**: Individual component implementations (buy button, equip select, unequip select, etc.)

### Services
- **currencyService.js**: Manages user coin balances
- **itemService.js**: Handles shop items and images
- **userRoleService.js**: Manages user role purchases and equipment (supports multiple equipped roles)
- **dailyRewardService.js**: Handles daily reward claims
- **coinflipService.js**: Manages coinflip gambling
- **leaderboardService.js**: Tracks user earnings and rankings
- **giveawayService.js**: Handles giveaway creation and management
- **discordApiService.js**: Handles Discord API calls (role assignment)

### Utils
- **googleAuth.js**: Handles Google Sheets API authentication with JWT
- **discordUtils.js**: Common Discord interaction utilities

### UI
- **shopBuilder.js**: Builds shop interface embeds and components

## Environment Variables

The bot requires the following environment variables in Cloudflare Workers:

- `DISCORD_PUBLIC_KEY`: Your Discord application's public key
- `DISCORD_BOT_TOKEN`: Your Discord bot's token
- `DISCORD_CLIENT_ID`: Your Discord application's client ID
- `SPREADSHEET_ID`: The ID of your Google Sheet
- `GDRIVE_API_CREDENTIALS`: JSON credentials for your Google Service Account

## Google Sheets Setup

The bot expects the following sheets in your Google Spreadsheet:

1. **Currency**: User coin balances (UserID, Balance)
2. **Items**: Shop items (Name, Price, RoleID, ImageFilename, Description)
3. **UserRoles**: Purchased roles (UserID, RoleID)
4. **EquippedRoles**: Currently equipped roles (UserID, RoleID)
5. **DailyRewards**: Daily reward claims (UserID, LastClaimDate)
6. **CoinflipUsage**: Coinflip usage tracking (UserID, LastUsageDate)
7. **Leaderboard**: User earnings tracking (UserID, TotalEarned, DailyClaims)

## Commands

- `/balance` - Check your coin balance
- `/shop` - Browse the role shop
- `/equip` - Equip multiple purchased roles simultaneously
- `/unequip` - Remove specific equipped roles or unequip all
- `/daily` - Claim daily coin reward
- `/leaderboard` - View top earners
- `/coinflip <amount>` - Gamble coins on a coinflip
- `/giveaway create/end/reroll` - Manage community giveaways

## Development

To add new commands:
1. Create a new command handler in `src/handlers/commands/`
2. Add the export to `src/handlers/commands/index.js`
3. Add the route in `src/handlers/commandHandler.js`
4. Register the command in `register-commands.js`

To add new components:
1. Create a new component handler in `src/handlers/components/`
2. Add the export to `src/handlers/components/index.js`
3. Add the route in `src/handlers/componentHandler.js`

To add new services:
1. Create a new service file in `src/services/`
2. Import and use in relevant handlers

The modular structure makes it easy to maintain and extend the bot's functionality while keeping the code organized and clean.
