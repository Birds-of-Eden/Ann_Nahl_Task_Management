# 🔧 Posting Task Creation - Debug & Test Guide

## ✅ সমস্ত Fix সম্পন্ন হয়েছে

### **Modified Files:**

1. ✅ `app/api/tasks/[id]/approve/route.ts`
   - Category info load করা হচ্ছে
   - QC detection fix হয়েছে
   - Detailed logging যোগ করা হয়েছে

2. ✅ `app/api/tasks/[id]/trigger-posting/route.ts`
   - "qc_approved" status accept করছে
   - Comprehensive logging যোগ করা হয়েছে
   - Step-by-step process trace করা যাবে

3. ✅ `components/clients/clientsID/task.tsx`
   - isCompleted check fix হয়েছে
   - Multiple approved statuses support করছে

4. ✅ `components/clients/clientsID/posting-task-status.tsx`
   - templateSiteAssetId optional করা হয়েছে
   - Component properly shows করছে

---

## 🧪 Testing Checklist

### **Step 1: QC Task Preparation**

```bash
# 1. Database check
SELECT id, name, status, categoryId, templateSiteAssetId, assignmentId 
FROM Task 
WHERE category IN (SELECT id FROM TaskCategory WHERE name LIKE '%QC%')
LIMIT 5;

# Expected fields:
✅ id: task_xxx
✅ name: "Facebook QC" (or similar)
✅ status: "pending" or "in_progress"
✅ categoryId: (should reference QC category)
✅ templateSiteAssetId: (should have value)
✅ assignmentId: (should have value)
```

### **Step 2: Approve QC Task**

```bash
# Go to: /qc/qc-review
# 1. Find QC task in list
# 2. Click "Approve" button
# 3. Set QC scores (⭐⭐⭐⭐⭐)
# 4. Add notes (optional)
# 5. Click "Approve Task"
```

### **Step 3: Check Console Logs**

**Backend Console (Server):**

```bash
# You should see these logs in sequence:

🔍 QC Task Detection: {
  taskId: "task_xxx",
  categoryName: "QC",
  isQcTask: true,
  hasTemplateAsset: true,
  hasAssignment: true
}

🚀 Attempting to trigger posting for QC task task_xxx...

📥 Trigger-posting called for task: task_xxx

📝 Request body: { actorId: "user_xxx", forceOverride: false }

✅ Task loaded: {
  id: "task_xxx",
  name: "Facebook QC",
  status: "qc_approved",
  category: "QC",
  templateSiteAssetId: 123,
  assignmentId: "assignment_xxx"
}

🔍 Is QC task: true (category: QC)

✓ Is approved: true (status: qc_approved)

📊 Posting settings: {
  requiredFrequency: 7,
  idealDurationMinutes: 30,
  period: "monthly",
  hasClientOverride: false
}

🔍 Existing posting tasks: 0

✅ Posting category ready: category_xxx

🚀 Creating 7 posting tasks...

  ✅ Created: Facebook - Posting 1/7 (task_yyy1)
  ✅ Created: Facebook - Posting 2/7 (task_yyy2)
  ✅ Created: Facebook - Posting 3/7 (task_yyy3)
  ✅ Created: Facebook - Posting 4/7 (task_yyy4)
  ✅ Created: Facebook - Posting 5/7 (task_yyy5)
  ✅ Created: Facebook - Posting 6/7 (task_yyy6)
  ✅ Created: Facebook - Posting 7/7 (task_yyy7)

🎉 Successfully created 7 posting tasks!

✅ Auto-triggered posting for QC task task_xxx: 7 tasks created
```

**Frontend Console (Browser):**

```bash
# Approve response should include:
{
  "id": "task_xxx",
  "status": "qc_approved",
  "autoTrigger": {
    "isQcTask": true,
    "postingTriggered": true,
    "postingResult": {
      "message": "Posting tasks generated successfully",
      "postingTasks": [...7 tasks...],
      "count": 7
    }
  }
}
```

### **Step 4: Database Verification**

```sql
-- Check QC task status
SELECT id, name, status, notes 
FROM Task 
WHERE id = 'task_xxx';
-- Expected: status = 'qc_approved'
-- Expected: notes contains '[POSTING TRIGGERED]'

-- Check posting tasks created
SELECT id, name, status, categoryId, templateSiteAssetId, dueDate
FROM Task 
WHERE assignmentId = 'assignment_xxx'
AND templateSiteAssetId = 123
AND categoryId = (SELECT id FROM TaskCategory WHERE name = 'Posting')
ORDER BY dueDate;
-- Expected: 7 tasks
-- Expected: All status = 'pending'
-- Expected: Names like "Facebook - Posting 1/7" to "7/7"

-- Check activity log
SELECT * FROM ActivityLog
WHERE entityId = 'task_xxx'
AND action = 'trigger_posting'
ORDER BY createdAt DESC
LIMIT 1;
-- Expected: One entry with posting details
```

### **Step 5: UI Verification (Client Dashboard)**

```bash
# Go to: Client Dashboard → Tasks tab

# 1. Find the QC task
✅ Should show status "qc_approved" badge

# 2. Look for PostingTaskStatus component
✅ Should see green box with "✓ Posting Tasks Generated (7)"

# 3. Check task list inside component
✅ Should show 7 posting tasks
✅ Each with name "Facebook - Posting X/7"
✅ All status "pending"

# 4. Check button availability
✅ Should see "Generate More Tasks" button
✅ Button should be clickable
```

---

## 🚨 Troubleshooting

### **Problem 1: No Console Logs Appearing**

**Symptom:** কোনো console log দেখা যাচ্ছে না

**Solution:**
```bash
# 1. Check server is running
npm run dev

# 2. Check browser console for frontend logs

# 3. Check terminal for backend logs

# 4. Force refresh browser (Ctrl+Shift+R)
```

---

### **Problem 2: "NOT_A_QC_TASK" Error**

**Symptom:**
```
⚠️ Failed to auto-trigger posting: NOT_A_QC_TASK
```

**Debug Steps:**
```sql
-- Check task category
SELECT t.id, t.name, tc.name as category_name
FROM Task t
LEFT JOIN TaskCategory tc ON t.categoryId = tc.id
WHERE t.id = 'task_xxx';
```

**Solution:**
- Category name MUST contain "qc" or "quality" (case insensitive)
- Examples: "QC", "QC Review", "Quality Check", "Social QC"

---

### **Problem 3: "QC_NOT_APPROVED" Error**

**Symptom:**
```
⚠️ Failed to auto-trigger posting: QC_NOT_APPROVED
```

**Debug Steps:**
```sql
-- Check task status
SELECT id, name, status 
FROM Task 
WHERE id = 'task_xxx';
```

**Valid Statuses:**
- ✅ `completed`
- ✅ `qc_approved`
- ✅ Any status containing "approved"

**Solution:**
- Make sure approve endpoint sets status to "qc_approved"
- Check if status enum includes "qc_approved"

---

### **Problem 4: "NO_ASSET_LINKED" Error**

**Symptom:**
```
⚠️ Failed to auto-trigger posting: NO_ASSET_LINKED
```

**Debug Steps:**
```sql
-- Check if task has templateSiteAssetId
SELECT id, name, templateSiteAssetId 
FROM Task 
WHERE id = 'task_xxx';
```

**Solution:**
- QC task MUST have `templateSiteAssetId` (e.g., Facebook, Twitter asset)
- Check assignment setup has assets configured
- Verify asset was selected during task creation

---

### **Problem 5: "NO_ASSIGNMENT_LINKED" Error**

**Symptom:**
```
⚠️ Failed to auto-trigger posting: NO_ASSIGNMENT_LINKED
```

**Debug Steps:**
```sql
-- Check if task has assignmentId
SELECT id, name, assignmentId 
FROM Task 
WHERE id = 'task_xxx';
```

**Solution:**
- Task MUST belong to an assignment
- Check task creation process includes assignment linking

---

### **Problem 6: "Posting tasks already exist" (Skipped)**

**Symptom:**
```
⏭️ Skipping: Posting tasks already exist
```

**Debug Steps:**
```sql
-- Check existing posting tasks
SELECT id, name, status 
FROM Task 
WHERE assignmentId = 'assignment_xxx'
AND templateSiteAssetId = 123
AND categoryId = (SELECT id FROM TaskCategory WHERE name = 'Posting')
AND status != 'cancelled';
```

**Solution:**
- This is NORMAL behavior (prevents duplicates)
- To regenerate, either:
  - Delete existing posting tasks
  - Use `forceOverride: true` in request body
  
**Manual Override:**
```typescript
// In posting-task-generator.tsx
body: JSON.stringify({
  actorId,
  frequency,
  period,
  startDate,
  forceOverride: true, // ← Add this
})
```

---

### **Problem 7: Button Not Showing in UI**

**Symptom:** PostingTaskStatus component not visible

**Debug Steps:**

**Check 1: Task Status**
```javascript
// In browser console
console.log("Task status:", task.status);
// Should be "qc_approved" or "completed"
```

**Check 2: isCompleted Prop**
```javascript
// Add to task.tsx line 694
console.log("isCompleted check:", {
  status: status,
  rawStatus: task.status,
  isCompleted: status === "completed" || 
    task.status?.toLowerCase() === "qc_approved" ||
    task.status?.toLowerCase().includes("approved")
});
```

**Check 3: Component Rendering**
```javascript
// Add to posting-task-status.tsx line 35
console.log("PostingTaskStatus mounted:", {
  isCompleted,
  templateSiteAssetId,
  assignmentId
});
```

**Solution:**
- Task status must be "qc_approved" or "completed"
- Component requires `isCompleted={true}`
- Check task.tsx line 694-698 for correct prop passing

---

### **Problem 8: Posting Frequency Wrong**

**Symptom:** Creating wrong number of posting tasks (not 7)

**Debug Steps:**
```sql
-- Check asset settings
SELECT * FROM AssignmentSiteAssetSetting
WHERE assignmentId = 'assignment_xxx'
AND templateSiteAssetId = 123;

-- Check template defaults
SELECT defaultPostingFrequency 
FROM TemplateSiteAsset
WHERE id = 123;
```

**Frequency Priority:**
1. Client-specific override (AssignmentSiteAssetSetting.requiredFrequency)
2. Template default (TemplateSiteAsset.defaultPostingFrequency)
3. Fallback: 4 tasks/month

---

## 📋 Manual Testing Script

Copy এই script টা terminal এ run করুন full test এর জন্য:

```bash
# 1. Check QC tasks
echo "=== QC Tasks ===="
psql $DATABASE_URL -c "SELECT id, name, status, categoryId FROM Task WHERE categoryId IN (SELECT id FROM TaskCategory WHERE name LIKE '%QC%') LIMIT 3;"

# 2. After approving, check status
echo "=== After Approve ===="
psql $DATABASE_URL -c "SELECT id, name, status FROM Task WHERE id = 'YOUR_TASK_ID';"

# 3. Check posting tasks
echo "=== Posting Tasks ===="
psql $DATABASE_URL -c "SELECT id, name, status, dueDate FROM Task WHERE assignmentId = 'YOUR_ASSIGNMENT_ID' AND categoryId = (SELECT id FROM TaskCategory WHERE name = 'Posting') ORDER BY dueDate;"

# 4. Check activity log
echo "=== Activity Log ===="
psql $DATABASE_URL -c "SELECT action, details FROM ActivityLog WHERE entityId = 'YOUR_TASK_ID' AND action = 'trigger_posting';"
```

---

## 🎯 Quick Diagnosis

### **Run This Checklist:**

```bash
✅ Step 1: QC task exists with correct category?
   Check: Task.categoryId → TaskCategory.name contains "qc"

✅ Step 2: QC task has required fields?
   Check: templateSiteAssetId and assignmentId are NOT NULL

✅ Step 3: Approve endpoint sets correct status?
   Check: After approve, status = "qc_approved"

✅ Step 4: trigger-posting accepts status?
   Check: isApproved check includes "qc_approved"

✅ Step 5: Category information loaded?
   Check: existing.category in approve route

✅ Step 6: Auto-trigger calling correctly?
   Check: Console shows "🚀 Attempting to trigger"

✅ Step 7: No existing posting tasks?
   Check: Database has no posting tasks for this asset

✅ Step 8: Posting category exists?
   Check: TaskCategory table has "Posting" entry

✅ Step 9: Tasks created in database?
   Check: SELECT count(*) shows 7 tasks

✅ Step 10: UI component shows?
   Check: PostingTaskStatus visible with button
```

---

## 🔥 Emergency Fix

যদি এখনও কাজ না করে, এই emergency steps follow করুন:

### **1. Clear Everything and Start Fresh:**

```sql
-- Delete existing posting tasks
DELETE FROM Task 
WHERE categoryId = (SELECT id FROM TaskCategory WHERE name = 'Posting')
AND assignmentId = 'YOUR_ASSIGNMENT_ID';

-- Reset QC task status
UPDATE Task 
SET status = 'completed'
WHERE id = 'YOUR_QC_TASK_ID';
```

### **2. Manual Trigger Test:**

```bash
# Test trigger-posting directly
curl -X POST http://localhost:3000/api/tasks/YOUR_TASK_ID/trigger-posting \
  -H "Content-Type: application/json" \
  -H "x-user-id: YOUR_USER_ID" \
  -d '{"actorId":"YOUR_USER_ID","forceOverride":true}'
```

### **3. Check Response:**

```json
// Success Response:
{
  "message": "Posting tasks generated successfully",
  "postingTasks": [...7 tasks...],
  "count": 7,
  "asset": {...},
  "frequency": {
    "required": 7,
    "period": "monthly"
  }
}

// Error Response:
{
  "message": "Failed to generate posting tasks",
  "error": "ERROR_CODE"
}
```

---

## 📞 Support Information

### **Common Error Codes:**

| Error Code | Meaning | Solution |
|------------|---------|----------|
| `TASK_NOT_FOUND` | Task ID invalid | Check task exists in database |
| `NOT_A_QC_TASK` | Wrong category | Category must contain "qc" |
| `QC_NOT_APPROVED` | Wrong status | Status must be approved |
| `NO_ASSET_LINKED` | No templateSiteAssetId | Link asset to task |
| `NO_ASSIGNMENT_LINKED` | No assignmentId | Link assignment to task |

---

## ✅ Success Indicators

### **You Know It's Working When:**

1. ✅ Console shows all green logs (✅ 🚀 🎉)
2. ✅ Database has 7 posting tasks
3. ✅ UI shows "Posting Tasks Generated (7)"
4. ✅ All posting tasks status "pending"
5. ✅ Activity log has "trigger_posting" entry
6. ✅ QC task notes updated with "[POSTING TRIGGERED]"
7. ✅ Response includes `autoTrigger.postingTriggered: true`

---

**Updated:** October 24, 2025  
**Status:** Comprehensive logging added, ready for testing  
**Next:** Test with actual QC task approval
