from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import select
from typing import AsyncGenerator

from app.config import settings

DEFAULT_IMAGES = [
    {"name": "Ubuntu 22.04", "docker_image": "ubuntu:22.04", "description": "Ubuntu 22.04 LTS with systemd support"},
    {"name": "Ubuntu 24.04", "docker_image": "ubuntu:24.04", "description": "Ubuntu 24.04 LTS latest release"},
    {"name": "Debian 12", "docker_image": "debian:12", "description": "Debian 12 Bookworm stable"},
    {"name": "Debian 11", "docker_image": "debian:11", "description": "Debian 11 Bullseye"},
    {"name": "Alpine 3.19", "docker_image": "alpine:3.19", "description": "Alpine Linux 3.19 minimal"},
    {"name": "CentOS Stream 9", "docker_image": "quay.io/centos/centos:stream9", "description": "CentOS Stream 9 rolling release"},
    {"name": "Fedora 39", "docker_image": "fedora:39", "description": "Fedora 39 latest features"},
    {"name": "Arch Linux", "docker_image": "archlinux:latest", "description": "Arch Linux rolling release"},
]

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DB_ECHO,
    connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {},
)

async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    from app.models.models import Image
    async with async_session_maker() as session:
        result = await session.execute(select(Image).limit(1))
        if not result.scalars().first():
            for img in DEFAULT_IMAGES:
                session.add(Image(**img))
            await session.commit()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
