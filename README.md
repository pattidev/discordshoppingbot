# Discord Bot - Cloudflare Worker

This is a Discord bot that has been converted to a serverless application using Cloudflare Workers, `discohook` for interactions, and Google Sheets as a database.

## Features

- `/balance`: Check your coin balance.
- `/shop`: Browse and purchase roles from the shop.

## Setup

1.  **Clone the repository:**
    ```bash
    git clone <repository_url>
    cd <repository_directory>
    ```

2.  **Install dependencies:**
    Make sure you have Python and pip installed.
    ```bash
    pip install -r requirements.txt
    ```

3.  **Set up environment variables:**
    Create a `.env` file in the root of the project and add the following variables. You can use the `.env.example` as a template.

    ```
    DISCORD_CLIENT_ID=<your_discord_client_id>
    DISCORD_PUBLIC_KEY=<your_discord_public_key>
    DISCORD_BOT_TOKEN=<your_discord_bot_token>
    GDRIVE_API_CREDENTIALS=<your_gdrive_api_credentials_json_string>
    ```
    
    **Note on `GDRIVE_API_CREDENTIALS`**: This should be the JSON content of your Google service account credentials file, as a single line string.

## Generating Google Sheet Credentials

To allow the bot to access your Google Sheet, you need to create a service account in the Google Cloud Platform and share the sheet with it.

1.  **Create a Google Cloud Project:**
    *   Go to the [Google Cloud Console](https://console.cloud.google.com/).
    *   Create a new project (or select an existing one).

2.  **Enable APIs:**
    *   In your project, go to the "APIs & Services" > "Dashboard".
    *   Click "+ ENABLE APIS AND SERVICES".
    *   Search for and enable the **Google Drive API**.
    *   Search for and enable the **Google Sheets API**.

3.  **Create a Service Account:**
    *   Go to "APIs & Services" > "Credentials".
    *   Click "+ CREATE CREDENTIALS" and select "Service account".
    *   Fill in a name for the service account (e.g., "discord-bot-sheets-updater").
    *   Click "CREATE AND CONTINUE".
    *   Grant the service account the `Editor` role to allow it to edit your sheets.
    *   Click "DONE".

4.  **Generate JSON Key:**
    *   On the "Credentials" page, click on the service account you just created.
    *   Go to the "KEYS" tab.
    *   Click "ADD KEY" and select "Create new key".
    *   Choose **JSON** as the key type and click "CREATE".
    *   A JSON file will be downloaded to your computer. This file contains your credentials.

5.  **Share Your Google Sheet:**
    *   Open the Google Sheet you want the bot to use.
    *   Click the "Share" button in the top-right corner.
    *   Copy the `client_email` from the downloaded JSON file. It will look something like `your-service-account-name@your-project-id.iam.gserviceaccount.com`.
    *   Paste this email into the sharing dialog, give it "Editor" permissions, and click "Share".

6.  **Set the Environment Variable:**
    *   Open the downloaded JSON file and copy its entire content.
    *   This entire JSON string is what you need to set as the `GDRIVE_API_CREDENTIALS` secret for your Cloudflare Worker. When running locally, you can paste it into your `.env` file.

## Local Development

To run the bot locally for testing, you can use the `aiohttp` server.

```bash
python main.py
```

This will start a local server. You'll need a tool like `ngrok` to expose this local server to the internet so Discord can send interactions to it.

## Deployment to Cloudflare Workers

This project is set up for deployment on Cloudflare Workers.

1.  **Install the Cloudflare Wrangler CLI:**
    ```bash
    npm install -g wrangler
    ```

2.  **Authenticate Wrangler:**
    ```bash
    wrangler login
    ```

3.  **Set up secrets:**
    You need to add your environment variables as secrets in Cloudflare.
    ```bash
    wrangler secret put DISCORD_CLIENT_ID
    wrangler secret put DISCORD_PUBLIC_KEY
    wrangler secret put DISCORD_BOT_TOKEN
    wrangler secret put GDRIVE_API_CREDENTIALS
    ```
    Wrangler will prompt you to enter the value for each secret.

4.  **Deploy the bot:**
    ```bash
    wrangler deploy
    ```

After deploying, Wrangler will give you a URL for your worker. You need to set this as the "Interactions Endpoint URL" in your Discord application settings in the developer portal.
