-- OIDC subjects are not financial principal IDs. Preserve the UUID used by
-- existing contracts and Blnk account numbers through an explicit, verified link.
BEGIN;

CREATE TABLE IF NOT EXISTS identity_subject_links (
    issuer TEXT NOT NULL CHECK (length(issuer) BETWEEN 1 AND 512),
    sub TEXT NOT NULL CHECK (length(sub) BETWEEN 1 AND 255),
    principal_id UUID NOT NULL,
    link_method TEXT NOT NULL CHECK (link_method IN ('verified_migration', 'verified_reclaim', 'oidc_new')),
    verified_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT identity_subject_links_pk PRIMARY KEY (issuer, sub),
    CONSTRAINT identity_subject_links_principal_unique UNIQUE (principal_id)
);

-- Authentication needs only the lookup; provisioning is a separately reviewed flow.
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_contract') THEN
        GRANT SELECT ON identity_subject_links TO app_contract;
    END IF;
END $$;

COMMIT;
