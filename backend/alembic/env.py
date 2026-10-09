"""Alembic environment (async, asyncpg).

The database URL comes from application settings (DATABASE_URL env var),
never from alembic.ini. All backend developers share this one history.
"""

import asyncio
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context
from app.core.config import get_settings
from app.shared.base import Base

# Import every module's models so autogenerate sees their tables.
from app.modules.access import models as access_models  # noqa: F401
from app.modules.audit import models as audit_models  # noqa: F401
from app.modules.claims import models as claims_models  # noqa: F401
from app.modules.coverage import models as coverage_models  # noqa: F401
from app.modules.history import models as history_models  # noqa: F401
from app.modules.reporting import models as reporting_models  # noqa: F401
from app.modules.settlement import models as settlement_models  # noqa: F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

config.set_main_option("sqlalchemy.url", get_settings().database_url)

target_metadata = Base.metadata

# TODO(Tristan/Brian): decide Postgres schema strategy (per-module schemas vs
# the default "public" schema). Currently everything, including the
# alembic_version table, lives in the default schema. If per-module schemas are
# chosen, enable include_schemas=True in both configure() calls below, create
# the schemas in a migration, and decide where version_table_schema lives.
# See also app/shared/base.py.


def run_migrations_offline() -> None:
    context.configure(
        url=config.get_main_option("sqlalchemy.url"),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
