CREATE TABLE idempotency_keys(session_id TEXT NOT NULL, key TEXT NOT NULL, payload_hash TEXT NOT NULL, unit_id TEXT NOT NULL, action TEXT NOT NULL, event_id TEXT NOT NULL, new_state TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(session_id, key));
CREATE TABLE transfers(id TEXT PRIMARY KEY, session_id TEXT NOT NULL, unit_id TEXT NOT NULL, sender_id TEXT NOT NULL, recipient_id TEXT NOT NULL, dispatch_event_id TEXT NOT NULL, receipt_event_id TEXT, status TEXT NOT NULL DEFAULT 'pending');
CREATE INDEX idx_transfers_unit ON transfers(session_id, unit_id, status);
CREATE INDEX idx_events_unit_rowid ON events(session_id, unit_id);
ALTER TABLE investigations ADD COLUMN mode TEXT NOT NULL DEFAULT 'simulated';
