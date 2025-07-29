# Discord Economy Bot

A serverless Discord bot for community engagement using Cloudflare Workers and Google Sheets as a database.

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange)](https://workers.cloudflare.com/)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES2022+-yellow)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Google Sheets API](https://img.shields.io/badge/Google%20Sheets-API-green)](https://developers.google.com/sheets/api)

## Overview

This Discord bot implements a virtual economy system where community members earn currency through daily rewards and gambling, then spend it on cosmetic Discord roles. It demonstrates serverless architecture patterns and unconventional but practical technology choices.

**Key Features:**
- Zero-cost hosting on Cloudflare Workers free tier
- Google Sheets as database for non-technical administration  
- Interactive Discord components (buttons, dropdowns, embeds)
- Multi-role equipment system with role conflict resolution

## Commands

- **`/balance`** - Check current coin balance
- **`/shop`** - Browse and purchase roles with pagination
- **`/equip`** - Equip multiple purchased roles simultaneously  
- **`/unequip`** - Remove specific roles or unequip all roles
- **`/daily`** - Claim daily coin reward (24-hour cooldown)
- **`/leaderboard`** - View top coin earners
- **`/coinflip <amount>`** - Gamble coins (once per day)
- **`/giveaway create/end/reroll`** - Manage community giveaways

## Architecture

### Technology Stack
- **Runtime**: Cloudflare Workers (serverless JavaScript)
- **Database**: Google Sheets API
- **Authentication**: Service Account JWT
- **Discord Integration**: Discord Interactions API

### Design Decisions

**Google Sheets as Database**
- **Pros**: Visual data management, zero administration overhead, collaborative editing, built-in backup
- **Cons**: API rate limits (~100 requests/minute), not suitable for high-frequency writes
- **Use case**: Community tools where non-technical users need direct data access

**Cloudflare Workers for Hosting**  
- **Pros**: Global edge deployment, generous free tier (100k requests/day), zero server management
- **Cons**: JavaScript-only runtime, 10ms CPU time limit, cold start latency
- **Use case**: Event-driven applications with burst traffic patterns

### Project Structure
```
src/
├── index.js                 # Request handling and routing
├── handlers/                # Command and component handlers
│   ├── commands/            # Slash command implementations
│   └── components/          # Button/dropdown handlers
├── services/                # Business logic and data access
└── utils/                   # Authentication and utilities
```

## Google Sheets Schema

The bot requires 7 sheets with specific column layouts:

| Sheet | Columns | Purpose |
|-------|---------|---------|
| `Currency` | UserID, Balance | Coin balances |
| `Items` | Name, Price, RoleID, ImageFilename, Description | Shop inventory |
| `UserRoles` | UserID, RoleID | Purchase history |
| `EquippedRoles` | UserID, RoleID | Currently active roles |
| `DailyRewards` | UserID, LastClaimDate | Daily reward cooldowns |
| `CoinflipUsage` | UserID, LastUsageDate | Gambling limits |
| `Leaderboard` | UserID, TotalEarned, DailyClaims | Ranking data |

## Installation

### Prerequisites
- Discord Application with Bot Token
- Google Cloud Project with Sheets API enabled
- Cloudflare account
- Node.js 18+

### Setup

1. **Clone and install dependencies**
   ```bash
   git clone https://github.com/pattidev/discordshoppingbot.git
   cd discordshoppingbot
   npm install
   npm install --save-dev wrangler
   ```

2. **Configure Google Sheets API**
   - Create Google Cloud Project
   - Enable Google Sheets API and Google Drive API
   - Create Service Account with Editor role
   - Download JSON credentials
   - Share your Google Sheet with the service account email

3. **Set environment variables**
   ```bash
   npx wrangler secret put DISCORD_PUBLIC_KEY
   npx wrangler secret put DISCORD_BOT_TOKEN  
   npx wrangler secret put DISCORD_CLIENT_ID
   npx wrangler secret put SPREADSHEET_ID
   npx wrangler secret put GDRIVE_API_CREDENTIALS
   ```

4. **Register Discord commands**
   ```bash
   node register-commands.js
   ```

5. **Deploy to Cloudflare Workers**
   ```bash
   npx wrangler deploy
   ```

6. **Configure Discord webhook**
   - Copy worker URL to Discord Developer Portal
   - Set as "Interactions Endpoint URL"

## Performance Metrics

- **Response Time**: <200ms average (global edge deployment)
- **Uptime**: 99.9%+ (Cloudflare SLA)
- **Cost**: $0/month under 100k requests/day
- **Scalability**: Automatic scaling for traffic spikes

## When to Use This Architecture

**Ideal for:**
- Community projects with budget constraints
- Non-technical administrators requiring data access
- Applications with burst traffic patterns
- Global user bases requiring low latency

**Consider alternatives for:**
- High-frequency database operations (>100 writes/second)
- Complex business logic requiring long processing times
- Applications needing persistent connections
- Teams with dedicated DevOps resources

## Documentation

- [Module Structure Guide](docs/MODULE_STRUCTURE.md) - Code organization details
- [Technical Case Study](docs/CASE_STUDY.md) - Architecture deep dive

## License

Apache License 2.0 - See LICENSE file for details.
