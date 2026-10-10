-- ============================================================================
-- Claimwise — production schema v0.1
-- Database: PostgreSQL 16+
-- Status: proposed DDL for D03/D05 review. Alembic does not apply this file.
--         backend/alembic/versions/0001_baseline.py remains the empty baseline
--         until this schema is signed off and SQLAlchemy models exist.
--
-- Conventions: snake_case, UUID v4 primary keys, TIMESTAMPTZ, money as BIGINT
-- minor units, soft delete via deleted_at, optimistic locking via row_version.
--
-- Apply on an empty database:
--   psql -v ON_ERROR_STOP=1 -f db/schema/001_initial.sql
--
-- Adjustments from the review draft, required for a script PostgreSQL can run:
-- 1. CREATE EXTENSION citext, for the email column.
-- 2. The authorization table is quoted. AUTHORIZATION is a reserved keyword.
-- 3. encounter has row_version and no updated_at, so it uses touch_row_version().
-- 4. document_link.settlement_id gains its foreign key after settlement exists.
-- 5. A settlement cannot be deleted. Identity and money columns cannot change.
--    Status may advance, including PAID → RECONCILED and PAID → REVERSED.
--    RECONCILED and REVERSED are terminal. The draft trigger blocked every
--    update once status was PAID, which made reconciled_at unreachable.
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS citext;

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

CREATE TYPE org_type_enum AS ENUM ('INSURER', 'PROVIDER', 'TPA', 'REGULATOR');
CREATE TYPE org_status_enum AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED');
CREATE TYPE user_status_enum AS ENUM ('ACTIVE', 'SUSPENDED', 'LOCKED', 'INVITED');
CREATE TYPE role_enum AS ENUM (
    'INSURER_ADMIN', 'INSURER_REVIEWER', 'INSURER_FINANCE', 'INSURER_UNDERWRITER',
    'PROVIDER_ADMIN', 'PROVIDER_BILLER', 'PROVIDER_CLINICIAN',
    'TPA_ADMIN', 'TPA_REVIEWER',
    'MEMBER', 'AUDITOR', 'SYSTEM'
);

CREATE TYPE claim_status_enum AS ENUM (
    'DRAFT', 'SUBMITTED', 'VALIDATED', 'UNDER_REVIEW',
    'CORRECTION_REQUESTED', 'CORRECTED_SUBMITTED', 'CLARIFICATION',
    'APPROVED', 'PAYMENT_PENDING', 'PAID', 'RECONCILED',
    'REJECTED', 'APPEALED', 'CANCELLED'
);

CREATE TYPE claim_version_source_enum AS ENUM (
    'PROVIDER_SUBMITTED', 'PROVIDER_CORRECTED', 'SYSTEM_IMPORT'
);

CREATE TYPE finding_severity_enum AS ENUM ('INFO', 'WARN', 'BLOCK');
CREATE TYPE finding_status_enum AS ENUM (
    'OPEN', 'ACCEPTED', 'DISPUTED', 'OVERRIDDEN', 'RESOLVED', 'WITHDRAWN'
);
CREATE TYPE rule_type_enum AS ENUM (
    'TARIFF', 'AUTHORIZATION_CEILING', 'EXCLUSION', 'DUPLICATE',
    'ANOMALY', 'BENEFIT_LIMIT', 'CLINICAL_APPROPRIATENESS'
);

CREATE TYPE review_decision_enum AS ENUM ('ACCEPT', 'DISPUTE', 'OVERRIDE', 'CLARIFY');
CREATE TYPE correction_status_enum AS ENUM ('OPEN', 'ANSWERED', 'ESCALATED', 'WITHDRAWN');
CREATE TYPE correction_response_enum AS ENUM ('CORRECTED', 'DISPUTED', 'CLARIFICATION');

CREATE TYPE settlement_status_enum AS ENUM (
    'APPROVED', 'PAYMENT_PENDING', 'PAID', 'RECONCILED', 'REVERSED'
);
CREATE TYPE ledger_entry_enum AS ENUM ('RESERVE', 'CONSUME', 'RELEASE', 'REVERSE');
CREATE TYPE payment_method_enum AS ENUM ('SIMULATED', 'BANK', 'MPESA', 'CHEQUE');
CREATE TYPE recon_status_enum AS ENUM ('MATCHED', 'PARTIAL', 'UNMATCHED', 'DISPUTED');

CREATE TYPE consent_purpose_enum AS ENUM ('CARE', 'UNDERWRITING', 'CLAIMS_REVIEW');
CREATE TYPE consent_status_enum AS ENUM ('ACTIVE', 'EXPIRED', 'WITHDRAWN', 'DENIED');

CREATE TYPE document_source_enum AS ENUM ('PROVIDER_UPLOAD', 'SCANNED', 'OCR_EXTRACTED', 'SYSTEM');
CREATE TYPE document_link_type_enum AS ENUM (
    'BILL', 'AUTHORIZATION', 'CLINICAL_NOTE', 'RECEIPT', 'DISCHARGE_SUMMARY'
);

-- ============================================================================
-- DOMAIN 1: IDENTITY & TENANCY
-- ============================================================================

CREATE TABLE organization (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_type            org_type_enum NOT NULL,
    legal_name          TEXT NOT NULL,
    display_name        TEXT NOT NULL,
    registration_number TEXT,
    kra_pin             TEXT,
    physical_address    TEXT,
    country_code        CHAR(2) NOT NULL DEFAULT 'KE',
    status              org_status_enum NOT NULL DEFAULT 'ACTIVE',
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by          UUID,
    updated_by          UUID,
    deleted_at          TIMESTAMPTZ,
    row_version         INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT chk_org_legal_name_not_empty CHECK (length(trim(legal_name)) > 0)
);

CREATE UNIQUE INDEX uq_org_registration
    ON organization(registration_number)
    WHERE registration_number IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX idx_org_type_status ON organization(org_type, status) WHERE deleted_at IS NULL;

COMMENT ON TABLE organization IS 'Tenants: insurers, providers, TPAs, regulators';
COMMENT ON COLUMN organization.row_version IS 'Optimistic locking counter';

-- ----------------------------------------------------------------------------

CREATE TABLE app_user (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email               CITEXT UNIQUE,
    phone               TEXT UNIQUE,
    full_name           TEXT NOT NULL,
    password_hash       TEXT,
    mfa_secret          TEXT,
    status              user_status_enum NOT NULL DEFAULT 'INVITED',
    last_login_at       TIMESTAMPTZ,
    failed_login_count  INTEGER NOT NULL DEFAULT 0,
    locked_until        TIMESTAMPTZ,
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    row_version         INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT chk_user_identifier CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

CREATE INDEX idx_user_status ON app_user(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_user_email_active ON app_user(email) WHERE deleted_at IS NULL;

-- ----------------------------------------------------------------------------

CREATE TABLE user_org_role (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    organization_id     UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
    role                role_enum NOT NULL,
    portfolio_scope     JSONB NOT NULL DEFAULT '{}'::jsonb,
    granted_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    granted_by          UUID REFERENCES app_user(id),
    expires_at          TIMESTAMPTZ,
    revoked_at          TIMESTAMPTZ,
    revoked_by          UUID REFERENCES app_user(id),
    revocation_reason   TEXT,
    UNIQUE (user_id, organization_id, role)
);

CREATE INDEX idx_uor_user_active
    ON user_org_role(user_id, organization_id)
    WHERE revoked_at IS NULL;

CREATE INDEX idx_uor_org_role
    ON user_org_role(organization_id, role)
    WHERE revoked_at IS NULL;

-- ============================================================================
-- DOMAIN 2: MEMBERS, POLICIES, BENEFITS
-- ============================================================================

CREATE TABLE member (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    insurer_org_id      UUID NOT NULL REFERENCES organization(id),
    member_number       TEXT NOT NULL,
    full_name           TEXT NOT NULL,
    date_of_birth       DATE,
    gender              TEXT CHECK (gender IN ('M', 'F', 'O', 'U')),
    national_id_hash    TEXT,
    status              TEXT NOT NULL DEFAULT 'ACTIVE'
                        CHECK (status IN ('ACTIVE', 'SUSPENDED', 'TERMINATED', 'DECEASED')),
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    row_version         INTEGER NOT NULL DEFAULT 1,
    UNIQUE (insurer_org_id, member_number)
);

CREATE INDEX idx_member_insurer ON member(insurer_org_id, status) WHERE deleted_at IS NULL;

COMMENT ON COLUMN member.national_id_hash IS 'HMAC-SHA256 of national ID; raw value never stored';

-- ----------------------------------------------------------------------------

CREATE TABLE member_external_id (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id           UUID NOT NULL REFERENCES member(id) ON DELETE CASCADE,
    issuing_system      TEXT NOT NULL,
    external_value      TEXT NOT NULL,
    value_hash          TEXT NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (issuing_system, value_hash)
);

CREATE INDEX idx_mext_member ON member_external_id(member_id);

COMMENT ON TABLE member_external_id IS
    'Scoped external identifiers (SHA, legacy NHIF, employer). Never derive global identity from names.';

-- ----------------------------------------------------------------------------

CREATE TABLE policy (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_number       TEXT NOT NULL UNIQUE,
    member_id           UUID NOT NULL REFERENCES member(id),
    insurer_org_id      UUID NOT NULL REFERENCES organization(id),
    sponsor_org_id      UUID REFERENCES organization(id),
    scheme_type         TEXT NOT NULL
                        CHECK (scheme_type IN ('INDIVIDUAL', 'GROUP', 'CORPORATE', 'COMMUNITY')),
    product_code        TEXT,
    effective_from      DATE NOT NULL,
    effective_to        DATE,
    status              TEXT NOT NULL DEFAULT 'ACTIVE'
                        CHECK (status IN ('ACTIVE', 'LAPSED', 'CANCELLED', 'SUSPENDED')),
    financial_config    JSONB NOT NULL DEFAULT '{}'::jsonb,
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    row_version         INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT chk_policy_dates CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE INDEX idx_policy_member ON policy(member_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_policy_insurer ON policy(insurer_org_id, status) WHERE deleted_at IS NULL;

COMMENT ON COLUMN policy.financial_config IS
    'Deductible, coinsurance bps, limit rules. Case 001 values are attached to POL-2026-001 only.';

-- ----------------------------------------------------------------------------

CREATE TABLE benefit_period (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id           UUID NOT NULL REFERENCES policy(id),
    period_start        DATE NOT NULL,
    period_end          DATE NOT NULL,
    limit_minor         BIGINT NOT NULL CHECK (limit_minor >= 0),
    used_minor          BIGINT NOT NULL DEFAULT 0 CHECK (used_minor >= 0),
    reserved_minor      BIGINT NOT NULL DEFAULT 0 CHECK (reserved_minor >= 0),
    currency            CHAR(3) NOT NULL DEFAULT 'KES',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    row_version         INTEGER NOT NULL DEFAULT 1,
    UNIQUE (policy_id, period_start, period_end),
    CONSTRAINT chk_benefit_dates CHECK (period_end >= period_start),
    CONSTRAINT chk_benefit_no_overcommit
        CHECK (used_minor + reserved_minor <= limit_minor)
);

CREATE INDEX idx_bp_policy ON benefit_period(policy_id);

COMMENT ON COLUMN benefit_period.reserved_minor IS
    'Locked during approval pending payment. Released or consumed on settlement.';

-- ============================================================================
-- DOMAIN 3: PROVIDERS & CONTRACTS
-- ============================================================================

CREATE TABLE provider_contract (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_number     TEXT NOT NULL UNIQUE,
    insurer_org_id      UUID NOT NULL REFERENCES organization(id),
    provider_org_id     UUID NOT NULL REFERENCES organization(id),
    tpa_org_id          UUID REFERENCES organization(id),
    effective_from      DATE NOT NULL,
    effective_to        DATE,
    currency            CHAR(3) NOT NULL DEFAULT 'KES',
    status              TEXT NOT NULL DEFAULT 'ACTIVE'
                        CHECK (status IN ('DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED', 'SUSPENDED')),
    terms               JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    row_version         INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT chk_pc_dates CHECK (effective_to IS NULL OR effective_to >= effective_from),
    CONSTRAINT chk_pc_parties CHECK (insurer_org_id <> provider_org_id)
);

CREATE INDEX idx_pc_insurer ON provider_contract(insurer_org_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_pc_provider ON provider_contract(provider_org_id, status) WHERE deleted_at IS NULL;

-- ----------------------------------------------------------------------------

CREATE TABLE contract_tariff (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id         UUID NOT NULL REFERENCES provider_contract(id) ON DELETE CASCADE,
    service_code        TEXT NOT NULL,
    service_name        TEXT NOT NULL,
    service_category    TEXT,
    agreed_rate_minor   BIGINT NOT NULL CHECK (agreed_rate_minor >= 0),
    ceiling_minor       BIGINT CHECK (ceiling_minor IS NULL OR ceiling_minor >= 0),
    currency            CHAR(3) NOT NULL DEFAULT 'KES',
    requires_auth       BOOLEAN NOT NULL DEFAULT FALSE,
    is_excluded         BOOLEAN NOT NULL DEFAULT FALSE,
    exclusion_reason    TEXT,
    version             INTEGER NOT NULL DEFAULT 1,
    effective_from      DATE NOT NULL,
    effective_to        DATE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by          UUID REFERENCES app_user(id),
    UNIQUE (contract_id, service_code, version)
);

CREATE INDEX idx_ct_contract_active
    ON contract_tariff(contract_id, service_code)
    WHERE effective_to IS NULL;

COMMENT ON COLUMN contract_tariff.ceiling_minor IS
    'Per-service maximum payable. Combined with authorization ceiling: apply once, not twice.';

-- ============================================================================
-- DOMAIN 4: ENCOUNTERS & AUTHORIZATIONS
-- ============================================================================

CREATE TABLE encounter (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id           UUID NOT NULL REFERENCES member(id),
    provider_org_id     UUID NOT NULL REFERENCES organization(id),
    contract_id         UUID REFERENCES provider_contract(id),
    service_date        DATE NOT NULL,
    encounter_type      TEXT NOT NULL
                        CHECK (encounter_type IN ('OUTPATIENT', 'INPATIENT', 'DAYCASE', 'EMERGENCY')),
    attending_clinician TEXT,
    notes_encrypted     BYTEA,
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by          UUID REFERENCES app_user(id),
    deleted_at          TIMESTAMPTZ,
    row_version         INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_enc_member_date ON encounter(member_id, service_date DESC);
CREATE INDEX idx_enc_provider_date ON encounter(provider_org_id, service_date DESC);

COMMENT ON COLUMN encounter.notes_encrypted IS
    'Clinical text encrypted at application layer. Never copied to audit logs.';

-- ----------------------------------------------------------------------------

-- AUTHORIZATION is a reserved keyword; the table name must be quoted.
CREATE TABLE "authorization" (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    encounter_id        UUID NOT NULL REFERENCES encounter(id),
    auth_number         TEXT NOT NULL UNIQUE,
    service_code        TEXT NOT NULL,
    service_name        TEXT NOT NULL,
    ceiling_minor       BIGINT CHECK (ceiling_minor IS NULL OR ceiling_minor >= 0),
    currency            CHAR(3) NOT NULL DEFAULT 'KES',
    approved_from       DATE NOT NULL,
    approved_to         DATE,
    status              TEXT NOT NULL DEFAULT 'APPROVED'
                        CHECK (status IN ('REQUESTED', 'APPROVED', 'CLARIFICATION', 'DENIED', 'EXPIRED')),
    approved_by         UUID REFERENCES app_user(id),
    denial_reason       TEXT,
    evidence_refs       JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    row_version         INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_auth_encounter ON "authorization"(encounter_id);
CREATE INDEX idx_auth_service_date ON "authorization"(service_code, approved_from);

COMMENT ON TABLE "authorization" IS
    'Authorization is NOT blanket payment approval. Ceiling applies to specific service only.';

-- ============================================================================
-- DOMAIN 5: CLAIMS, VERSIONS, LINES
-- ============================================================================

CREATE TABLE claim (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_number        TEXT NOT NULL UNIQUE,
    member_id           UUID NOT NULL REFERENCES member(id),
    policy_id           UUID NOT NULL REFERENCES policy(id),
    benefit_period_id   UUID NOT NULL REFERENCES benefit_period(id),
    provider_org_id     UUID NOT NULL REFERENCES organization(id),
    contract_id         UUID REFERENCES provider_contract(id),
    encounter_id        UUID REFERENCES encounter(id),
    current_version_id  UUID,
    status              claim_status_enum NOT NULL DEFAULT 'DRAFT',
    submitted_at        TIMESTAMPTZ,
    approved_at         TIMESTAMPTZ,
    closed_at           TIMESTAMPTZ,
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    row_version         INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_claim_status_created ON claim(status, created_at DESC);
CREATE INDEX idx_claim_provider_status ON claim(provider_org_id, status);
CREATE INDEX idx_claim_member ON claim(member_id, created_at DESC);
CREATE INDEX idx_claim_policy ON claim(policy_id);

COMMENT ON COLUMN claim.current_version_id IS
    'Points to latest claim_version. FK added after claim_version created.';

-- ----------------------------------------------------------------------------

CREATE TABLE claim_version (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id            UUID NOT NULL REFERENCES claim(id) ON DELETE CASCADE,
    version_number      INTEGER NOT NULL CHECK (version_number >= 1),
    source              claim_version_source_enum NOT NULL,
    parent_version_id   UUID REFERENCES claim_version(id),
    provider_bill_ref   TEXT,
    total_billed_minor  BIGINT NOT NULL DEFAULT 0 CHECK (total_billed_minor >= 0),
    currency            CHAR(3) NOT NULL DEFAULT 'KES',
    submitted_by        UUID REFERENCES app_user(id),
    submitted_at        TIMESTAMPTZ,
    is_immutable        BOOLEAN NOT NULL DEFAULT TRUE,
    content_hash        TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (claim_id, version_number)
);

CREATE INDEX idx_cv_claim ON claim_version(claim_id, version_number DESC);
CREATE INDEX idx_cv_parent ON claim_version(parent_version_id) WHERE parent_version_id IS NOT NULL;

ALTER TABLE claim
    ADD CONSTRAINT fk_claim_current_version
    FOREIGN KEY (current_version_id) REFERENCES claim_version(id);

-- ----------------------------------------------------------------------------

CREATE TABLE claim_line (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_version_id    UUID NOT NULL REFERENCES claim_version(id) ON DELETE CASCADE,
    line_number         INTEGER NOT NULL CHECK (line_number > 0),
    service_code        TEXT NOT NULL,
    service_name        TEXT NOT NULL,
    quantity            NUMERIC(12, 3) NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_rate_minor     BIGINT NOT NULL CHECK (unit_rate_minor >= 0),
    billed_minor        BIGINT NOT NULL CHECK (billed_minor >= 0),
    currency            CHAR(3) NOT NULL DEFAULT 'KES',
    service_date        DATE,
    authorization_id    UUID REFERENCES "authorization"(id),
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (claim_version_id, line_number),
    CONSTRAINT chk_line_amount CHECK (billed_minor >= 0)
);

CREATE INDEX idx_cl_version ON claim_line(claim_version_id, line_number);
CREATE INDEX idx_cl_service ON claim_line(service_code);
CREATE INDEX idx_cl_auth ON claim_line(authorization_id) WHERE authorization_id IS NOT NULL;

-- ============================================================================
-- DOMAIN 6: DOCUMENTS
-- ============================================================================

CREATE TABLE document (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_org_id        UUID NOT NULL REFERENCES organization(id),
    storage_backend     TEXT NOT NULL CHECK (storage_backend IN ('LOCAL', 'S3', 'AZURE_BLOB', 'GCS')),
    storage_key         TEXT NOT NULL,
    storage_bucket      TEXT,
    original_filename   TEXT NOT NULL,
    mime_type           TEXT NOT NULL,
    size_bytes          BIGINT NOT NULL CHECK (size_bytes >= 0),
    content_hash_sha256 TEXT NOT NULL,
    source              document_source_enum NOT NULL,
    is_synthetic        BOOLEAN NOT NULL DEFAULT TRUE,
    encryption_key_id   TEXT,
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by          UUID REFERENCES app_user(id),
    deleted_at          TIMESTAMPTZ,
    UNIQUE (storage_backend, storage_key)
);

CREATE INDEX idx_doc_owner ON document(owner_org_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_doc_hash ON document(content_hash_sha256);

-- ----------------------------------------------------------------------------

CREATE TABLE document_link (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id         UUID NOT NULL REFERENCES document(id) ON DELETE CASCADE,
    claim_version_id    UUID REFERENCES claim_version(id) ON DELETE CASCADE,
    encounter_id        UUID REFERENCES encounter(id) ON DELETE CASCADE,
    settlement_id       UUID,
    link_type           document_link_type_enum NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_dl_target CHECK (
        (claim_version_id IS NOT NULL)::int
        + (encounter_id IS NOT NULL)::int
        + (settlement_id IS NOT NULL)::int = 1
    )
);

CREATE INDEX idx_dl_document ON document_link(document_id);
CREATE INDEX idx_dl_claim_version ON document_link(claim_version_id) WHERE claim_version_id IS NOT NULL;
CREATE INDEX idx_dl_encounter ON document_link(encounter_id) WHERE encounter_id IS NOT NULL;

-- ============================================================================
-- DOMAIN 7: RULES & VALIDATION
-- ============================================================================

CREATE TABLE rule_definition (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_code           TEXT NOT NULL,
    rule_name           TEXT NOT NULL,
    description         TEXT NOT NULL,
    rule_type           rule_type_enum NOT NULL,
    severity            finding_severity_enum NOT NULL DEFAULT 'WARN',
    config              JSONB NOT NULL DEFAULT '{}'::jsonb,
    version             INTEGER NOT NULL DEFAULT 1,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    effective_from      TIMESTAMPTZ NOT NULL DEFAULT now(),
    effective_to        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by          UUID REFERENCES app_user(id),
    UNIQUE (rule_code, version)
);

CREATE INDEX idx_rule_active ON rule_definition(rule_type, is_active)
    WHERE effective_to IS NULL;

-- ----------------------------------------------------------------------------

CREATE TABLE validation_run (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_version_id    UUID NOT NULL REFERENCES claim_version(id) ON DELETE CASCADE,
    policy_id           UUID NOT NULL REFERENCES policy(id),
    contract_id         UUID REFERENCES provider_contract(id),
    benefit_period_id   UUID NOT NULL REFERENCES benefit_period(id),
    rule_set_snapshot   JSONB NOT NULL,
    tariff_snapshot     JSONB NOT NULL,
    config_snapshot     JSONB NOT NULL,
    status              TEXT NOT NULL DEFAULT 'COMPLETED'
                        CHECK (status IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED')),
    total_billed_minor  BIGINT NOT NULL DEFAULT 0,
    total_correction_minor BIGINT NOT NULL DEFAULT 0,
    total_eligible_minor BIGINT NOT NULL DEFAULT 0,
    currency            CHAR(3) NOT NULL DEFAULT 'KES',
    started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at        TIMESTAMPTZ,
    created_by          UUID REFERENCES app_user(id),
    is_current          BOOLEAN NOT NULL DEFAULT TRUE,
    superseded_by_id    UUID REFERENCES validation_run(id)
);

CREATE INDEX idx_vr_version ON validation_run(claim_version_id, started_at DESC);
CREATE INDEX idx_vr_current ON validation_run(claim_version_id) WHERE is_current = TRUE;

COMMENT ON COLUMN validation_run.rule_set_snapshot IS
    'Frozen rule versions at run time. Re-running creates a new run; old runs remain immutable.';

-- ----------------------------------------------------------------------------

CREATE TABLE finding (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    validation_run_id   UUID NOT NULL REFERENCES validation_run(id) ON DELETE CASCADE,
    rule_id             UUID NOT NULL REFERENCES rule_definition(id),
    finding_code        TEXT NOT NULL,
    severity            finding_severity_enum NOT NULL,
    message             TEXT NOT NULL,
    observed_value      JSONB NOT NULL DEFAULT '{}'::jsonb,
    expected_value      JSONB,
    proposed_correction_minor BIGINT NOT NULL DEFAULT 0 CHECK (proposed_correction_minor >= 0),
    currency            CHAR(3) NOT NULL DEFAULT 'KES',
    evidence_refs       JSONB NOT NULL DEFAULT '{}'::jsonb,
    status              finding_status_enum NOT NULL DEFAULT 'OPEN',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at         TIMESTAMPTZ
);

CREATE INDEX idx_finding_run ON finding(validation_run_id, status);
CREATE INDEX idx_finding_code ON finding(finding_code);

-- ----------------------------------------------------------------------------

CREATE TABLE finding_line (
    finding_id          UUID NOT NULL REFERENCES finding(id) ON DELETE CASCADE,
    claim_line_id       UUID NOT NULL REFERENCES claim_line(id) ON DELETE CASCADE,
    PRIMARY KEY (finding_id, claim_line_id)
);

CREATE INDEX idx_fl_line ON finding_line(claim_line_id);

-- ----------------------------------------------------------------------------

CREATE TABLE review_decision (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    finding_id          UUID NOT NULL REFERENCES finding(id) ON DELETE CASCADE,
    decided_by          UUID NOT NULL REFERENCES app_user(id),
    decision            review_decision_enum NOT NULL,
    reason              TEXT NOT NULL,
    override_authority  TEXT,
    override_justification TEXT,
    decided_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_override_requires_authority CHECK (
        decision <> 'OVERRIDE' OR (override_authority IS NOT NULL AND override_justification IS NOT NULL)
    )
);

CREATE INDEX idx_rd_finding ON review_decision(finding_id);
CREATE INDEX idx_rd_decided_by ON review_decision(decided_by, decided_at DESC);

-- ============================================================================
-- DOMAIN 8: CORRECTION LOOP
-- ============================================================================

CREATE TABLE correction_request (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id            UUID NOT NULL REFERENCES claim(id) ON DELETE CASCADE,
    based_on_version_id UUID NOT NULL REFERENCES claim_version(id),
    requested_by        UUID NOT NULL REFERENCES app_user(id),
    requested_lines     JSONB NOT NULL,
    reason              TEXT NOT NULL,
    due_by              TIMESTAMPTZ,
    status              correction_status_enum NOT NULL DEFAULT 'OPEN',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    row_version         INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_cr_claim ON correction_request(claim_id, status);

-- ----------------------------------------------------------------------------

CREATE TABLE correction_response (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    correction_request_id UUID NOT NULL REFERENCES correction_request(id) ON DELETE CASCADE,
    corrected_version_id UUID NOT NULL REFERENCES claim_version(id),
    responded_by        UUID NOT NULL REFERENCES app_user(id),
    response_type       correction_response_enum NOT NULL,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cresp_request ON correction_response(correction_request_id);
CREATE INDEX idx_cresp_version ON correction_response(corrected_version_id);

-- ============================================================================
-- DOMAIN 9: SETTLEMENT, LEDGER, PAYMENT, RECONCILIATION
-- ============================================================================

CREATE TABLE settlement (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    settlement_number   TEXT NOT NULL UNIQUE,
    claim_version_id    UUID NOT NULL REFERENCES claim_version(id),
    claim_id            UUID NOT NULL REFERENCES claim(id),
    benefit_period_id   UUID NOT NULL REFERENCES benefit_period(id),
    approved_by         UUID NOT NULL REFERENCES app_user(id),
    eligible_minor      BIGINT NOT NULL CHECK (eligible_minor >= 0),
    member_share_minor  BIGINT NOT NULL CHECK (member_share_minor >= 0),
    insurer_share_minor BIGINT NOT NULL CHECK (insurer_share_minor >= 0),
    currency            CHAR(3) NOT NULL DEFAULT 'KES',
    calculation_config  JSONB NOT NULL,
    calculation_trace   JSONB NOT NULL DEFAULT '{}'::jsonb,
    status              settlement_status_enum NOT NULL DEFAULT 'APPROVED',
    approved_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    paid_at             TIMESTAMPTZ,
    reconciled_at       TIMESTAMPTZ,
    reversed_at         TIMESTAMPTZ,
    reversal_reason     TEXT,
    UNIQUE (claim_version_id),
    CONSTRAINT chk_settlement_sums CHECK (eligible_minor = member_share_minor + insurer_share_minor)
);

CREATE INDEX idx_settlement_claim ON settlement(claim_id);
CREATE INDEX idx_settlement_status ON settlement(status, approved_at DESC);

COMMENT ON TABLE settlement IS
    'One settlement per approved claim version. Identity and money columns are immutable. Status may advance until RECONCILED or REVERSED. Corrections produce a new claim version and a new settlement.';

-- Deferred from document_link: settlement did not exist yet.
ALTER TABLE document_link
    ADD CONSTRAINT fk_document_link_settlement
    FOREIGN KEY (settlement_id) REFERENCES settlement(id);

CREATE INDEX idx_dl_settlement ON document_link(settlement_id) WHERE settlement_id IS NOT NULL;

-- ----------------------------------------------------------------------------

CREATE TABLE benefit_ledger_entry (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    benefit_period_id   UUID NOT NULL REFERENCES benefit_period(id),
    settlement_id       UUID REFERENCES settlement(id),
    claim_id            UUID REFERENCES claim(id),
    entry_type          ledger_entry_enum NOT NULL,
    amount_minor        BIGINT NOT NULL,
    currency            CHAR(3) NOT NULL DEFAULT 'KES',
    balance_after_minor BIGINT NOT NULL,
    reason              TEXT NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by          UUID REFERENCES app_user(id)
);

CREATE INDEX idx_ble_period ON benefit_ledger_entry(benefit_period_id, created_at DESC);
CREATE INDEX idx_ble_settlement ON benefit_ledger_entry(settlement_id) WHERE settlement_id IS NOT NULL;

COMMENT ON TABLE benefit_ledger_entry IS
    'Append-only ledger. Never UPDATE or DELETE. Reversals are new entries with REVERSE type.';

-- ----------------------------------------------------------------------------

CREATE TABLE payment (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_ref         TEXT NOT NULL UNIQUE,
    payer_org_id        UUID NOT NULL REFERENCES organization(id),
    payee_org_id        UUID NOT NULL REFERENCES organization(id),
    amount_minor        BIGINT NOT NULL CHECK (amount_minor > 0),
    currency            CHAR(3) NOT NULL DEFAULT 'KES',
    method              payment_method_enum NOT NULL,
    payment_date        DATE NOT NULL,
    value_date          DATE,
    is_simulated        BOOLEAN NOT NULL DEFAULT TRUE,
    external_ref        TEXT,
    idempotency_key     TEXT UNIQUE,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by          UUID REFERENCES app_user(id),
    reversed_at         TIMESTAMPTZ,
    reversal_reason     TEXT
);

CREATE INDEX idx_payment_date ON payment(payment_date DESC);
CREATE INDEX idx_payment_orgs ON payment(payer_org_id, payee_org_id);
CREATE INDEX idx_payment_method ON payment(method, is_simulated);

-- ----------------------------------------------------------------------------

CREATE TABLE payment_allocation (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id          UUID NOT NULL REFERENCES payment(id) ON DELETE CASCADE,
    settlement_id       UUID NOT NULL REFERENCES settlement(id),
    allocated_minor     BIGINT NOT NULL CHECK (allocated_minor > 0),
    currency            CHAR(3) NOT NULL DEFAULT 'KES',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (payment_id, settlement_id)
);

CREATE INDEX idx_pa_payment ON payment_allocation(payment_id);
CREATE INDEX idx_pa_settlement ON payment_allocation(settlement_id);

-- ----------------------------------------------------------------------------

CREATE TABLE reconciliation (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id          UUID NOT NULL REFERENCES payment(id),
    settlement_id       UUID NOT NULL REFERENCES settlement(id),
    matched_minor       BIGINT NOT NULL DEFAULT 0 CHECK (matched_minor >= 0),
    expected_minor      BIGINT NOT NULL CHECK (expected_minor >= 0),
    variance_minor      BIGINT NOT NULL,
    currency            CHAR(3) NOT NULL DEFAULT 'KES',
    status              recon_status_enum NOT NULL,
    reconciled_by       UUID REFERENCES app_user(id),
    reconciled_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    notes               TEXT,
    CONSTRAINT chk_recon_variance CHECK (variance_minor = expected_minor - matched_minor),
    UNIQUE (payment_id, settlement_id)
);

CREATE INDEX idx_recon_status ON reconciliation(status, reconciled_at DESC);

-- ============================================================================
-- DOMAIN 10: CONSENT & HISTORY
-- ============================================================================

CREATE TABLE history_record (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id           UUID NOT NULL REFERENCES member(id),
    source_org_id       UUID NOT NULL REFERENCES organization(id),
    record_type         TEXT NOT NULL
                        CHECK (record_type IN ('ALLERGY', 'MEDICATION', 'CONDITION', 'ENCOUNTER_SUMMARY', 'IMMUNIZATION', 'LAB_RESULT')),
    content_encrypted   BYTEA NOT NULL,
    content_hash        TEXT NOT NULL,
    recorded_date       DATE,
    is_synthetic        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by          UUID REFERENCES app_user(id)
);

CREATE INDEX idx_hr_member_type ON history_record(member_id, record_type);

-- ----------------------------------------------------------------------------

CREATE TABLE history_grant (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id           UUID NOT NULL REFERENCES member(id),
    recipient_org_id    UUID NOT NULL REFERENCES organization(id),
    recipient_user_id   UUID REFERENCES app_user(id),
    purpose             consent_purpose_enum NOT NULL,
    status              consent_status_enum NOT NULL DEFAULT 'ACTIVE',
    granted_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at          TIMESTAMPTZ,
    withdrawn_at        TIMESTAMPTZ,
    withdrawal_reason   TEXT,
    evidence            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_hg_member_active ON history_grant(member_id, status) WHERE status = 'ACTIVE';
CREATE INDEX idx_hg_recipient ON history_grant(recipient_org_id, purpose) WHERE status = 'ACTIVE';

-- ----------------------------------------------------------------------------

CREATE TABLE history_grant_scope (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grant_id            UUID NOT NULL REFERENCES history_grant(id) ON DELETE CASCADE,
    record_type         TEXT NOT NULL,
    UNIQUE (grant_id, record_type)
);

CREATE INDEX idx_hgs_grant ON history_grant_scope(grant_id);

-- ============================================================================
-- DOMAIN 11: REPORTING
-- ============================================================================

CREATE TABLE reporting_input (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cohort              TEXT NOT NULL,
    period_start        DATE NOT NULL,
    period_end          DATE NOT NULL,
    organization_id     UUID NOT NULL REFERENCES organization(id),
    earned_premium_minor BIGINT CHECK (earned_premium_minor IS NULL OR earned_premium_minor >= 0),
    incurred_loss_minor BIGINT CHECK (incurred_loss_minor IS NULL OR incurred_loss_minor >= 0),
    reserve_minor       BIGINT CHECK (reserve_minor IS NULL OR reserve_minor >= 0),
    currency            CHAR(3) NOT NULL DEFAULT 'KES',
    basis               TEXT CHECK (basis IN ('GROSS', 'NET')),
    source_timestamp    TIMESTAMPTZ NOT NULL DEFAULT now(),
    approved_by         UUID REFERENCES app_user(id),
    approved_at         TIMESTAMPTZ,
    is_synthetic        BOOLEAN NOT NULL DEFAULT TRUE,
    notes               TEXT,
    UNIQUE (cohort, period_start, period_end, organization_id, basis)
);

CREATE INDEX idx_ri_cohort_period ON reporting_input(cohort, period_start, period_end);

COMMENT ON TABLE reporting_input IS
    'Loss ratio requires both earned_premium_minor and incurred_loss_minor. Missing either → unavailable state.';

-- ----------------------------------------------------------------------------

CREATE TABLE audit_event (
    id                  BIGSERIAL PRIMARY KEY,
    actor_user_id       UUID REFERENCES app_user(id),
    actor_org_id        UUID REFERENCES organization(id),
    actor_role          role_enum,
    action              TEXT NOT NULL,
    entity_type         TEXT NOT NULL,
    entity_id           UUID NOT NULL,
    version_ref         TEXT,
    before_state        JSONB,
    after_state         JSONB,
    reason              TEXT,
    ip_address          INET,
    user_agent          TEXT,
    request_id          UUID,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ae_entity ON audit_event(entity_type, entity_id, created_at DESC);
CREATE INDEX idx_ae_actor ON audit_event(actor_user_id, created_at DESC);
CREATE INDEX idx_ae_action ON audit_event(action, created_at DESC);
CREATE INDEX idx_ae_created ON audit_event(created_at DESC);

COMMENT ON TABLE audit_event IS
    'Append-only. Never UPDATE or DELETE. No clinical text in before_state/after_state.';

-- ----------------------------------------------------------------------------

CREATE TABLE idempotency_key (
    key                 TEXT PRIMARY KEY,
    organization_id     UUID NOT NULL REFERENCES organization(id),
    endpoint            TEXT NOT NULL,
    request_hash        TEXT NOT NULL,
    response_body       JSONB NOT NULL,
    response_status     INTEGER NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at          TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours')
);

CREATE INDEX idx_ik_expires ON idempotency_key(expires_at);

-- ============================================================================
-- TRIGGERS: updated_at, row_version, audit
-- ============================================================================

CREATE OR REPLACE FUNCTION touch_row()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := now();
    NEW.row_version := COALESCE(OLD.row_version, 0) + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- encounter has row_version and no updated_at.
CREATE OR REPLACE FUNCTION touch_row_version()
RETURNS TRIGGER AS $$
BEGIN
    NEW.row_version := COALESCE(OLD.row_version, 0) + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at and row_version.
CREATE TRIGGER trg_org_touch BEFORE UPDATE ON organization
    FOR EACH ROW EXECUTE FUNCTION touch_row();
CREATE TRIGGER trg_user_touch BEFORE UPDATE ON app_user
    FOR EACH ROW EXECUTE FUNCTION touch_row();
CREATE TRIGGER trg_member_touch BEFORE UPDATE ON member
    FOR EACH ROW EXECUTE FUNCTION touch_row();
CREATE TRIGGER trg_policy_touch BEFORE UPDATE ON policy
    FOR EACH ROW EXECUTE FUNCTION touch_row();
CREATE TRIGGER trg_benefit_touch BEFORE UPDATE ON benefit_period
    FOR EACH ROW EXECUTE FUNCTION touch_row();
CREATE TRIGGER trg_pc_touch BEFORE UPDATE ON provider_contract
    FOR EACH ROW EXECUTE FUNCTION touch_row();
CREATE TRIGGER trg_enc_touch BEFORE UPDATE ON encounter
    FOR EACH ROW EXECUTE FUNCTION touch_row_version();
CREATE TRIGGER trg_auth_touch BEFORE UPDATE ON "authorization"
    FOR EACH ROW EXECUTE FUNCTION touch_row();
CREATE TRIGGER trg_claim_touch BEFORE UPDATE ON claim
    FOR EACH ROW EXECUTE FUNCTION touch_row();
CREATE TRIGGER trg_cr_touch BEFORE UPDATE ON correction_request
    FOR EACH ROW EXECUTE FUNCTION touch_row();

-- ----------------------------------------------------------------------------

-- Prevent mutation of immutable records.
CREATE OR REPLACE FUNCTION prevent_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Immutable record: % cannot be updated or deleted', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cv_immutable
    BEFORE UPDATE OR DELETE ON claim_version
    FOR EACH ROW
    WHEN (OLD.is_immutable = TRUE AND OLD.submitted_at IS NOT NULL)
    EXECUTE FUNCTION prevent_mutation();

-- Identity and money stay fixed. Lifecycle columns may advance until a
-- terminal status. Deletes are never allowed.
CREATE OR REPLACE FUNCTION prevent_settlement_mutation()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Immutable record: settlement cannot be deleted';
    END IF;

    IF OLD.status IN ('RECONCILED', 'REVERSED') THEN
        RAISE EXCEPTION 'Immutable record: settlement in status % cannot be updated', OLD.status;
    END IF;

    IF OLD.status = 'PAID' AND NEW.status NOT IN ('RECONCILED', 'REVERSED') THEN
        RAISE EXCEPTION 'Paid settlement can only move to RECONCILED or REVERSED';
    END IF;

    IF NEW.id IS DISTINCT FROM OLD.id
        OR NEW.settlement_number IS DISTINCT FROM OLD.settlement_number
        OR NEW.claim_version_id IS DISTINCT FROM OLD.claim_version_id
        OR NEW.claim_id IS DISTINCT FROM OLD.claim_id
        OR NEW.benefit_period_id IS DISTINCT FROM OLD.benefit_period_id
        OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
        OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
        OR NEW.eligible_minor IS DISTINCT FROM OLD.eligible_minor
        OR NEW.member_share_minor IS DISTINCT FROM OLD.member_share_minor
        OR NEW.insurer_share_minor IS DISTINCT FROM OLD.insurer_share_minor
        OR NEW.currency IS DISTINCT FROM OLD.currency
        OR NEW.calculation_config IS DISTINCT FROM OLD.calculation_config
        OR NEW.calculation_trace IS DISTINCT FROM OLD.calculation_trace
    THEN
        RAISE EXCEPTION 'Settlement identity and financial fields are immutable';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_settlement_immutable
    BEFORE UPDATE OR DELETE ON settlement
    FOR EACH ROW EXECUTE FUNCTION prevent_settlement_mutation();

CREATE TRIGGER trg_audit_immutable
    BEFORE UPDATE OR DELETE ON audit_event
    FOR EACH ROW EXECUTE FUNCTION prevent_mutation();

CREATE TRIGGER trg_ble_immutable
    BEFORE UPDATE OR DELETE ON benefit_ledger_entry
    FOR EACH ROW EXECUTE FUNCTION prevent_mutation();

-- ----------------------------------------------------------------------------

-- Helper: compute available benefit.
CREATE OR REPLACE FUNCTION benefit_available(bp_id UUID)
RETURNS BIGINT AS $$
    SELECT limit_minor - used_minor - reserved_minor
    FROM benefit_period
    WHERE id = bp_id;
$$ LANGUAGE sql STABLE;

COMMIT;
