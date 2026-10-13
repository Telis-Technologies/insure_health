"""Access tables (T06, Keycloak identity per D04 2026-10-12) and a minimal audit_events table.

Tables: tenants (organizations; external_id = Keycloak organization id), roles,
permissions, role_permissions, tpa_delegations, patient_member_links, audit_events.
No users table: users live in Keycloak; user ids are Keycloak `sub` UUIDs.
All in the default schema. TODO(Tristan/Brian): revisit if per-module schemas are chosen.

Revision ID: 0002_access
Revises: 0001_baseline
Create Date: 2026-10-12

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0002_access'
down_revision: Union[str, Sequence[str], None] = '0001_baseline'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('audit_events',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('actor_user_id', sa.UUID(), nullable=True),
    sa.Column('actor_tenant_id', sa.UUID(), nullable=True),
    sa.Column('action', sa.String(length=100), nullable=False),
    sa.Column('entity_type', sa.String(length=100), nullable=False),
    sa.Column('entity_id', sa.String(length=100), nullable=True),
    sa.Column('reason', sa.Text(), nullable=True),
    sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), server_default='{}', nullable=False),
    sa.Column('occurred_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_audit_events'))
    )
    op.create_index(op.f('ix_audit_events_action'), 'audit_events', ['action'], unique=False)
    op.create_index(op.f('ix_audit_events_occurred_at'), 'audit_events', ['occurred_at'], unique=False)
    op.create_table('patient_member_links',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('member_id', sa.UUID(), nullable=False),
    sa.Column('created_by', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_patient_member_links')),
    sa.UniqueConstraint('user_id', 'member_id', name=op.f('uq_patient_member_links_user_id'))
    )
    op.create_index(op.f('ix_patient_member_links_member_id'), 'patient_member_links', ['member_id'], unique=False)
    op.create_index(op.f('ix_patient_member_links_user_id'), 'patient_member_links', ['user_id'], unique=False)
    op.create_table('permissions',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('code', sa.String(length=100), nullable=False),
    sa.Column('description', sa.Text(), nullable=False),
    sa.CheckConstraint("code ~ '^[a-z_]+:[a-z_]+$'", name=op.f('ck_permissions_code_format')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_permissions')),
    sa.UniqueConstraint('code', name=op.f('uq_permissions_code'))
    )
    op.create_table('roles',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('code', sa.String(length=100), nullable=False),
    sa.Column('name', sa.String(length=200), nullable=False),
    sa.Column('allowed_tenant_type', sa.String(length=20), nullable=True),
    sa.Column('is_system', sa.Boolean(), server_default='false', nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("allowed_tenant_type IS NULL OR allowed_tenant_type IN ('insurer', 'hospital', 'tpa')", name=op.f('ck_roles_allowed_tenant_type')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_roles')),
    sa.UniqueConstraint('code', name=op.f('uq_roles_code'))
    )
    op.create_table('tenants',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('external_id', sa.String(length=100), nullable=False),
    sa.Column('name', sa.String(length=200), nullable=False),
    sa.Column('type', sa.String(length=20), nullable=False),
    sa.Column('status', sa.String(length=20), server_default='active', nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("status IN ('active', 'disabled')", name=op.f('ck_tenants_status')),
    sa.CheckConstraint("type IN ('insurer', 'hospital', 'tpa')", name=op.f('ck_tenants_type')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_tenants')),
    sa.UniqueConstraint('external_id', name=op.f('uq_tenants_external_id'))
    )
    op.create_table('role_permissions',
    sa.Column('role_id', sa.UUID(), nullable=False),
    sa.Column('permission_id', sa.UUID(), nullable=False),
    sa.ForeignKeyConstraint(['permission_id'], ['permissions.id'], name=op.f('fk_role_permissions_permission_id_permissions'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['role_id'], ['roles.id'], name=op.f('fk_role_permissions_role_id_roles'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('role_id', 'permission_id', name=op.f('pk_role_permissions'))
    )
    op.create_table('tpa_delegations',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('tpa_tenant_id', sa.UUID(), nullable=False),
    sa.Column('insurer_tenant_id', sa.UUID(), nullable=False),
    sa.Column('valid_from', sa.DateTime(timezone=True), nullable=False),
    sa.Column('valid_to', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_by', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint('valid_to IS NULL OR valid_to > valid_from', name=op.f('ck_tpa_delegations_valid_period')),
    sa.ForeignKeyConstraint(['insurer_tenant_id'], ['tenants.id'], name=op.f('fk_tpa_delegations_insurer_tenant_id_tenants')),
    sa.ForeignKeyConstraint(['tpa_tenant_id'], ['tenants.id'], name=op.f('fk_tpa_delegations_tpa_tenant_id_tenants')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_tpa_delegations'))
    )
    op.create_index(op.f('ix_tpa_delegations_insurer_tenant_id'), 'tpa_delegations', ['insurer_tenant_id'], unique=False)
    op.create_index(op.f('ix_tpa_delegations_tpa_tenant_id'), 'tpa_delegations', ['tpa_tenant_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_tpa_delegations_tpa_tenant_id'), table_name='tpa_delegations')
    op.drop_index(op.f('ix_tpa_delegations_insurer_tenant_id'), table_name='tpa_delegations')
    op.drop_table('tpa_delegations')
    op.drop_table('role_permissions')
    op.drop_table('tenants')
    op.drop_table('roles')
    op.drop_table('permissions')
    op.drop_index(op.f('ix_patient_member_links_user_id'), table_name='patient_member_links')
    op.drop_index(op.f('ix_patient_member_links_member_id'), table_name='patient_member_links')
    op.drop_table('patient_member_links')
    op.drop_index(op.f('ix_audit_events_occurred_at'), table_name='audit_events')
    op.drop_index(op.f('ix_audit_events_action'), table_name='audit_events')
    op.drop_table('audit_events')
