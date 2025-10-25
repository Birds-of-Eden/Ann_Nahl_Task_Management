-- ✅ Fix Posting Task Categories
-- This SQL fixes all existing posting tasks to use correct categories

-- Step 1: Ensure categories exist
INSERT INTO "TaskCategory" (id, name, "createdAt", "updatedAt")
VALUES 
  (gen_random_uuid(), 'Social Activity', NOW(), NOW()),
  (gen_random_uuid(), 'Blog Posting', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- Step 2: Fix social site posting tasks (Facebook, Twitter, Instagram, etc.)
UPDATE "Task" t
SET "categoryId" = (
  SELECT id FROM "TaskCategory" 
  WHERE name = 'Social Activity'
  LIMIT 1
)
FROM "TemplateSiteAsset" tsa
WHERE t."templateSiteAssetId" = tsa.id
  AND tsa.type IN ('social_site', 'other_asset')
  AND t.notes LIKE '%AUTO-GENERATED%'
  AND t.name ~ '-\d+$'  -- Matches pattern like "Facebook -1", "Twitter -2"
  AND t."categoryId" != (
    SELECT id FROM "TaskCategory" 
    WHERE name = 'Social Activity'
    LIMIT 1
  );

-- Step 3: Fix web2 site posting tasks (Medium, Tumblr, WordPress, etc.)
UPDATE "Task" t
SET "categoryId" = (
  SELECT id FROM "TaskCategory" 
  WHERE name = 'Blog Posting'
  LIMIT 1
)
FROM "TemplateSiteAsset" tsa
WHERE t."templateSiteAssetId" = tsa.id
  AND tsa.type = 'web2_site'
  AND t.notes LIKE '%AUTO-GENERATED%'
  AND t.name ~ '-\d+$'
  AND t."categoryId" != (
    SELECT id FROM "TaskCategory" 
    WHERE name = 'Blog Posting'
    LIMIT 1
  );

-- Step 4: Verify the fix
SELECT 
  tsa.type as asset_type,
  tc.name as category,
  COUNT(*) as task_count
FROM "Task" t
JOIN "TaskCategory" tc ON t."categoryId" = tc.id
JOIN "TemplateSiteAsset" tsa ON t."templateSiteAssetId" = tsa.id
WHERE t.notes LIKE '%AUTO-GENERATED%'
  AND t.name ~ '-\d+$'
GROUP BY tsa.type, tc.name
ORDER BY tsa.type, tc.name;

-- Expected Result:
-- asset_type    | category         | task_count
-- --------------|------------------|------------
-- social_site   | Social Activity  | X
-- web2_site     | Blog Posting     | Y
-- other_asset   | Social Activity  | Z
