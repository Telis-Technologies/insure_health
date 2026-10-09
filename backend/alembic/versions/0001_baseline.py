"""Baseline: empty starting point for the shared migration history.

Creates no tables. Business tables are added by later revisions once
their decisions (D03, D05, ...) and the T03 contract are approved.

Revision ID: 0001_baseline
Revises:
Create Date: 2026-10-10

"""
from typing import Sequence, Union

# revision identifiers, used by Alembic.
revision: str = "0001_baseline"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
