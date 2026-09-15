# NexPanel

Self-hosted VPS management platform built with FastAPI, Docker, and SQLite.

```
  ╦  ╦╦╔═╗╔═╗╔═╗╦ ╦╔═╗  ╦  ╦╔═╗╔╗  ╔═╗╔╦╗
  ╚╗╔╝║╠═╝╠═╝║  ╠═╣╚═╗  ╚╗╔╝║ ║╠╩╗ ║╣  ║║
   ╚╝ ╩╩  ╩  ╚═╝╩ ╩╚═╝   ╚╝ ╚═╝╚═╝╚═╝╚═╝╚╩╝
```

## Features

- **VPS Management** - Create, start, stop, restart, and delete VPS instances via Docker containers
- **Multi-OS Support** - Deploy Ubuntu, Debian, CentOS, Rocky, AlmaLinux, and custom images
- **Real-time Terminal** - WebSocket-based web terminal for direct container access
- **IP Pool Management** - Allocate and manage IPv4 addresses for VPS instances
- **User Management** - Role-based access control with admin and regular user roles
- **Docker Integration** - Full Docker API integration for container lifecycle management
- **Tailscale** - Optional Tailscale VPN integration for remote access
- **tmate / SSHX** - Shareable SSH sessions via tmate and sshx
- **Monitoring** - Real-time CPU, memory, disk, and network monitoring
- **Anti-Miner Detection** - Automatic detection and blocking of cryptocurrency miners
- **Audit Logging** - Complete audit trail of all administrative actions
- **Discord Bot** - Manage VPS instances via Discord commands
- **Branding** - Customizable name, colors, logo, and footer
- **RESTful API** - Full API with JWT authentication and API key support
- **Rate Limiting** - Built-in rate limiting to prevent abuse

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     NexPanel Architecture                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐    │
│  │   Frontend    │   │   Discord    │   │   REST API   │    │
│  │  (HTML/JS)    │   │    Bot       │   │   Clients    │    │
│  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘    │
│         │                  │                   │             │
│         └──────────────────┼───────────────────┘             │
│                            │                                 │
│                   ┌────────▼────────┐                        │
│                   │   FastAPI App   │                        │
│                   │  (Python 3.11+) │                        │
│                   ├─────────────────┤                        │
│                   │  ┌───────────┐  │                        │
│                   │  │ Auth svc  │  │  JWT + API Keys        │
│                   │  ├───────────┤  │                        │
│                   │  │ VPS svc   │  │  Docker management     │
│                   │  ├───────────┤  │                        │
│                   │  │ Terminal  │  │  WebSocket + exec      │
│                   │  ├───────────┤  │                        │
│                   │  │ IP Pool   │  │  Address allocation    │
│                   │  ├───────────┤  │                        │
│                   │  │ Monitor   │  │  Stats + anti-miner    │
│                   │  ├───────────┤  │                        │
│                   │  │ Audit     │  │  Action logging        │
│                   │  └───────────┘  │                        │
│                   └────────┬────────┘                        │
│                            │                                 │
│         ┌──────────────────┼──────────────────┐              │
│         │                  │                  │              │
│  ┌──────▼──────┐   ┌──────▼──────┐   ┌──────▼──────┐      │
│  │   SQLite    │   │   Docker    │   │  Tailscale  │      │
│  │  Database   │   │   Engine    │   │  (optional)  │      │
│  └─────────────┘   └─────────────┘   └─────────────┘      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Prerequisites

- Linux server (Ubuntu 20.04+, Debian 11+, CentOS 8+, Rocky 8+, AlmaLinux 8+)
- Python 3.11 or later
- Docker
- 1GB+ RAM, 10GB+ disk space
- Root access

## Quick Start

One command to install everything:

```bash
sudo bash install.sh
```

The installer will:
1. Detect your Linux distribution and install system dependencies
2. Install Python 3.11+ and Docker if not present
3. Set up a virtual environment and install Python packages
4. Generate secure random secrets
5. Create the admin user
6. Start the application

## Manual Installation

```bash
# Clone the repository
cd /opt
git clone https://github.com/your-repo/NexPanel.git
cd NexPanel

# Install Python dependencies
python3 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Start the application
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Configuration

All configuration is done via environment variables. Copy `.env.example` to `.env` and customize:

```bash
cp .env.example .env
nano .env
```

Key configuration options:

| Variable | Description | Default |
|----------|-------------|---------|
| `SECRET_KEY` | Application secret key | Random (auto-generated) |
| `JWT_SECRET_KEY` | JWT signing key | Random (auto-generated) |
| `DATABASE_URL` | Database connection string | `sqlite+aiosqlite:///./data/panel.db` |
| `DOCKER_NETWORK` | Docker network name | `vps-network` |
| `MAX_VPS_PER_USER` | Max VPS per user | `3` |
| `ADMIN_EMAIL` | Admin account email | `admin@nexpanel.local` |
| `ADMIN_USERNAME` | Admin username | `admin` |

See `.env.example` for the full list of configuration options.

## Management

```bash
# Start the service
sudo /opt/nexpanel/start.sh

# Stop the service
sudo /opt/nexpanel/stop.sh

# Restart the service
sudo /opt/nexpanel/restart.sh

# Update to latest version
sudo /opt/nexpanel/update.sh

# Uninstall
sudo /opt/nexpanel/uninstall.sh
```

## API Documentation

Once running, visit:
- Swagger UI: `http://your-server:8000/docs`
- ReDoc: `http://your-server:8000/redoc`

### Authentication

```bash
# Login to get access token
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email_or_username": "admin", "password": "yourpassword"}'

# Use the token for authenticated requests
curl http://localhost:8000/api/v1/vps \
  -H "Authorization: Bearer <access_token>"
```

### API Key Authentication

```bash
curl http://localhost:8000/api/v1/vps \
  -H "X-API-Key: your-api-key"
```

## Discord Bot

To enable the Discord bot:

1. Create a Discord bot at https://discord.com/developers/applications
2. Copy the bot token
3. Set `DISCORD_BOT_TOKEN` in your `.env` file
4. Set `DISCORD_GUILD_ID` to your server ID
5. Restart the service

Commands:
- `/vps create` - Create a new VPS
- `/vps list` - List your VPS instances
- `/vps start <id>` - Start a VPS
- `/vps stop <id>` - Stop a VPS
- `/vps delete <id>` - Delete a VPS
- `/vps terminal <id>` - Get terminal access

## Security

- All passwords are hashed with bcrypt
- JWT tokens with configurable expiration
- API key authentication for programmatic access
- Audit logging for all administrative actions
- Rate limiting to prevent abuse
- Docker container isolation
- Anti-miner detection

See [SECURITY.md](SECURITY.md) for detailed security documentation.

## Troubleshooting

### Service won't start

```bash
# Check logs
sudo journalctl -u nexpanel -n 100

# Or check the log file
sudo tail -100 /opt/nexpanel/logs/panel.log
```

### Database issues

```bash
# The database is auto-created on first start
# To reset, delete the database file:
sudo rm /opt/nexpanel/data/panel.db
sudo systemctl restart nexpanel
```

### Docker permission denied

```bash
# Ensure your user is in the docker group
sudo usermod -aG docker $USER
# Then log out and back in
```

### Port 8000 already in use

```bash
# Find what's using the port
sudo lsof -i :8000
# Change the port in .env or stop the conflicting service
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests (if available)
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) for details.
