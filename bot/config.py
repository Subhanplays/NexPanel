import os


DISCORD_BOT_TOKEN = os.getenv("DISCORD_BOT_TOKEN", "")
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000/api/v1")
API_KEY = os.getenv("API_KEY", "")
DISCORD_GUILD_ID = os.getenv("DISCORD_GUILD_ID")
COMMAND_PREFIX = os.getenv("COMMAND_PREFIX", "!")
