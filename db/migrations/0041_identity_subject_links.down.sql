-- Never discard verified identity links while any account may depend on them.
BEGIN;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM identity_subject_links) THEN
        RAISE EXCEPTION 'Cannot remove identity_subject_links while verified links exist';
    END IF;
END $$;

DROP TABLE identity_subject_links;

COMMIT;
