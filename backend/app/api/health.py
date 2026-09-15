import docker
from fastapi import APIRouter

from app.config import settings
from app.schemas.schemas import HealthResponse

router = APIRouter(tags=["Health"])


@router.get("/health", response_model=HealthResponse)
async def health_check():
    db_status = "ok"
    docker_status = "ok"

    # Check database
    try:
        from app.database import engine
        async with engine.connect() as conn:
            await conn.execute(
                __import__("sqlalchemy").text("SELECT 1")
            )
    except Exception as e:
        db_status = f"error: {str(e)}"

    # Check Docker
    try:
        client = docker.DockerClient(
            base_url=settings.DOCKER_HOST,
            version=settings.DOCKER_API_VERSION,
        )
        client.ping()
    except Exception as e:
        docker_status = f"error: {str(e)}"

    overall = "healthy" if db_status == "ok" and docker_status == "ok" else "unhealthy"

    return HealthResponse(
        status=overall,
        version=settings.APP_VERSION,
        database=db_status,
        docker=docker_status,
    )


@router.get("/ping")
async def ping():
    return {"status": "pong"}
