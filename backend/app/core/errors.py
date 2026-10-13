"""Interim API error envelope: {"error": {"code": "...", "message": "..."}}.

TODO(T03): align the envelope (and validation error detail) with the frozen
API contract. app/shared/errors.py stays a placeholder until then.
"""

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class AppError(Exception):
    def __init__(
        self, status_code: int, code: str, message: str, headers: dict[str, str] | None = None
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.headers = headers


def not_authenticated() -> AppError:
    return AppError(401, "not_authenticated", "Authentication required.", {"WWW-Authenticate": "Bearer"})


def forbidden() -> AppError:
    return AppError(403, "forbidden", "You do not have permission to perform this action.")


def not_found(entity: str = "Resource") -> AppError:
    return AppError(404, "not_found", f"{entity} not found.")


def conflict(message: str) -> AppError:
    return AppError(409, "conflict", message)


def invalid(message: str) -> AppError:
    return AppError(422, "validation_error", message)


def _envelope(status_code: int, code: str, message: str, headers=None) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"error": {"code": code, "message": message}},
        headers=headers,
    )


async def _app_error(_: Request, exc: AppError) -> JSONResponse:
    return _envelope(exc.status_code, exc.code, exc.message, exc.headers)


async def _http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
    return _envelope(exc.status_code, "http_error", str(exc.detail), getattr(exc, "headers", None))


async def _validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
    # Field locations and messages only; never echo submitted values (may hold passwords).
    parts = [
        f"{'.'.join(str(p) for p in err['loc'] if p != 'body')}: {err['msg']}" for err in exc.errors()
    ]
    return _envelope(422, "validation_error", "; ".join(parts) or "Invalid request.")


def register_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, _app_error)
    app.add_exception_handler(StarletteHTTPException, _http_error)
    app.add_exception_handler(RequestValidationError, _validation_error)
