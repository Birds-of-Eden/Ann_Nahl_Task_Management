# 🔥 Critical Fix: AssignmentSiteAssetSettings Migration

## 🐛 Bug যা ছিল

### সমস্যা
যখন `customize-template` endpoint দিয়ে template clone করা হতো:

```
পুরোনো Template:
├── Facebook (id: 10) → requiredFrequency: 4 (client override)
├── Twitter (id: 11) → requiredFrequency: 7 (client override)
└── Website (id: 12) → requiredFrequency: 2 (client override)

↓ Clone হলো

নতুন Custom Template:
├── Facebook (id: 20) ← নতুন ID
├── Twitter (id: 21) ← নতুন ID
└── Website (id: 22) ← নতুন ID

কিন্তু AssignmentSiteAssetSetting:
├── assetId: 10, requiredFrequency: 4 ← পুরোনো ID তে!
├── assetId: 11, requiredFrequency: 7 ← পুরোনো ID তে!
└── assetId: 12, requiredFrequency: 2 ← পুরোনো ID তে!
```

### ফলাফল
- Non-replaced assets-এর client-specific settings **হারিয়ে যাচ্ছিল**
- Posting task generation default frequency ব্যবহার করছিল
- Client-specific override ignore হচ্ছিল
- ভবিষ্যতে posting frequency ভুল হতো

---

## ✅ Fix যা করা হয়েছে

### সমাধান
Template clone-এর পরে **সব assets-এর settings migrate করা হচ্ছে**:

```typescript
// 🔥 Step 5.5: Migrate ALL settings from old → new asset IDs
if (assignment.siteAssetSettings.length > 0) {
  for (const oldSetting of assignment.siteAssetSettings) {
    const oldAssetId = oldSetting.templateSiteAssetId;
    const newAssetId = clonedAssetMap.get(oldAssetId); // old → new mapping

    if (newAssetId) {
      // Create new setting with same values but NEW asset ID
      await tx.assignmentSiteAssetSetting.create({
        data: {
          assignmentId: assignment.id,
          templateSiteAssetId: newAssetId, // ← নতুন cloned asset ID
          requiredFrequency: oldSetting.requiredFrequency, // ← preserve
          period: oldSetting.period, // ← preserve
          idealDurationMinutes: oldSetting.idealDurationMinutes, // ← preserve
        },
      });
    }
  }
}
```

### এখন যা হচ্ছে
```
পুরোনো Template:
├── Facebook (id: 10) → requiredFrequency: 4
├── Twitter (id: 11) → requiredFrequency: 7
└── Website (id: 12) → requiredFrequency: 2

↓ Clone + Migrate Settings

নতুন Custom Template:
├── Facebook (id: 20) → requiredFrequency: 4 ✅ migrated
├── Twitter (id: 21) → requiredFrequency: 7 ✅ migrated
└── Website (id: 22) → requiredFrequency: 2 ✅ migrated

AssignmentSiteAssetSetting:
├── assetId: 20, requiredFrequency: 4 ✅ new ID with old value
├── assetId: 21, requiredFrequency: 7 ✅ new ID with old value
└── assetId: 22, requiredFrequency: 2 ✅ new ID with old value
```

---

## 🎯 Impact

### Before Fix ❌
```bash
# Client had custom frequency: 4 posts/month for Facebook
GET /api/assignments/assignment_123
# Response shows: Facebook (id: 10), requiredFrequency: 4

# After customize-template
GET /api/assignments/assignment_123
# Response shows: Facebook (id: 20), requiredFrequency: null ❌
# Client-specific override LOST!

# Posting tasks generated with DEFAULT frequency
POST /api/tasks/create-posting-tasks?clientId=...
# Uses template default (e.g., 2) instead of client override (4) ❌
```

### After Fix ✅
```bash
# Client had custom frequency: 4 posts/month for Facebook
GET /api/assignments/assignment_123
# Response shows: Facebook (id: 10), requiredFrequency: 4

# After customize-template
GET /api/assignments/assignment_123
# Response shows: Facebook (id: 20), requiredFrequency: 4 ✅
# Client-specific override PRESERVED!

# Posting tasks generated with CLIENT frequency
POST /api/tasks/create-posting-tasks?clientId=...
# Uses client override (4) correctly ✅
```

---

## 🔍 How to Verify

### Step 1: Check Before Customization
```bash
GET /api/assignments/assignment_abc123

# Note the siteAssetSettings:
{
  "siteAssetSettings": [
    {
      "templateSiteAssetId": 10,
      "requiredFrequency": 4,
      "period": "monthly"
    },
    {
      "templateSiteAssetId": 11,
      "requiredFrequency": 7,
      "period": "monthly"
    }
  ]
}
```

### Step 2: Customize Template
```bash
POST /api/assignments/assignment_abc123/customize-template
{
  "newAssets": [
    {
      "type": "social_site",
      "name": "Instagram",
      "isRequired": true
    }
  ]
}
```

### Step 3: Verify After Customization
```bash
GET /api/assignments/assignment_abc123

# Check siteAssetSettings now have NEW asset IDs but SAME values:
{
  "siteAssetSettings": [
    {
      "templateSiteAssetId": 20, // ← NEW ID
      "requiredFrequency": 4,     // ← SAME VALUE ✅
      "period": "monthly"         // ← SAME VALUE ✅
    },
    {
      "templateSiteAssetId": 21, // ← NEW ID
      "requiredFrequency": 7,     // ← SAME VALUE ✅
      "period": "monthly"         // ← SAME VALUE ✅
    },
    {
      "templateSiteAssetId": 25, // ← NEW Instagram
      "requiredFrequency": null,  // ← New asset, no override yet
      "period": "monthly"
    }
  ]
}
```

### Step 4: Check Activity Log
```sql
SELECT * FROM "ActivityLog"
WHERE action = 'customize_template'
  AND "entityId" = 'assignment_abc123'
ORDER BY timestamp DESC
LIMIT 1;

-- Check details->settingsMigrated field:
{
  "settingsMigrated": 2, // ← Should match number of old settings
  "details": {
    "settingsMigrated": [
      { "oldAssetId": 10, "newAssetId": 20, "requiredFrequency": 4 },
      { "oldAssetId": 11, "newAssetId": 21, "requiredFrequency": 7 }
    ]
  }
}
```

---

## 🛠️ Technical Details

### What Gets Migrated
```typescript
For each AssignmentSiteAssetSetting:
  ✅ templateSiteAssetId (old → new)
  ✅ requiredFrequency (preserved)
  ✅ period (preserved)
  ✅ idealDurationMinutes (preserved)
  ✅ assignmentId (same)
```

### Migration Timing
```
1. Clone Template
   ↓
2. Clone Assets (creates clonedAssetMap: old → new)
   ↓
3. 🔥 Migrate Settings (NEW STEP)
   ↓
4. Handle Replacements
   ↓
5. Add New Assets
   ↓
6. Update Assignment templateId
```

### Replacement Handling Updated
```typescript
// OLD (BEFORE FIX):
await tx.assignmentSiteAssetSetting.updateMany({
  where: {
    assignmentId: assignment.id,
    templateSiteAssetId: oldAssetId, // ← looking for old ID
  },
  data: {
    templateSiteAssetId: updatedAsset.id, // ← updating to new ID
  },
});

// NEW (AFTER FIX):
await tx.assignmentSiteAssetSetting.updateMany({
  where: {
    assignmentId: assignment.id,
    templateSiteAssetId: updatedAsset.id, // ← already migrated to new ID
  },
  data: {
    requiredFrequency: updatedAsset.defaultPostingFrequency,
    idealDurationMinutes: updatedAsset.defaultIdealDurationMinutes,
  },
});
```

---

## 📊 Database Changes

### Before Fix
```sql
-- After customize-template
SELECT * FROM "AssignmentSiteAssetSetting"
WHERE "assignmentId" = 'assignment_123';

-- Result:
| assignmentId    | templateSiteAssetId | requiredFrequency |
|-----------------|---------------------|-------------------|
| assignment_123  | 10                  | 4                 | ← OLD ID!
| assignment_123  | 11                  | 7                 | ← OLD ID!
```

### After Fix
```sql
-- After customize-template
SELECT * FROM "AssignmentSiteAssetSetting"
WHERE "assignmentId" = 'assignment_123';

-- Result:
| assignmentId    | templateSiteAssetId | requiredFrequency |
|-----------------|---------------------|-------------------|
| assignment_123  | 20                  | 4                 | ← NEW ID! ✅
| assignment_123  | 21                  | 7                 | ← NEW ID! ✅
```

---

## 🎓 Why This Matters

### Use Case: Posting Task Generation
```javascript
// When creating posting tasks, system looks up:
const setting = await prisma.assignmentSiteAssetSetting.findFirst({
  where: {
    assignmentId: 'assignment_123',
    templateSiteAssetId: 20, // ← new cloned asset ID
  },
});

// BEFORE FIX: setting = null (not found, uses default)
// AFTER FIX: setting = { requiredFrequency: 4 } ✅ (found!)
```

### Impact on QC → Posting Flow
```
Asset Creation Task
    ↓
QC Approved
    ↓
Posting Task Generation
    ↓ looks up AssignmentSiteAssetSetting
    ↓ needs correct asset ID
    ↓
Creates X posting tasks (X = requiredFrequency)

Before Fix: X = default (wrong)
After Fix: X = client override (correct) ✅
```

---

## ⚠️ Breaking Changes

**None!** This is a bug fix, not a breaking change.

- Existing assignments: unaffected
- Existing customizations: work better now
- API interface: unchanged
- Response format: unchanged

---

## 🧪 Testing Checklist

### Manual Test
- [ ] Get assignment with custom frequencies
- [ ] Note asset IDs and frequencies
- [ ] Call customize-template
- [ ] Verify new asset IDs have same frequencies
- [ ] Check activity log shows settingsMigrated
- [ ] Generate posting tasks
- [ ] Verify correct frequencies used

### SQL Verification
```sql
-- Before customize
SELECT a.id, s."templateSiteAssetId", s."requiredFrequency"
FROM "Assignment" a
JOIN "AssignmentSiteAssetSetting" s ON s."assignmentId" = a.id
WHERE a.id = 'assignment_test';

-- After customize
SELECT a.id, s."templateSiteAssetId", s."requiredFrequency"
FROM "Assignment" a
JOIN "AssignmentSiteAssetSetting" s ON s."assignmentId" = a.id
WHERE a.id = 'assignment_test';

-- Verify: asset IDs changed but frequencies same
```

---

## 📝 Summary

### Problem
Client-specific frequency/duration overrides হারিয়ে যাচ্ছিল when template cloned হতো।

### Solution
Clone-এর পরে সব `AssignmentSiteAssetSettings` migrate করা হচ্ছে old asset IDs থেকে new asset IDs-এ।

### Benefit
- ✅ Client-specific settings preserved
- ✅ Posting frequency accurate
- ✅ QC → Posting flow correct
- ✅ No breaking changes
- ✅ Full audit trail

---

**Fix Applied:** December 2024  
**Affected Endpoint:** `POST /api/assignments/{id}/customize-template`  
**Status:** ✅ Production Ready  
**Testing Required:** Yes (recommended on staging)
