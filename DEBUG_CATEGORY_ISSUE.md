# 🔍 Debug Guide: Category Issue in Distribution Page

## 🐛 Problem Statement

**Issue:** Posting tasks appearing under "Asset Creation" category in Category-Based Task Distribution dropdown, instead of "Social Activity" or "Blog Posting".

---

## 🔧 Enhanced Logging Added

### **New Console Logs to Check:**

When QC approving a task, you should now see:

```bash
# 1. Asset Type Detection
🔍 Asset Type Detection: {
  assetId: 123,
  assetName: "Facebook",
  assetType: "social_site",      ← Check this!
  resolvedCategory: "Social Activity"  ← Should be correct
}

# 2. Category Resolution
✅ Found existing category: Social Activity (category_id_xxx)
# OR
✅ Created new category: Social Activity (category_id_xxx)

# 3. Final Confirmation
✅ Category resolved: Social Activity (ID: category_id_xxx)

# 4. Task Creation with Verification
🚀 Creating 9 posting tasks (3/month × 3 months)...
  ✅ Created: Facebook -1 | Category: Social Activity | ID: task_yyy1
  ✅ Created: Facebook -2 | Category: Social Activity | ID: task_yyy2
  ...
  ✅ Created: Facebook -9 | Category: Social Activity | ID: task_yyy9
```

---

## 🔍 Step-by-Step Debugging

### **Step 1: Test the Flow**

```bash
1. Go to QC Review page
2. Find a "Social Asset Creation" task (e.g., Facebook)
3. Approve it
4. Open browser console (F12)
5. Check server console logs
```

### **Step 2: Verify Console Logs**

**What to look for:**

```bash
# ✅ CORRECT LOGS:
🔍 Asset Type Detection: {
  assetType: "social_site",        ← Should NOT be null/undefined
  resolvedCategory: "Social Activity"  ← Should be correct
}

✅ Found existing category: Social Activity
✅ Created: Facebook -1 | Category: Social Activity

# ❌ WRONG LOGS (if you see these):
🔍 Asset Type Detection: {
  assetType: null,                 ← PROBLEM!
  resolvedCategory: "Social Activity"  ← Will still default to Social Activity
}

# OR
✅ Created: Facebook -1 | Category: Asset Creation  ← PROBLEM!
```

### **Step 3: Database Verification**

```sql
-- Check the actual category in database
SELECT 
  t.id,
  t.name,
  tc.name as category_name,
  t.categoryId,
  tsa.name as asset_name,
  tsa.type as asset_type
FROM Task t
LEFT JOIN TaskCategory tc ON t.categoryId = tc.id
LEFT JOIN TemplateSiteAsset tsa ON t.templateSiteAssetId = tsa.id
WHERE t.name LIKE '%Facebook%'
  AND t.createdAt > NOW() - INTERVAL '1 hour'
ORDER BY t.createdAt DESC
LIMIT 10;
```

**Expected Result:**
```
name         | category_name    | asset_type
-------------|------------------|-------------
Facebook -1  | Social Activity  | social_site  ✅
Facebook -2  | Social Activity  | social_site  ✅
```

**Wrong Result:**
```
name         | category_name   | asset_type
-------------|-----------------|-------------
Facebook -1  | Asset Creation  | social_site  ❌
```

---

## 🔧 Possible Issues & Solutions

### **Issue 1: Old Tasks Still Exist** 

**Problem:** Tasks created before the fix still have wrong category.

**Solution:**
```sql
-- Fix old tasks
UPDATE Task t
SET categoryId = (
  SELECT id FROM TaskCategory 
  WHERE name = 'Social Activity'
  LIMIT 1
)
FROM TemplateSiteAsset tsa
WHERE t.templateSiteAssetId = tsa.id
  AND tsa.type IN ('social_site', 'other_asset')
  AND t.categoryId = (
    SELECT id FROM TaskCategory 
    WHERE name = 'Asset Creation'
    LIMIT 1
  )
  AND t.name LIKE '%-_'  -- Pattern for posting tasks
  AND t.notes LIKE '%AUTO-GENERATED%';

-- Fix web2 tasks
UPDATE Task t
SET categoryId = (
  SELECT id FROM TaskCategory 
  WHERE name = 'Blog Posting'
  LIMIT 1
)
FROM TemplateSiteAsset tsa
WHERE t.templateSiteAssetId = tsa.id
  AND tsa.type = 'web2_site'
  AND t.categoryId = (
    SELECT id FROM TaskCategory 
    WHERE name = 'Asset Creation'
    LIMIT 1
  )
  AND t.name LIKE '%-_'
  AND t.notes LIKE '%AUTO-GENERATED%';
```

---

### **Issue 2: Asset Type Not Being Loaded**

**Problem:** `qcTask.templateSiteAsset?.type` is null.

**Check:**
```sql
-- Verify asset has type
SELECT id, name, type
FROM TemplateSiteAsset
WHERE id = YOUR_ASSET_ID;
```

**If type is NULL, update it:**
```sql
-- Update missing asset types
UPDATE TemplateSiteAsset
SET type = 'social_site'
WHERE name IN ('Facebook', 'Twitter', 'Instagram', 'LinkedIn', 'Pinterest')
  AND (type IS NULL OR type = '');

UPDATE TemplateSiteAsset
SET type = 'web2_site'
WHERE name IN ('Medium', 'Tumblr', 'WordPress', 'Blogger', 'Weebly')
  AND (type IS NULL OR type = '');
```

---

### **Issue 3: Category Not Being Found**

**Problem:** "Social Activity" or "Blog Posting" category doesn't exist.

**Check:**
```sql
-- Check if categories exist
SELECT id, name
FROM TaskCategory
WHERE name IN ('Social Activity', 'Blog Posting', 'Asset Creation');
```

**If missing, create them:**
```sql
-- Create missing categories
INSERT INTO TaskCategory (id, name, createdAt, updatedAt)
VALUES 
  (gen_random_uuid(), 'Social Activity', NOW(), NOW()),
  (gen_random_uuid(), 'Blog Posting', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;
```

---

### **Issue 4: Transaction Rollback**

**Problem:** Task creation fails, transaction rolls back.

**Check console for:**
```bash
❌ Error auto-triggering posting: [error details]
```

**Solution:** Fix the underlying error first.

---

## 🧪 Testing Procedure

### **Complete Test:**

```bash
# 1. Clean slate (optional)
DELETE FROM Task 
WHERE categoryId IN (
  SELECT id FROM TaskCategory 
  WHERE name IN ('Social Activity', 'Blog Posting')
)
AND notes LIKE '%AUTO-GENERATED%';

# 2. Add new asset
- Go to client dashboard
- Add Facebook asset
- Task created: "Facebook - Social Asset Creation"

# 3. Complete task
- Assign to agent
- Agent completes
- Status: completed

# 4. QC Approve
- Go to /qc/qc-review
- Find the Facebook task
- Click Approve
- ✅ Watch console logs!

# 5. Verify Console Logs
Should see:
  🔍 Asset Type Detection: { assetType: "social_site", resolvedCategory: "Social Activity" }
  ✅ Found existing category: Social Activity
  ✅ Created: Facebook -1 | Category: Social Activity

# 6. Verify Database
SELECT t.name, tc.name as category
FROM Task t
JOIN TaskCategory tc ON t.categoryId = tc.id
WHERE t.name LIKE 'Facebook -%'
ORDER BY t.createdAt DESC;

Should show:
  name         | category
  -------------|------------------
  Facebook -1  | Social Activity  ✅
  Facebook -2  | Social Activity  ✅

# 7. Verify Distribution Page
- Go to: Distribution → Category-Based Task Distribution
- Select Category dropdown
- Select: "Social Activity"
- ✅ Should see: All Facebook posting tasks
- Select: "Asset Creation"
- ✅ Should NOT see: Facebook posting tasks
```

---

## 📊 Expected vs Actual

### **Console Logs Comparison:**

| Step | Expected | If Wrong |
|------|----------|----------|
| Asset Type | `assetType: "social_site"` | `assetType: null` → Asset not loaded |
| Category | `resolvedCategory: "Social Activity"` | `resolvedCategory: "Asset Creation"` → Logic error |
| Category Found | `Found existing category: Social Activity` | `Created new category: Asset Creation` → Wrong category used |
| Task Created | `Category: Social Activity` | `Category: Asset Creation` → categoryId wrong |

---

## 🔍 Advanced Debugging

### **If All Else Fails:**

**1. Check API Response:**
```bash
# In browser console when approving:
fetch('/api/tasks/TASK_ID/approve', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ reviewerId: 'USER_ID', status: 'qc_approved' })
})
.then(r => r.json())
.then(d => console.log('Approve Response:', d));
```

**2. Check Trigger-Posting Directly:**
```bash
# Test trigger-posting directly
fetch('/api/tasks/TASK_ID/trigger-posting', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ actorId: 'USER_ID', forceOverride: true })
})
.then(r => r.json())
.then(d => console.log('Trigger Response:', d));
```

**3. Check Task Data:**
```sql
-- Get full task data
SELECT 
  t.id,
  t.name,
  t.categoryId,
  tc.name as category_name,
  t.templateSiteAssetId,
  tsa.name as asset_name,
  tsa.type as asset_type,
  t.assignmentId,
  t.notes
FROM Task t
LEFT JOIN TaskCategory tc ON t.categoryId = tc.id
LEFT JOIN TemplateSiteAsset tsa ON t.templateSiteAssetId = tsa.id
WHERE t.id = 'YOUR_TASK_ID';
```

---

## ✅ Success Criteria

**When everything works correctly:**

1. ✅ Console shows: `assetType: "social_site"` (not null)
2. ✅ Console shows: `resolvedCategory: "Social Activity"`
3. ✅ Console shows: `Category: Social Activity` for each created task
4. ✅ Database shows: tasks in "Social Activity" category
5. ✅ Distribution page: tasks appear under "Social Activity"
6. ✅ Distribution page: tasks NOT under "Asset Creation"

---

## 🚨 Common Mistakes

### **Mistake 1: Looking at Old Tasks**
- Fix only affects NEW tasks created after code change
- Old tasks remain in wrong category until manually fixed

### **Mistake 2: Cache Issues**
- Clear browser cache
- Restart Next.js dev server
- Check database directly (not just UI)

### **Mistake 3: Wrong Task Type**
- Make sure you're testing "Social Asset Creation" tasks
- Not testing regular "Asset Creation" tasks

---

## 📝 Action Items

### **Immediate Actions:**

1. ✅ QC approve a Facebook asset creation task
2. ✅ Check console logs for category resolution
3. ✅ Query database to verify actual category
4. ✅ Check distribution page dropdown
5. ✅ Share console logs with me

### **If Issue Persists:**

1. Share console logs (full output)
2. Share database query results
3. Share screenshot of distribution page
4. Tell me the exact asset name being tested

---

**Next Step:** Please QC approve একটা Facebook বা Twitter asset creation task এবং console logs আমাকে share করুন! 🔍
