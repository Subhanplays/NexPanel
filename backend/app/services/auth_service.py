import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select

from app.config import settings
from app.database import async_session_maker
from app.models.models import User

logger = logging.getLogger(__name__)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class AuthError(Exception):
    pass


class UserNotFoundError(AuthError):
    pass


class UserAlreadyExistsError(AuthError):
    pass


class InvalidCredentialsError(AuthError):
    pass


class InvalidTokenError(AuthError):
    pass


class AuthService:
    @staticmethod
    def get_password_hash(password: str) -> str:
        return pwd_context.hash(password)

    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        return pwd_context.verify(plain_password, hashed_password)

    async def create_user(
        self,
        email: str,
        username: str,
        password: str,
        is_admin: bool = False,
    ) -> User:
        async with async_session_maker() as session:
            existing = await session.execute(
                select(User).where(
                    (User.email == email) | (User.username == username)
                )
            )
            if existing.scalar_one_or_none():
                raise UserAlreadyExistsError("Email or username already taken")

            user = User(
                email=email,
                username=username,
                hashed_password=self.get_password_hash(password),
                is_active=True,
                is_admin=is_admin,
            )
            session.add(user)
            await session.commit()
            await session.refresh(user)
            logger.info(f"Created user {username} ({email})")
            return user

    async def authenticate_user(self, email_or_username: str, password: str) -> User:
        async with async_session_maker() as session:
            result = await session.execute(
                select(User).where(
                    (User.email == email_or_username) | (User.username == email_or_username)
                )
            )
            user = result.scalar_one_or_none()

            if not user:
                raise InvalidCredentialsError("Invalid credentials")

            if not self.verify_password(password, user.hashed_password):
                raise InvalidCredentialsError("Invalid credentials")

            if not user.is_active:
                raise InvalidCredentialsError("Account is disabled")

            user.last_login = datetime.now(timezone.utc)
            await session.commit()
            return user

    def create_access_token(
        self,
        user_id: int,
        expires_delta: Optional[timedelta] = None,
    ) -> str:
        to_encode = {"sub": user_id}
        expire = datetime.now(timezone.utc) + (
            expires_delta or timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
        )
        to_encode.update({"exp": expire, "type": "access"})
        return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

    def create_refresh_token(self, user_id: int) -> str:
        to_encode = {"sub": user_id}
        expire = datetime.now(timezone.utc) + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)
        to_encode.update({"exp": expire, "type": "refresh"})
        return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

    def verify_token(self, token: str, token_type: str = "access") -> Optional[dict]:
        try:
            payload = jwt.decode(
                token,
                settings.JWT_SECRET_KEY,
                algorithms=[settings.JWT_ALGORITHM],
            )
        except JWTError as e:
            raise InvalidTokenError(f"Invalid token: {e}")

        if payload.get("type") != token_type:
            raise InvalidTokenError(f"Invalid token type: expected {token_type}")

        user_id = payload.get("sub")
        if user_id is None:
            raise InvalidTokenError("Token missing subject claim")

        return {
            "user_id": int(user_id),
            "type": payload.get("type"),
            "exp": payload.get("exp"),
            "iat": payload.get("iat"),
        }

    async def get_user_by_id(self, user_id: int) -> Optional[User]:
        async with async_session_maker() as session:
            result = await session.execute(
                select(User).where(User.id == user_id)
            )
            return result.scalar_one_or_none()

    async def update_password(self, user_id: int, new_password: str) -> User:
        async with async_session_maker() as session:
            result = await session.execute(
                select(User).where(User.id == user_id)
            )
            user = result.scalar_one_or_none()
            if not user:
                raise UserNotFoundError(f"User {user_id} not found")

            user.hashed_password = self.get_password_hash(new_password)
            await session.commit()
            await session.refresh(user)
            return user


auth_service = AuthService()
