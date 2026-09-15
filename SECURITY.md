# Security Documentation

This document describes the security measures implemented in NexPanel.

## Authentication System

### Password Hashing

- Passwords are hashed using **bcrypt** with automatic salting
- The `passlib` library handles hashing and verification
- Hash cost factor follows bcrypt defaults (10 rounds)
- Passwords are never stored in plaintext

```python
from passlib.context import CryptContext
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
hashed = pwd_context.hash(password)
```

### Account Lockout

- Failed login attempts are logged with IP addresses
- Accounts can be disabled by administrators
- Last login timestamp is tracked for anomaly detection

## JWT Token Management

### Token Structure

- **Access Token**: Short-lived (30 minutes default), used for API requests
- **Refresh Token**: Long-lived (7 days default), used to obtain new access tokens
- Tokens contain user ID and token type claim

### Token Security

- Signed with HMAC-SHA256
- Secret key is randomly generated during installation
- Tokens are validated on every authenticated request
- Expired tokens are rejected
- Token type is enforced (access vs refresh)

### Best Practices

- Store tokens in memory (not localStorage for web clients)
- Implement token refresh before expiration
- Never log or expose tokens
- Use HTTPS in production

## API Security

### API Key Authentication

- API keys are stored as bcrypt hashes (never plaintext)
- Keys are transmitted via `X-API-Key` header
- Keys can have expiration dates and scoped permissions
- Last used timestamp is tracked

### Rate Limiting

- Configurable rate limits per endpoint
- Default: 60 requests per minute
- Rate limit headers returned in responses
- 429 status code when limit exceeded

### CORS Configuration

- Configurable allowed origins
- Default allows all origins (restrict in production)
- Credentials allowed for authenticated requests

## WebSocket Security

### Terminal WebSocket

- Authentication required on connection
- Session tokens validated before establishing connection
- Connection timeout after inactivity
- Input/output size limits to prevent abuse
- All terminal actions are audit logged

### Connection Flow

1. Client authenticates via REST API to get JWT
2. Client connects to WebSocket with JWT
3. Server validates token
4. Terminal session is created
5. Actions are proxied to Docker container exec

## Terminal Security

### Container Execution

- Commands run inside isolated Docker containers
- Container has limited resources (CPU, RAM, disk)
- Network access controlled per container
- No access to host filesystem (except designated volumes)
- Shell sessions are proxied through the application

### Restrictions

- No privilege escalation inside containers
- Resource limits enforced by Docker
- Network policies applied per container
- Container processes cannot escape isolation

## Role-Based Access Control (RBAC)

### User Roles

| Role | Permissions |
|------|------------|
| Admin | Full access: manage users, VPS, settings, view audit logs |
| User | Manage own VPS instances, view own data |

### Permission Checks

- Every API endpoint checks authentication
- Admin-only endpoints verify `is_admin` flag
- Resource ownership verified before modifications
- Users can only access their own VPS instances

## Audit Logging

### What is Logged

- User login/logout events
- VPS create/start/stop/delete actions
- User management actions (create, disable, delete)
- Configuration changes
- Failed authentication attempts
- API key usage

### Log Format

```json
{
  "user_id": 1,
  "action": "vps.create",
  "resource_type": "vps",
  "resource_id": "uuid-here",
  "details": {"name": "my-vps", "os": "ubuntu:22.04"},
  "ip_address": "192.168.1.100",
  "created_at": "2024-01-01T00:00:00Z"
}
```

### Retention

- Default retention: 90 days
- Configurable via `AUDIT_LOG_RETENTION_DAYS`
- Old logs are cleaned up automatically

## Docker Security

### Container Isolation

- Each VPS runs in its own Docker container
- Containers use bridge networking with controlled access
- No privileged containers (unless explicitly configured)
- Resource limits enforced (CPU, RAM, disk)
- Read-only root filesystem where possible

### Image Security

- Only trusted base images from Docker Hub
- Image scanning recommended (Trivy, etc.)
- Custom images should be built with minimal layers
- No secrets baked into images

### Network Security

- Docker network隔离 between VPS instances
- Configurable subnet and IP allocation
- iptables rules managed by Docker
- Optional Tailscale VPN for remote access

## Network Security

### Tailscale Integration

- Optional VPN overlay for secure remote access
- No direct port exposure required
- End-to-end encrypted tunnels
- Node authentication via Tailscale auth keys

### SSH Sharing

- tmate and sshx provide shareable SSH sessions
- Sessions are temporary and expire automatically
- Session strings are stored encrypted
- No persistent shell access without user action

## Secrets Management

### Generated Secrets

During installation, the following secrets are auto-generated:

- `SECRET_KEY` - Application secret for session signing
- `JWT_SECRET_KEY` - JWT token signing key
- `BOT_API_KEY` - Discord bot API key

### Storage

- All secrets stored in `.env` file with restricted permissions
- File permissions set to `600` (owner read/write only)
- Secrets never logged or exposed in API responses
- Database stores only hashed passwords and key hashes

### Rotation

- JWT secret can be rotated by updating `.env` and restarting
- API keys can be regenerated from the admin panel
- Password changes immediately invalidate old tokens

## Reporting Vulnerabilities

If you discover a security vulnerability:

1. **Do not** open a public GitHub issue
2. Email security@nexpanel.local (or your designated contact)
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)
4. You will receive acknowledgment within 48 hours
5. A fix will be developed and released as soon as possible

## Hardening Checklist

- [ ] Change default admin password
- [ ] Use HTTPS (reverse proxy with Let's Encrypt)
- [ ] Restrict CORS origins to your domain
- [ ] Set strong `SECRET_KEY` and `JWT_SECRET_KEY`
- [ ] Enable rate limiting
- [ ] Review audit logs regularly
- [ ] Keep Docker and system packages updated
- [ ] Use firewall rules to restrict port access
- [ ] Enable Docker content trust
- [ ] Monitor for suspicious container activity
- [ ] Regular database backups
- [ ] Disable debug mode in production
