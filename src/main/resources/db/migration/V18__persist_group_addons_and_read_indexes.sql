ALTER TABLE resource_groups
    ADD COLUMN add_on_services JSONB NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(add_on_services) = 'array');

CREATE INDEX idx_reservations_tenant_slot ON reservations (tenant_id, slot_start DESC);
