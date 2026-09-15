from __future__ import annotations

import logging
import os
import traceback
from typing import Optional

import discord
from discord import app_commands
from discord.ext import commands

from bot.api_client import APIClient, APIError, api_client
from bot.config import COMMAND_PREFIX, DISCORD_BOT_TOKEN, DISCORD_GUILD_ID
from bot.views import (
    ConfirmView,
    DeployWizardView,
    OSSelectView,
    PasswordModal,
    VPSControlView,
)

logger = logging.getLogger(__name__)

# ── Helpers ────────────────────────────────────────────────────

STATUS_COLORS: dict[str, int] = {
    "running": 0x22C55E,
    "stopped": 0xEF4444,
    "creating": 0xF59E0B,
    "error": 0xEF4444,
    "reinstalling": 0xF59E0B,
}

STATUS_EMOJI: dict[str, str] = {
    "running": "\u2705",
    "stopped": "\u274C",
    "creating": "\u23F3",
    "error": "\u26A0\uFE0F",
    "reinstalling": "\u23F3",
}


def _embed_color(status: str | None = None) -> int:
    return STATUS_COLORS.get(status or "", 0x3B82F6)


def _error_embed(msg: str) -> discord.Embed:
    return discord.Embed(title="Error", description=msg, color=0xEF4444)


def _success_embed(title: str, msg: str) -> discord.Embed:
    return discord.Embed(title=title, description=msg, color=0x22C55E)


def _info_embed(title: str) -> discord.Embed:
    return discord.Embed(title=title, color=0x3B82F6)


# ── Bot Setup ──────────────────────────────────────────────────

intents = discord.Intents.default()
intents.message_content = True

bot = commands.Bot(
    command_prefix=COMMAND_PREFIX,
    intents=intents,
    help_command=None,
)


# ── Sync ───────────────────────────────────────────────────────

@bot.event
async def on_ready():
    logger.info("Logged in as %s (ID: %s)", bot.user, bot.user.id)
    try:
        if DISCORD_GUILD_ID:
            guild = discord.Object(id=int(DISCORD_GUILD_ID))
            bot.tree.copy_global_to(guild=guild)
            synced = await bot.tree.sync(guild=guild)
        else:
            synced = await bot.tree.sync()
        logger.info("Synced %d command(s)", len(synced))
    except Exception:
        logger.error("Command sync failed:\n%s", traceback.format_exc())


# ── Error Handler ──────────────────────────────────────────────

@bot.tree.error
async def on_app_command_error(
    interaction: discord.Interaction, error: app_commands.AppCommandError
):
    if isinstance(error, app_commands.CommandOnCooldown):
        embed = _error_embed(f"Cooldown — try again in {error.retry_after:.1f}s")
    elif isinstance(error, app_commands.MissingPermissions):
        embed = _error_embed("You lack the required permissions.")
    elif isinstance(error, app_commands.NoPrivateMessage):
        embed = _error_embed("This command cannot be used in DMs.")
    else:
        embed = _error_embed(f"Unexpected error: {error}")
    try:
        if interaction.response.is_done():
            await interaction.followup.send(embed=embed, ephemeral=True)
        else:
            await interaction.response.send_message(embed=embed, ephemeral=True)
    except Exception:
        pass


# ── Utility checks ─────────────────────────────────────────────

def is_admin():
    async def predicate(interaction: discord.Interaction) -> bool:
        if not interaction.guild:
            raise app_commands.NoPrivateMessage()
        if not interaction.user.guild_permissions.administrator:
            raise app_commands.MissingPermissions(["administrator"])
        return True

    return app_commands.check(predicate)


# ── /help ──────────────────────────────────────────────────────

HELP_TEXT = """\
**Slash Commands**
`/deploy` — Launch a new VPS (interactive wizard)
`/vps` — List your VPS instances
`/vps_info <vps_id>` — Detailed VPS information
`/start <vps_id>` — Start a VPS
`/stop <vps_id>` — Stop a VPS
`/restart <vps_id>` — Restart a VPS
`/status <vps_id>` — Live metrics (CPU, RAM, disk)
`/terminal <vps_id>` — Terminal session info
`/ssh <vps_id>` — SSH connection details
`/delete <vps_id>` — Delete a VPS (with confirmation)
`/list_images` — Available OS images
`/help` — This message

**Prefix Commands**
`!vps` — List your VPS instances
`!deploy` — Launch a new VPS
`!help` — Show this help
"""


@bot.tree.command(name="help", description="Show all available commands")
async def slash_help(interaction: discord.Interaction):
    await interaction.response.send_message(embed=_info_embed("Help"), ephemeral=True)
    await interaction.followup.send(HELP_TEXT)


@bot.command(name="help")
async def prefix_help(ctx: commands.Context):
    await ctx.send(embed=_info_embed("Help"), delete_after=0.1)
    await ctx.send(HELP_TEXT)


# ── /deploy ────────────────────────────────────────────────────

async def _get_user_token(interaction: discord.Interaction) -> str | None:
    key = f"_token_{interaction.user.id}"
    return getattr(bot, "session_tokens", {}).get(key)


async def _require_token(interaction: discord.Interaction) -> str:
    token = await _get_user_token(interaction)
    if not token:
        embed = _error_embed(
            "Not authenticated. Use `/login` or prefix `!login <username> <password>` first."
        )
        try:
            if interaction.response.is_done():
                await interaction.followup.send(embed=embed, ephemeral=True)
            else:
                await interaction.response.send_message(embed=embed, ephemeral=True)
        except Exception:
            pass
        raise app_commands.CommandOnCooldown
    return token


@bot.tree.command(name="deploy", description="Deploy a new VPS instance")
@app_commands.describe()
async def slash_deploy(interaction: discord.Interaction):
    view = DeployWizardView()
    await interaction.response.send_message(
        embed=_info_embed("Deploy Wizard"),
        view=view,
        ephemeral=True,
    )
    await view.wait()
    if view.resources is None:
        try:
            await interaction.followup.send(
                embed=_error_embed("Deploy cancelled or invalid input."),
                ephemeral=True,
            )
        except Exception:
            pass
        return

    try:
        token = await _require_token(interaction)
    except app_commands.CommandOnCooldown:
        return

    try:
        result = await api_client.create_vps(token, view.resources)
        embed = discord.Embed(
            title="VPS Deployed",
            description=(
                f"**{result.get('name', 'Unknown')}**\n"
                f"ID: `{result.get('vps_id', 'N/A')}`\n"
                f"Status: {STATUS_EMOJI.get(result.get('status', ''), '')} `{result.get('status')}`"
            ),
            color=0x22C55E,
        )
        embed.add_field(name="OS", value=result.get("os_image", "N/A"), inline=True)
        embed.add_field(
            name="Specs",
            value=f"{result.get('cpu_cores')} CPU / {result.get('memory_gb')} GB RAM / {result.get('disk_gb')} GB Disk",
            inline=True,
        )
        await interaction.followup.send(embed=embed)
    except APIError as exc:
        await interaction.followup.send(embed=_error_embed(exc.detail))


@bot.command(name="deploy")
async def prefix_deploy(ctx: commands.Context):
    view = DeployWizardView()
    msg = await ctx.send(embed=_info_embed("Deploy Wizard"), view=view)
    await view.wait()
    if view.resources is None:
        await msg.edit(embed=_error_embed("Deploy cancelled or invalid input."), view=None)
        return

    token = getattr(bot, "session_tokens", {}).get(f"_token_{ctx.author.id}")
    if not token:
        await msg.edit(
            embed=_error_embed("Not authenticated. Use `!login <user> <pass>` first."),
            view=None,
        )
        return

    try:
        result = await api_client.create_vps(token, view.resources)
        embed = discord.Embed(
            title="VPS Deployed",
            description=(
                f"**{result.get('name', 'Unknown')}**\n"
                f"ID: `{result.get('vps_id', 'N/A')}`\n"
                f"Status: {STATUS_EMOJI.get(result.get('status', ''), '')} `{result.get('status')}`"
            ),
            color=0x22C55E,
        )
        await msg.edit(embed=embed, view=None)
    except APIError as exc:
        await msg.edit(embed=_error_embed(exc.detail), view=None)


# ── /vps ───────────────────────────────────────────────────────

async def _vps_list_embed(token: str, title: str = "Your VPS Instances") -> discord.Embed:
    vps_list = await api_client.list_vps(token)
    if not vps_list:
        return _info_embed("No VPS instances found.")

    embed = discord.Embed(title=title, color=0x3B82F6)
    for v in vps_list[:25]:
        status = v.get("status", "unknown")
        emoji = STATUS_EMOJI.get(status, "")
        embed.add_field(
            name=f"{emoji} {v.get('name', 'Unknown')}",
            value=(
                f"ID: `{v.get('vps_id', 'N/A')}`\n"
                f"Status: `{status}`\n"
                f"{v.get('cpu_cores', 0)} CPU / {v.get('memory_gb', 0)} GB / {v.get('disk_gb', 0)} GB"
            ),
            inline=True,
        )
    return embed


@bot.tree.command(name="vps", description="List your VPS instances")
async def slash_vps(interaction: discord.Interaction):
    try:
        token = await _require_token(interaction)
    except app_commands.CommandOnCooldown:
        return
    try:
        embed = await _vps_list_embed(token)
        await interaction.response.send_message(embed=embed)
    except APIError as exc:
        await interaction.response.send_message(embed=_error_embed(exc.detail))


@bot.command(name="vps")
async def prefix_vps(ctx: commands.Context):
    token = getattr(bot, "session_tokens", {}).get(f"_token_{ctx.author.id}")
    if not token:
        await ctx.send(embed=_error_embed("Not authenticated. Use `!login` first."))
        return
    try:
        embed = await _vps_list_embed(token)
        await ctx.send(embed=embed)
    except APIError as exc:
        await ctx.send(embed=_error_embed(exc.detail))


# ── /vps_info ──────────────────────────────────────────────────

async def _vps_info_embed(token: str, vps_id: str) -> discord.Embed:
    v = await api_client.get_vps(token, vps_id)
    status = v.get("status", "unknown")
    embed = discord.Embed(
        title=v.get("name", "VPS Details"),
        color=_embed_color(status),
    )
    embed.add_field(name="VPS ID", value=f"`{v.get('vps_id')}`", inline=True)
    embed.add_field(name="Status", value=f"{STATUS_EMOJI.get(status, '')} `{status}`", inline=True)
    embed.add_field(name="OS", value=v.get("os_image", "N/A"), inline=True)
    embed.add_field(
        name="Specs",
        value=f"{v.get('cpu_cores')} CPU / {v.get('memory_gb')} GB RAM / {v.get('disk_gb')} GB Disk",
        inline=True,
    )
    embed.add_field(name="Username", value=f"`{v.get('username')}`", inline=True)
    embed.add_field(name="Created", value=v.get("created_at", "N/A"), inline=False)

    tailscale = v.get("tailscale_ip")
    if tailscale:
        embed.add_field(name="Tailscale IP", value=f"`{tailscale}`", inline=True)
    tmate = v.get("tmate_session")
    if tmate:
        embed.add_field(name="tmate", value=f"`{tmate}`", inline=False)

    return embed


@bot.tree.command(name="vps_info", description="Get detailed VPS information")
@app_commands.describe(vps_id="The VPS identifier")
async def slash_vps_info(interaction: discord.Interaction, vps_id: str):
    try:
        token = await _require_token(interaction)
    except app_commands.CommandOnCooldown:
        return
    try:
        embed = await _vps_info_embed(token, vps_id)
        await interaction.response.send_message(embed=embed)
    except APIError as exc:
        await interaction.response.send_message(embed=_error_embed(exc.detail))


@bot.command(name="info")
async def prefix_vps_info(ctx: commands.Context, vps_id: Optional[str] = None):
    if not vps_id:
        await ctx.send(embed=_error_embed("Usage: `!info <vps_id>`"))
        return
    token = getattr(bot, "session_tokens", {}).get(f"_token_{ctx.author.id}")
    if not token:
        await ctx.send(embed=_error_embed("Not authenticated. Use `!login` first."))
        return
    try:
        embed = await _vps_info_embed(token, vps_id)
        await ctx.send(embed=embed)
    except APIError as exc:
        await ctx.send(embed=_error_embed(exc.detail))


# ── /start ─────────────────────────────────────────────────────

async def _vps_action(token: str, vps_id: str, action: str) -> tuple[discord.Embed, str]:
    func_map = {
        "start": api_client.start_vps,
        "stop": api_client.stop_vps,
        "restart": api_client.restart_vps,
    }
    func = func_map.get(action)
    if not func:
        raise ValueError(f"Unknown action: {action}")
    result = await func(token, vps_id)
    title = f"VPS {action.title()}"
    return _success_embed(title, result.get("message", "Done.")), action


@bot.tree.command(name="start", description="Start a VPS")
@app_commands.describe(vps_id="The VPS identifier")
async def slash_start(interaction: discord.Interaction, vps_id: str):
    try:
        token = await _require_token(interaction)
    except app_commands.CommandOnCooldown:
        return
    try:
        embed, _ = await _vps_action(token, vps_id, "start")
        await interaction.response.send_message(embed=embed)
    except APIError as exc:
        await interaction.response.send_message(embed=_error_embed(exc.detail))


@bot.tree.command(name="stop", description="Stop a VPS")
@app_commands.describe(vps_id="The VPS identifier")
async def slash_stop(interaction: discord.Interaction, vps_id: str):
    try:
        token = await _require_token(interaction)
    except app_commands.CommandOnCooldown:
        return
    try:
        embed, _ = await _vps_action(token, vps_id, "stop")
        await interaction.response.send_message(embed=embed)
    except APIError as exc:
        await interaction.response.send_message(embed=_error_embed(exc.detail))


@bot.tree.command(name="restart", description="Restart a VPS")
@app_commands.describe(vps_id="The VPS identifier")
async def slash_restart(interaction: discord.Interaction, vps_id: str):
    try:
        token = await _require_token(interaction)
    except app_commands.CommandOnCooldown:
        return
    try:
        embed, _ = await _vps_action(token, vps_id, "restart")
        await interaction.response.send_message(embed=embed)
    except APIError as exc:
        await interaction.response.send_message(embed=_error_embed(exc.detail))


@bot.command(name="start")
async def prefix_start(ctx: commands.Context, vps_id: Optional[str] = None):
    if not vps_id:
        await ctx.send(embed=_error_embed("Usage: `!start <vps_id>`"))
        return
    token = getattr(bot, "session_tokens", {}).get(f"_token_{ctx.author.id}")
    if not token:
        await ctx.send(embed=_error_embed("Not authenticated."))
        return
    try:
        embed, _ = await _vps_action(token, vps_id, "start")
        await ctx.send(embed=embed)
    except APIError as exc:
        await ctx.send(embed=_error_embed(exc.detail))


@bot.command(name="stop")
async def prefix_stop(ctx: commands.Context, vps_id: Optional[str] = None):
    if not vps_id:
        await ctx.send(embed=_error_embed("Usage: `!stop <vps_id>`"))
        return
    token = getattr(bot, "session_tokens", {}).get(f"_token_{ctx.author.id}")
    if not token:
        await ctx.send(embed=_error_embed("Not authenticated."))
        return
    try:
        embed, _ = await _vps_action(token, vps_id, "stop")
        await ctx.send(embed=embed)
    except APIError as exc:
        await ctx.send(embed=_error_embed(exc.detail))


@bot.command(name="restart")
async def prefix_restart(ctx: commands.Context, vps_id: Optional[str] = None):
    if not vps_id:
        await ctx.send(embed=_error_embed("Usage: `!restart <vps_id>`"))
        return
    token = getattr(bot, "session_tokens", {}).get(f"_token_{ctx.author.id}")
    if not token:
        await ctx.send(embed=_error_embed("Not authenticated."))
        return
    try:
        embed, _ = await _vps_action(token, vps_id, "restart")
        await ctx.send(embed=embed)
    except APIError as exc:
        await ctx.send(embed=_error_embed(exc.detail))


# ── /status ────────────────────────────────────────────────────

async def _vps_status_embed(token: str, vps_id: str) -> discord.Embed:
    v = await api_client.get_vps(token, vps_id)
    status = v.get("status", "unknown")

    embed = discord.Embed(
        title=f"Status — {v.get('name', vps_id)}",
        color=_embed_color(status),
    )
    embed.add_field(name="Status", value=f"{STATUS_EMOJI.get(status, '')} `{status}`", inline=True)
    embed.add_field(name="OS", value=v.get("os_image", "N/A"), inline=True)

    if status == "running":
        try:
            m = await api_client.get_vps_metrics(token, vps_id)
            embed.add_field(
                name="CPU",
                value=f"{m.get('cpu_percent', 0):.1f}%",
                inline=True,
            )
            mem_used = m.get("memory_used_mb", 0)
            mem_total = m.get("memory_limit_mb", 0)
            mem_pct = m.get("memory_percent", 0)
            embed.add_field(
                name="Memory",
                value=f"{mem_used} MB / {mem_total} MB ({mem_pct:.1f}%)",
                inline=True,
            )
            disk_used = m.get("disk_used_gb", 0)
            disk_total = m.get("disk_total_gb", 0)
            disk_pct = m.get("disk_percent", 0)
            embed.add_field(
                name="Disk",
                value=f"{disk_used} GB / {disk_total} GB ({disk_pct:.1f}%)",
                inline=True,
            )
            embed.add_field(name="PIDs", value=str(m.get("pids", 0)), inline=True)
            uptime = m.get("uptime_seconds", 0)
            h, rem = divmod(uptime, 3600)
            mins, _ = divmod(rem, 60)
            embed.add_field(name="Uptime", value=f"{int(h)}h {int(mins)}m", inline=True)
        except APIError:
            embed.add_field(name="Metrics", value="Unavailable", inline=True)
    else:
        embed.add_field(
            name="Metrics",
            value="VPS must be running to show metrics.",
            inline=False,
        )

    return embed


@bot.tree.command(name="status", description="Get VPS status and live metrics")
@app_commands.describe(vps_id="The VPS identifier")
async def slash_status(interaction: discord.Interaction, vps_id: str):
    try:
        token = await _require_token(interaction)
    except app_commands.CommandOnCooldown:
        return
    try:
        embed = await _vps_status_embed(token, vps_id)
        await interaction.response.send_message(embed=embed)
    except APIError as exc:
        await interaction.response.send_message(embed=_error_embed(exc.detail))


@bot.command(name="status")
async def prefix_status(ctx: commands.Context, vps_id: Optional[str] = None):
    if not vps_id:
        await ctx.send(embed=_error_embed("Usage: `!status <vps_id>`"))
        return
    token = getattr(bot, "session_tokens", {}).get(f"_token_{ctx.author.id}")
    if not token:
        await ctx.send(embed=_error_embed("Not authenticated."))
        return
    try:
        embed = await _vps_status_embed(token, vps_id)
        await ctx.send(embed=embed)
    except APIError as exc:
        await ctx.send(embed=_error_embed(exc.detail))


# ── /terminal ──────────────────────────────────────────────────

async def _terminal_embed(token: str, vps_id: str) -> discord.Embed:
    v = await api_client.get_vps(token, vps_id)
    embed = discord.Embed(
        title=f"Terminal — {v.get('name', vps_id)}",
        color=0x3B82F6,
    )

    tmate = v.get("tmate_session")
    sshx = v.get("sshx_session")

    if tmate:
        embed.add_field(
            name="tmate SSH",
            value=f"```\nssh {tmate}\n```",
            inline=False,
        )
    if sshx:
        embed.add_field(
            name="SSHX",
            value=f"```\n{sshx}\n```",
            inline=False,
        )

    if not tmate and not sshx:
        embed.add_field(
            name="Info",
            value="No terminal sessions available. Enable tmate or sshx when deploying.",
            inline=False,
        )

    return embed


@bot.tree.command(name="terminal", description="Get terminal connection info for a VPS")
@app_commands.describe(vps_id="The VPS identifier")
async def slash_terminal(interaction: discord.Interaction, vps_id: str):
    try:
        token = await _require_token(interaction)
    except app_commands.CommandOnCooldown:
        return
    try:
        embed = await _terminal_embed(token, vps_id)
        await interaction.response.send_message(embed=embed)
    except APIError as exc:
        await interaction.response.send_message(embed=_error_embed(exc.detail))


@bot.command(name="terminal")
async def prefix_terminal(ctx: commands.Context, vps_id: Optional[str] = None):
    if not vps_id:
        await ctx.send(embed=_error_embed("Usage: `!terminal <vps_id>`"))
        return
    token = getattr(bot, "session_tokens", {}).get(f"_token_{ctx.author.id}")
    if not token:
        await ctx.send(embed=_error_embed("Not authenticated."))
        return
    try:
        embed = await _terminal_embed(token, vps_id)
        await ctx.send(embed=embed)
    except APIError as exc:
        await ctx.send(embed=_error_embed(exc.detail))


# ── /ssh ───────────────────────────────────────────────────────

async def _ssh_embed(token: str, vps_id: str) -> discord.Embed:
    t = await api_client.get_vps_token(token, vps_id)
    ip = t.get("ip_address")
    embed = discord.Embed(
        title=f"SSH — {vps_id}",
        color=0x3B82F6,
    )
    if ip:
        embed.add_field(
            name="Connection",
            value=f"```\nssh {t.get('username', 'root')}@{ip}\n```",
            inline=False,
        )
        embed.add_field(name="IP Address", value=f"`{ip}`", inline=True)
    else:
        embed.add_field(
            name="IP",
            value="No public IP assigned. Use Tailscale or tmate.",
            inline=False,
        )
    embed.add_field(name="Username", value=f"`{t.get('username', 'N/A')}`", inline=True)
    return embed


@bot.tree.command(name="ssh", description="Get SSH connection details for a VPS")
@app_commands.describe(vps_id="The VPS identifier")
async def slash_ssh(interaction: discord.Interaction, vps_id: str):
    try:
        token = await _require_token(interaction)
    except app_commands.CommandOnCooldown:
        return
    try:
        embed = await _ssh_embed(token, vps_id)
        await interaction.response.send_message(embed=embed)
    except APIError as exc:
        await interaction.response.send_message(embed=_error_embed(exc.detail))


@bot.command(name="ssh")
async def prefix_ssh(ctx: commands.Context, vps_id: Optional[str] = None):
    if not vps_id:
        await ctx.send(embed=_error_embed("Usage: `!ssh <vps_id>`"))
        return
    token = getattr(bot, "session_tokens", {}).get(f"_token_{ctx.author.id}")
    if not token:
        await ctx.send(embed=_error_embed("Not authenticated."))
        return
    try:
        embed = await _ssh_embed(token, vps_id)
        await ctx.send(embed=embed)
    except APIError as exc:
        await ctx.send(embed=_error_embed(exc.detail))


# ── /delete ────────────────────────────────────────────────────

@bot.tree.command(name="delete", description="Delete a VPS (with confirmation)")
@app_commands.describe(vps_id="The VPS identifier")
async def slash_delete(interaction: discord.Interaction, vps_id: str):
    try:
        token = await _require_token(interaction)
    except app_commands.CommandOnCooldown:
        return

    v = await api_client.get_vps(token, vps_id)
    view = ConfirmView()
    embed = discord.Embed(
        title="Confirm Delete",
        description=f"Delete VPS **{v.get('name', vps_id)}** (`{vps_id}`)?\nThis action is irreversible.",
        color=0xEF4444,
    )
    await interaction.response.send_message(embed=embed, view=view, ephemeral=True)
    await view.wait()

    if view.confirmed is True:
        try:
            result = await api_client.delete_vps(token, vps_id)
            await interaction.followup.send(
                embed=_success_embed("Deleted", result.get("message", "VPS deleted.")),
                ephemeral=True,
            )
        except APIError as exc:
            await interaction.followup.send(
                embed=_error_embed(exc.detail), ephemeral=True
            )
    elif view.confirmed is False:
        await interaction.followup.send(
            embed=_info_embed("Cancelled"), ephemeral=True
        )
    else:
        await interaction.followup.send(
            embed=_error_embed("Timed out — no action taken."), ephemeral=True
        )


@bot.command(name="delete")
async def prefix_delete(ctx: commands.Context, vps_id: Optional[str] = None):
    if not vps_id:
        await ctx.send(embed=_error_embed("Usage: `!delete <vps_id>`"))
        return
    token = getattr(bot, "session_tokens", {}).get(f"_token_{ctx.author.id}")
    if not token:
        await ctx.send(embed=_error_embed("Not authenticated."))
        return
    try:
        v = await api_client.get_vps(token, vps_id)
    except APIError as exc:
        await ctx.send(embed=_error_embed(exc.detail))
        return

    view = ConfirmView()
    embed = discord.Embed(
        title="Confirm Delete",
        description=f"Delete VPS **{v.get('name', vps_id)}** (`{vps_id}`)?\nType `confirm` or click a button.",
        color=0xEF4444,
    )
    msg = await ctx.send(embed=embed, view=view)
    await view.wait()

    if view.confirmed is True:
        try:
            result = await api_client.delete_vps(token, vps_id)
            await msg.edit(embed=_success_embed("Deleted", result.get("message", "Done.")), view=None)
        except APIError as exc:
            await msg.edit(embed=_error_embed(exc.detail), view=None)
    elif view.confirmed is False:
        await msg.edit(embed=_info_embed("Cancelled"), view=None)
    else:
        await msg.edit(embed=_error_embed("Timed out."), view=None)


# ── /list_images ───────────────────────────────────────────────

async def _images_embed(token: str) -> discord.Embed:
    images = await api_client.admin_list_images(token)
    if not images:
        embed = _info_embed("OS Images")
        embed.description = "No images available or insufficient permissions."
        return embed

    embed = discord.Embed(title="OS Images", color=0x3B82F6)
    for img in images[:25]:
        status = "\u2705 Active" if img.get("is_active") else "\u274C Inactive"
        embed.add_field(
            name=img.get("name", "Unknown"),
            value=f"{img.get('docker_image', 'N/A')}\n{status}",
            inline=True,
        )
    return embed


@bot.tree.command(name="list_images", description="List available OS images")
async def slash_list_images(interaction: discord.Interaction):
    try:
        token = await _require_token(interaction)
    except app_commands.CommandOnCooldown:
        return
    try:
        embed = await _images_embed(token)
        await interaction.response.send_message(embed=embed)
    except APIError as exc:
        await interaction.response.send_message(embed=_error_embed(exc.detail))


@bot.command(name="images")
async def prefix_images(ctx: commands.Context):
    token = getattr(bot, "session_tokens", {}).get(f"_token_{ctx.author.id}")
    if not token:
        await ctx.send(embed=_error_embed("Not authenticated."))
        return
    try:
        embed = await _images_embed(token)
        await ctx.send(embed=embed)
    except APIError as exc:
        await ctx.send(embed=_error_embed(exc.detail))


# ── Auth commands ──────────────────────────────────────────────

if not hasattr(bot, "session_tokens"):
    bot.session_tokens: dict[str, str] = {}


@bot.tree.command(name="login", description="Authenticate with the VPS panel")
@app_commands.describe(username="Panel username or email", password="Your password")
async def slash_login(interaction: discord.Interaction, username: str, password: str):
    try:
        result = await api_client.login(username, password)
        access = result.get("access_token", "")
        bot.session_tokens[f"_token_{interaction.user.id}"] = access
        embed = _success_embed("Logged In", f"Welcome, **{username}**.")
        await interaction.response.send_message(embed=embed, ephemeral=True)
    except APIError as exc:
        await interaction.response.send_message(
            embed=_error_embed(f"Login failed: {exc.detail}"), ephemeral=True
        )


@bot.command(name="login")
async def prefix_login(ctx: commands.Context, username: Optional[str] = None, password: Optional[str] = None):
    if not username or not password:
        await ctx.send(embed=_error_embed("Usage: `!login <username> <password>`"))
        return
    try:
        result = await api_client.login(username, password)
        access = result.get("access_token", "")
        bot.session_tokens[f"_token_{ctx.author.id}"] = access
        await ctx.send(embed=_success_embed("Logged In", f"Welcome, **{username}**."))
    except APIError as exc:
        await ctx.send(embed=_error_embed(f"Login failed: {exc.detail}"))


@bot.tree.command(name="logout", description="Log out of the VPS panel")
async def slash_logout(interaction: discord.Interaction):
    key = f"_token_{interaction.user.id}"
    bot.session_tokens.pop(key, None)
    await interaction.response.send_message(
        embed=_success_embed("Logged Out", "Session cleared."), ephemeral=True
    )


@bot.command(name="logout")
async def prefix_logout(ctx: commands.Context):
    key = f"_token_{ctx.author.id}"
    bot.session_tokens.pop(key, None)
    await ctx.send(embed=_success_embed("Logged Out", "Session cleared."))


# ── Admin: /vps_all ────────────────────────────────────────────

@bot.tree.command(name="vps_all", description="[Admin] List all VPS instances across users")
@is_admin()
async def slash_vps_all(interaction: discord.Interaction):
    try:
        token = await _require_token(interaction)
    except app_commands.CommandOnCooldown:
        return
    try:
        vps_list = await api_client.admin_list_vps(token)
        if not vps_list:
            await interaction.response.send_message(embed=_info_embed("No VPS instances found."))
            return

        embed = discord.Embed(title="All VPS Instances", color=0x3B82F6)
        for v in vps_list[:25]:
            status = v.get("status", "unknown")
            emoji = STATUS_EMOJI.get(status, "")
            embed.add_field(
                name=f"{emoji} {v.get('name', 'Unknown')}",
                value=(
                    f"ID: `{v.get('vps_id')}`\n"
                    f"User: `{v.get('user_id')}`\n"
                    f"Status: `{status}`"
                ),
                inline=True,
            )
        await interaction.response.send_message(embed=embed)
    except APIError as exc:
        await interaction.response.send_message(embed=_error_embed(exc.detail))


# ── Run ────────────────────────────────────────────────────────

def run():
    if not DISCORD_BOT_TOKEN:
        raise RuntimeError("DISCORD_BOT_TOKEN is not set")
    bot.run(DISCORD_BOT_TOKEN, log_handler=None)
