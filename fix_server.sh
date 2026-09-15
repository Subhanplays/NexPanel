#!/usr/bin/env bash
set -e

cd /opt/nexpanel/backend
source /opt/nexpanel/venv/bin/activate

echo "=== Installing bcrypt 4.2.1 ==="
pip install "bcrypt>=4.2.0,<4.3.0" -q

echo "=== Creating admin user ==="
python -c "
import asyncio
from app.database import init_db, async_session_maker
from app.middleware.auth import hash_password
from app.models.models import User
from sqlalchemy import select

async def create():
    await init_db()
    async with async_session_maker() as session:
        result = await session.execute(select(User).where(User.username == 'subhanplays'))
        if result.scalar_one_or_none():
            print('Admin already exists')
            return
        user = User(email='subhanzahidgame@gmail.com', username='subhanplays', hashed_password=hash_password('changeme'), is_admin=True, is_active=True)
        session.add(user)
        await session.commit()
        print('Admin created successfully')

asyncio.run(create())
"

echo "=== Starting NexPanel ==="
mkdir -p /opt/nexpanel/logs
pkill -f "uvicorn app.main:app" 2>/dev/null || true
sleep 1
nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 > /opt/nexpanel/logs/panel.log 2>&1 &
sleep 2

if kill -0 $! 2>/dev/null; then
    echo "=== NexPanel is running on port 8000 ==="
else
    echo "=== FAILED. Check logs: ==="
    tail -20 /opt/nexpanel/logs/panel.log
fi
