CREATE TABLE court_floor_plans (
    group_id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    width_cm INTEGER NOT NULL CHECK (width_cm BETWEEN 100 AND 50000),
    length_cm INTEGER NOT NULL CHECK (length_cm BETWEEN 100 AND 50000),
    placements JSONB NOT NULL CHECK (jsonb_typeof(placements) = 'array'),
    version INTEGER NOT NULL CHECK (version > 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id, group_id) REFERENCES resource_groups (tenant_id, id)
);

CREATE INDEX idx_court_floor_plans_tenant ON court_floor_plans (tenant_id);
