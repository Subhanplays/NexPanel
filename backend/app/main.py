import asyncio
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.config import settings
from app.database import init_db
from app.api import auth, vps, admin, ipv4, terminal, network, health, dashboard, vps_manage

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

background_tasks: list[asyncio.Task] = []

FRONTEND_DIR = Path(__file__).resolve().parent.parent.parent / "frontend-new" / "dist"


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting NexPanel backend...")
    await init_db()

    from app.services.vps_service import monitor_vps_containers, anti_miner_check
    background_tasks.append(asyncio.create_task(monitor_vps_containers()))
    background_tasks.append(asyncio.create_task(anti_miner_check()))

    logger.info("NexPanel backend started")
    yield

    logger.info("Shutting down NexPanel backend...")
    for task in background_tasks:
        task.cancel()
    for task in background_tasks:
        try:
            await task
        except asyncio.CancelledError:
            pass
    logger.info("NexPanel backend stopped")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_HOSTS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix=settings.API_PREFIX)
app.include_router(auth.router, prefix=settings.API_PREFIX)
app.include_router(vps.router, prefix=settings.API_PREFIX)
app.include_router(admin.router, prefix=settings.API_PREFIX)
app.include_router(ipv4.router, prefix=settings.API_PREFIX)
app.include_router(terminal.router, prefix=settings.API_PREFIX)
app.include_router(network.router, prefix=settings.API_PREFIX)
app.include_router(dashboard.router, prefix=settings.API_PREFIX)
app.include_router(dashboard.settings_router, prefix=settings.API_PREFIX)
app.include_router(vps_manage.router, prefix=settings.API_PREFIX)


if FRONTEND_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIR / "assets")), name="assets")



@app.get("/api/v1/branding/public")
async def get_public_branding():
    from app.database import async_session_maker
    from app.models.models import BrandingSetting
    from sqlalchemy import select

    async with async_session_maker() as db:
        result = await db.execute(select(BrandingSetting))
        settings_list = result.scalars().all()
        return {s.key: s.value for s in settings_list}


@app.get("/{full_path:path}")
async def serve_frontend(full_path: str):
    if full_path.startswith("api/") or full_path.startswith("docs") or full_path.startswith("redoc"):
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Not found")

    if FRONTEND_DIR.exists():
        file_path = FRONTEND_DIR / full_path
        if file_path.is_file():
            resp = FileResponse(str(file_path))
            if full_path.endswith(".html") or full_path == "":
                resp.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            return resp
        index = FRONTEND_DIR / "index.html"
        if index.is_file():
            resp = FileResponse(str(index))
            resp.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            return resp

    return {"name": settings.APP_NAME, "version": settings.APP_VERSION, "docs": "/docs"}
