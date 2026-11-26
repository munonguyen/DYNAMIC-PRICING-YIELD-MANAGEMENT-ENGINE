-- A group created before automatic initialization may never have received a ruleset.
-- With no adjustment factors, the pricing engine uses the group's configured base price.
INSERT INTO yield_rule_sets (id, tenant_id, group_id, version_no, status, effective)
SELECT gen_random_uuid(), rg.tenant_id, rg.id, 1, 'ACTIVE', '(,)'::tstzrange
FROM resource_groups rg
WHERE NOT EXISTS (SELECT 1 FROM yield_rule_sets ys WHERE ys.group_id = rg.id)
ON CONFLICT (group_id, version_no) DO NOTHING;
