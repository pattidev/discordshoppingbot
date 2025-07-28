# Giveaway System Setup

## 📋 Google Sheets Setup

You need to create two new tabs in your existing Google Spreadsheet:

### 1. "Giveaways" Sheet
Create a tab called "Giveaways" with these columns (row 1):
- **A1**: `giveaway_id`
- **B1**: `title`
- **C1**: `description`
- **D1**: `prize`
- **E1**: `winners_count`
- **F1**: `end_time`
- **G1**: `channel_id`
- **H1**: `message_id`
- **I1**: `creator_id`
- **J1**: `created_at`
- **K1**: `status`

### 2. "GiveawayParticipants" Sheet
Create a tab called "GiveawayParticipants" with these columns (row 1):
- **A1**: `giveaway_id`
- **B1**: `user_id`
- **C1**: `joined_at`

## 🎮 Commands Available

### `/giveaway create`
Creates a new giveaway with the following options:
- **title**: The giveaway title (required)
- **prize**: What the winner(s) will receive (required)
- **duration**: Duration in minutes (required, 1-10080 max)
- **winners**: Number of winners (optional, default: 1, max: 20)
- **description**: Additional description (optional)

**Example**: `/giveaway create title:"Free Role" prize:"Premium Role" duration:60 winners:2`

### `/giveaway end`
Manually ends a giveaway and selects winners:
- **id**: The giveaway ID (required)

**Example**: `/giveaway end id:1704067200000`

### `/giveaway reroll`
Rerolls winners for an already ended giveaway:
- **id**: The giveaway ID (required)

**Example**: `/giveaway reroll id:1704067200000`

## 🎯 How It Works

1. **Creating Giveaways**: Admins use `/giveaway create` to set up new giveaways
2. **Entering**: Users click the "🎉 Enter Giveaway" button to participate
3. **Automatic Tracking**: All participants are stored in the Google Sheet
4. **Winner Selection**: Random winners are selected when the giveaway ends
5. **Results**: Winners are announced with user mentions

## 🔧 Features

- **Duplicate Prevention**: Users can only enter each giveaway once
- **Random Selection**: Fair random winner selection inspired by your Python script
- **Database Storage**: All data stored in Google Sheets like other bot features
- **Rich Embeds**: Beautiful Discord embeds with timestamps and formatting
- **Error Handling**: Comprehensive error handling and user feedback
- **Reroll System**: Ability to reroll winners if needed

## 🚀 Getting Giveaway IDs

When you create a giveaway, the bot will generate a unique ID (timestamp-based). You can:
1. Check your Google Sheet's "Giveaways" tab for the ID in column A
2. Use the ID for ending or rerolling giveaways

## 🎨 Embed Colors

- **Active Giveaway**: Red (#ff6b6b)
- **Ended Giveaway**: Green (#4caf50) 
- **Rerolled Giveaway**: Gold (#ffd700)

## 📝 Data Structure

The system follows the same modular pattern as your existing bot:
- **Service Layer**: `giveawayService.js` handles all database operations
- **Command Layer**: `giveawayCommand.js` handles slash commands
- **Component Layer**: `giveawayButton.js` handles button interactions
- **Google Sheets**: Stores all giveaway and participant data

This giveaway system integrates seamlessly with your existing Discord shopping bot and uses the same Google Sheets backend for consistency!
