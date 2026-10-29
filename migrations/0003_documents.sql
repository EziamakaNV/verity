ALTER TABLE units ADD COLUMN last_op TEXT;
CREATE TABLE documents(id TEXT PRIMARY KEY, session_id TEXT NOT NULL, reference TEXT NOT NULL, claimed_unit_serial TEXT, claimed_sale_ref TEXT, claimed_issuer_name TEXT, issuer_actor_id TEXT, issue_date TEXT, return_date TEXT, referenced_return_event_id TEXT, provenance TEXT NOT NULL, verification_status TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, note TEXT, UNIQUE(session_id, reference));
CREATE TABLE document_claims(id TEXT PRIMARY KEY, session_id TEXT NOT NULL, unit_id TEXT NOT NULL, document_id TEXT NOT NULL, claim_text TEXT, created_at TEXT NOT NULL, UNIQUE(session_id, unit_id, document_id));
CREATE TABLE leases(id TEXT PRIMARY KEY, session_id TEXT NOT NULL, kind TEXT NOT NULL, expires_at TEXT NOT NULL);
CREATE INDEX idx_leases_kind ON leases(kind, expires_at);
CREATE INDEX idx_docs_session_ref ON documents(session_id, reference);
