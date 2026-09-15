from __future__ import annotations

from typing import Any

import discord
from discord import ui


class ConfirmView(ui.View):
    def __init__(self, *, timeout: float = 30):
        super().__init__(timeout=timeout)
        self.confirmed: bool | None = None

    @ui.button(label="Confirm", style=discord.ButtonStyle.danger)
    async def confirm(self, interaction: discord.Interaction, button: ui.Button):
        self.confirmed = True
        await interaction.response.defer()
        self.stop()

    @ui.button(label="Cancel", style=discord.ButtonStyle.secondary)
    async def cancel(self, interaction: discord.Interaction, button: ui.Button):
        self.confirmed = False
        await interaction.response.defer()
        self.stop()

    async def on_timeout(self):
        self.confirmed = None
        self.stop()


OS_CHOICES: list[discord.SelectOption] = [
    discord.SelectOption(label="Ubuntu 22.04", value="ubuntu:22.04", emoji="🟠"),
    discord.SelectOption(label="Ubuntu 24.04", value="ubuntu:24.04", emoji="🟠"),
    discord.SelectOption(label="Debian 12", value="debian:12", emoji="🔴"),
    discord.SelectOption(label="Debian 11", value="debian:11", emoji="🔴"),
    discord.SelectOption(label="Alpine 3.19", value="alpine:3.19", emoji="🔵"),
    discord.SelectOption(label="CentOS Stream 9", value="centos:stream9", emoji="🟣"),
    discord.SelectOption(label="Fedora 39", value="fedora:39", emoji="🔵"),
    discord.SelectOption(label="Arch Linux", value="archlinux:latest", emoji="🔵"),
]


class ResourceModal(ui.Modal, title="VPS Resources"):
    name = ui.TextInput(label="Instance Name", placeholder="my-vps", max_length=100)
    cpu = ui.TextInput(label="CPU Cores (1-8)", placeholder="1", max_length=2)
    ram = ui.TextInput(label="RAM in GB (1-32)", placeholder="1", max_length=2)
    disk = ui.TextInput(label="Disk in GB (10-500)", placeholder="20", max_length=3)
    username = ui.TextInput(
        label="Username", placeholder="root", default="root", max_length=50
    )
    password = ui.TextInput(
        label="Password", placeholder="min 8 characters", max_length=128
    )

    def __init__(self):
        super().__init__()

    async def on_submit(self, interaction: discord.Interaction):
        await interaction.response.defer()


class PasswordModal(ui.Modal, title="New Password"):
    password = ui.TextInput(
        label="New root password", placeholder="min 8 characters", max_length=128
    )

    def __init__(self):
        super().__init__()

    async def on_submit(self, interaction: discord.Interaction):
        await interaction.response.defer()


class OSSelectView(ui.View):
    def __init__(self, *, timeout: float = 120):
        super().__init__(timeout=timeout)
        self.selected_os: str | None = None
        self._os_select = ui.Select(
            placeholder="Choose an OS image",
            options=OS_CHOICES,
            min_values=1,
            max_values=1,
        )
        self._os_select.callback = self._os_callback
        self.add_item(self._os_select)

    async def _os_callback(self, interaction: discord.Interaction):
        self.selected_os = self._os_select.values[0]
        await interaction.response.defer()
        self.stop()

    async def on_timeout(self):
        self.stop()


class DeployWizardView(ui.View):
    def __init__(self, *, timeout: float = 180):
        super().__init__(timeout=timeout)
        self.selected_os: str | None = None
        self.resources: dict[str, Any] | None = None

        self._os_select = ui.Select(
            placeholder="Step 1: Choose an OS image",
            options=OS_CHOICES,
            min_values=1,
            max_values=1,
        )
        self._os_select.callback = self._os_callback
        self.add_item(self._os_select)

    async def _os_callback(self, interaction: discord.Interaction):
        self.selected_os = self._os_select.values[0]
        modal = ResourceModal()
        await interaction.response.send_modal(modal)
        await modal.wait()
        try:
            self.resources = {
                "name": str(modal.name),
                "cpu_cores": int(modal.cpu),
                "memory_gb": int(modal.ram),
                "disk_gb": int(modal.disk),
                "username": str(modal.username) or "root",
                "password": str(modal.password),
                "os_image": self.selected_os,
            }
        except (ValueError, TypeError):
            self.resources = None
        self.stop()

    async def on_timeout(self):
        self.stop()


class VPSControlView(ui.View):
    def __init__(self, vps_id: str, *, timeout: float = 60):
        super().__init__(timeout=timeout)
        self.vps_id = vps_id
        self.action: str | None = None

    @ui.button(label="Start", style=discord.ButtonStyle.success, row=0)
    async def start(self, interaction: discord.Interaction, button: ui.Button):
        self.action = "start"
        await interaction.response.defer()
        self.stop()

    @ui.button(label="Stop", style=discord.ButtonStyle.danger, row=0)
    async def stop(self, interaction: discord.Interaction, button: ui.Button):
        self.action = "stop"
        await interaction.response.defer()
        self.stop()

    @ui.button(label="Restart", style=discord.ButtonStyle.primary, row=0)
    async def restart(self, interaction: discord.Interaction, button: ui.Button):
        self.action = "restart"
        await interaction.response.defer()
        self.stop()

    @ui.button(label="Delete", style=discord.ButtonStyle.danger, row=1)
    async def delete(self, interaction: discord.Interaction, button: ui.Button):
        self.action = "delete"
        await interaction.response.defer()
        self.stop()

    @ui.button(label="Status", style=discord.ButtonStyle.secondary, row=1)
    async def status(self, interaction: discord.Interaction, button: ui.Button):
        self.action = "status"
        await interaction.response.defer()
        self.stop()

    async def on_timeout(self):
        self.stop()
