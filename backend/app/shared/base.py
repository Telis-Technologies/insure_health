"""Declarative base shared by every module's models.

The naming convention gives constraints deterministic names so that
Alembic autogenerate produces stable, reviewable migrations.
"""

from sqlalchemy import MetaData
from sqlalchemy.orm import DeclarativeBase

NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}

# TODO(Tristan/Brian): decide Postgres schema strategy (one schema per module
# vs the single default "public" schema). Until decided, all tables use the
# default schema: do not set MetaData(schema=...) or __table_args__ schema.
# If per-module schemas are chosen, also update alembic/env.py.


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)
