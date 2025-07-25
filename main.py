import discohook
from discohook import Button, ButtonStyle, View, Embed
import gspread
from oauth2client.service_account import ServiceAccountCredentials
import os
from dotenv import load_dotenv
import json
from aiohttp import web

# Load environment variables
load_dotenv()

# Discohook application setup
app = discohook.Client(
    client_id=os.getenv("DISCORD_CLIENT_ID"),
    public_key=os.getenv("DISCORD_PUBLIC_KEY"),
    token=os.getenv("DISCORD_BOT_TOKEN"),
)

# Google Sheets setup
scope = [
    "https://spreadsheets.google.com/feeds",
    "https://www.googleapis.com/auth/drive",
]
creds_data = json.loads(os.getenv("GDRIVE_API_CREDENTIALS"))
creds = ServiceAccountCredentials.from_json_keyfile_dict(creds_data, scope)
client = gspread.authorize(creds)
sheet = client.open("Currency_Shop_Database")
currency_sheet = sheet.worksheet("Currency")
items_sheet = sheet.worksheet("Items")

# Helper functions
def get_currency(user_id):
    try:
        cell = currency_sheet.find(str(user_id))
        if cell:
            return int(currency_sheet.cell(cell.row, 2).value)
        else:
            next_row = len(currency_sheet.get_all_values()) + 1
            currency_sheet.update_cell(next_row, 1, str(user_id))
            currency_sheet.update_cell(next_row, 2, "0")
            return 0
    except Exception as e:
        print(f"Error getting currency: {e}")
        return 0

def update_currency(user_id, amount):
    try:
        cell = currency_sheet.find(str(user_id))
        if cell:
            currency_sheet.update_cell(cell.row, 2, str(amount))
            return True
        return False
    except Exception as e:
        print(f"Error updating currency: {e}")
        return False

def get_items():
    try:
        items = []
        rows = items_sheet.get_all_values()[1:]
        for row in rows:
            if len(row) >= 3:
                image_filename = row[3] if len(row) > 3 and row[3] else None
                description = (
                    row[4] if len(row) > 4 and row[4] else "No description available."
                )
                items.append(
                    {
                        "name": row[0],
                        "price": int(row[1]),
                        "role_id": int(row[2]),
                        "image_filename": image_filename,
                        "description": description,
                    }
                )
        return items
    except Exception as e:
        print(f"Error getting items: {e}")
        return []

@app.command(name="balance", description="Check your coin balance.")
async def balance(i: discohook.Interaction):
    user_id = str(i.author.id)
    balance_val = get_currency(user_id)
    embed = Embed(
        title="💰 Your Balance",
        description=f"You currently have **{balance_val:,} coins**",
        color=0xFFD700,  # Gold
    )
    embed.set_thumbnail(url=i.author.avatar.url)
    embed.set_footer(text="Use /shop to browse available items")
    await i.response.send(embed=embed, ephemeral=True)

class ShopView(View):
    def __init__(self, items, page=0):
        super().__init__(timeout=180)
        self.items = items
        self.page = page
        self.items_per_page = 3
        self.total_pages = (len(items) + self.items_per_page - 1) // self.items_per_page
        self.update_buttons()

    def update_buttons(self):
        self.clear_items()
        start = self.page * self.items_per_page
        end = start + self.items_per_page
        for item in self.items[start:end]:
            self.add_item(BuyButton(item))
        
        nav_row = View()
        nav_row.add_item(Button(style=ButtonStyle.gray, label="◀️", custom_id=f"prev_page_{self.page}", disabled=self.page == 0))
        nav_row.add_item(Button(style=ButtonStyle.gray, label="▶️", custom_id=f"next_page_{self.page}", disabled=self.page >= self.total_pages - 1))
        self.add_item(nav_row)

class BuyButton(Button):
    def __init__(self, item):
        super().__init__(style=ButtonStyle.green, label=f"Buy {item['name']}", custom_id=f"buy_{item['role_id']}")
        self.item = item

    async def callback(self, i: discohook.Interaction):
        user_id = str(i.author.id)
        balance = get_currency(user_id)
        price = self.item["price"]
        if balance >= price:
            new_balance = balance - price
            update_currency(user_id, new_balance)
            # Assuming the role adding logic will be handled by a separate service or bot with guild access
            await i.response.send(
                f"You have successfully purchased the {self.item['name']} role!",
                ephemeral=True,
            )
        else:
            await i.response.send(
                "You do not have enough coins to purchase this role.", ephemeral=True
            )

@app.command(name="shop", description="Browse the item shop.")
async def shop(i: discohook.Interaction):
    items = get_items()
    if not items:
        await i.response.send("The shop is currently empty.", ephemeral=True)
        return

    view = ShopView(items)
    embed = Embed(
        title="🛒 Role Shop",
        description="Browse and purchase roles with your currency!",
        color=0x3498DB,  # Blue
    )
    balance_val = get_currency(str(i.author.id))
    embed.add_field(name="Your Balance", value=f"**{balance_val:,} coins**", inline=True)
    embed.add_field(name="Page", value=f"1/{view.total_pages}", inline=True)
    
    await i.response.send(embed=embed, view=view, ephemeral=True)

@app.on_button_click("prev_page", "next_page")
async def on_page_turn(i: discohook.Interaction, custom_id: str):
    page = int(custom_id.split("_")[-1])
    direction = 1 if "next" in custom_id else -1
    new_page = page + direction
    
    items = get_items()
    view = ShopView(items, page=new_page)
    
    embed = i.message.embeds[0]
    embed.fields[1]["value"] = f"{new_page + 1}/{view.total_pages}" # Update page number
    
    await i.response.update_message(embed=embed, view=view)


# Web server setup
async def handle_interactions(request):
    data = await request.json()
    signature = request.headers.get("X-Signature-Ed25519")
    timestamp = request.headers.get("X-Signature-Timestamp")
    
    if not signature or not timestamp:
        return web.Response(status=401)
        
    try:
        await app.process_request(data, signature, timestamp)
        return web.Response(status=200)
    except Exception as e:
        print(f"Error processing request: {e}")
        return web.Response(status=500)

server = web.Application()
server.router.add_post("/interactions", handle_interactions)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    web.run_app(server, port=port)