# Custom Template System for Client-Specific Asset Management

## 🎯 Purpose

This system allows you to add or replace SiteAssets for a specific client during their active package duration, without affecting other clients using the same template.

## 🔑 Key Features

✅ **Clone template** for specific client (isolation)  
✅ **Add new assets** without touching existing tasks  
✅ **Replace assets** and auto-archive old tasks  
✅ **Auto-generate tasks** only for new/replaced assets  
✅ **Zero impact** on other clients  
✅ **No schema changes** required  

---

## 📋 System Overview

### Problem Solved
- Client A has an active package with a default template
- After 2 months, Client A wants to add or replace some SiteAssets
- Cannot modify the default template (affects other clients B, C, etc.)
- Need a way to customize only for Client A

### Solution Architecture
1. **Clone the template** → Create custom version for Client A
2. **Update assignment** → Point to the custom template
3. **Detect changes** → Find new/replaced assets
4. **Generate tasks** → Only for new/replaced assets
5. **Archive old tasks** → When replacing assets

---

## 🚀 API Endpoints

### 1. Clone Template for Client
**Endpoint:** `POST /api/templates/{templateId}/clone-for-client`

Creates a custom copy of a template specifically for a client.

**Request Body:**
```json
{
  "clientId": "client_123",
  "customName": "Custom Template for Client ABC" // Optional
}
```

**Response:**
```json
{
  "message": "Template cloned successfully for client",
  "template": {
    "id": "template_custom_456",
    "name": "Template ABC (Custom for Client ABC)",
    "description": "Custom template for client: Client ABC. Cloned from: Template ABC",
    "sitesAssets": [...],
    "templateTeamMembers": [...]
  }
}
```

**Use Case:** Manual template cloning (if you want to modify template first, then update assignment later)

---

### 2. Add Assets to Template
**Endpoint:** `POST /api/templates/{templateId}/add-assets`

Adds new site assets to an existing template (useful for custom templates).

**Request Body:**
```json
{
  "assets": [
    {
      "type": "social_site",
      "name": "New Facebook Page",
      "url": "https://facebook.com/newpage",
      "description": "Additional social asset",
      "isRequired": true,
      "defaultPostingFrequency": 5,
      "defaultIdealDurationMinutes": 45
    },
    {
      "type": "backlinks",
      "name": "Guest Post Link",
      "isRequired": false,
      "defaultPostingFrequency": 2
    }
  ]
}
```

**Response:**
```json
{
  "message": "Assets added successfully to template",
  "template": {...},
  "createdAssets": [...]
}
```

**Use Case:** Adding new assets to an already-created custom template

---

### 3. Sync Assignment with New Template
**Endpoint:** `POST /api/assignments/{assignmentId}/sync-template`

Updates an assignment to use a different template and handles asset changes.

**Request Body:**
```json
{
  "newTemplateId": "template_custom_456",
  "replacements": [
    {
      "oldAssetId": 10,
      "newAssetId": 25
    }
  ],
  "autoArchiveOld": true
}
```

**Response:**
```json
{
  "message": "Assignment synced successfully with new template",
  "assignment": {
    "id": "assignment_789",
    "templateId": "template_custom_456",
    "tasks": [...],
    "siteAssetSettings": [...]
  }
}
```

**Use Case:** After manually cloning template and adding assets, sync the assignment

---

### 4. ⭐ Customize Template (ONE-STEP SOLUTION)
**Endpoint:** `POST /api/assignments/{assignmentId}/customize-template`

**This is the recommended endpoint** - it does everything in one atomic transaction:
1. Clones the current template
2. Adds new assets
3. Replaces existing assets
4. Archives old tasks for replaced assets
5. Creates new tasks for new/replaced assets
6. Updates assignment

**Request Body:**
```json
{
  "customTemplateName": "Custom Template for Client ABC",
  "newAssets": [
    {
      "type": "social_site",
      "name": "Instagram Account",
      "url": "https://instagram.com/example",
      "description": "New social media asset",
      "isRequired": true,
      "defaultPostingFrequency": 10,
      "defaultIdealDurationMinutes": 30
    },
    {
      "type": "guest_posting",
      "name": "Guest Post Campaign",
      "isRequired": false,
      "defaultPostingFrequency": 3,
      "defaultIdealDurationMinutes": 60
    }
  ],
  "replacements": [
    {
      "oldAssetId": 12,
      "newAssetName": "Updated Twitter Account",
      "newAssetType": "social_site",
      "newAssetUrl": "https://twitter.com/newaccount",
      "newAssetDescription": "Replacing old Twitter",
      "isRequired": true,
      "defaultPostingFrequency": 7,
      "defaultIdealDurationMinutes": 25
    }
  ]
}
```

**Response:**
```json
{
  "message": "Custom template created and assignment updated successfully",
  "assignment": {
    "id": "assignment_789",
    "templateId": "template_custom_new",
    "client": {...},
    "template": {
      "id": "template_custom_new",
      "name": "Custom Template for Client ABC",
      "sitesAssets": [...]
    },
    "tasks": [...],
    "siteAssetSettings": [...]
  }
}
```

**What Happens:**
- ✅ Custom template created with all old assets + new assets
- ✅ Replaced assets updated with new details
- ✅ Old tasks for replaced assets → archived/cancelled
- ✅ New tasks created for new/replaced assets
- ✅ Assignment updated to use custom template
- ✅ Other clients remain unaffected

---

### 5. Regenerate Tasks
**Endpoint:** `POST /api/assignments/{assignmentId}/regenerate-tasks`

Regenerates tasks for assets that don't have tasks yet (useful after manually modifying template).

**Request Body:**
```json
{
  "onlyMissing": true,      // Only create tasks for assets without tasks
  "forceRecreate": false    // If true, archives all tasks and recreates them
}
```

**Response:**
```json
{
  "message": "Tasks regenerated successfully",
  "assignment": {...}
}
```

**Use Case:** After manually adding assets to a template via database or other means

---

## 📝 Complete Workflow Examples

### Example 1: Add New Assets Only (Simple Case)

**Scenario:** Client A wants to add 2 new social media accounts to their package.

**Steps:**
```bash
# ONE API CALL - Use customize-template endpoint
POST /api/assignments/assignment_abc123/customize-template

{
  "newAssets": [
    {
      "type": "social_site",
      "name": "TikTok Account",
      "url": "https://tiktok.com/@clienta",
      "isRequired": true,
      "defaultPostingFrequency": 15,
      "defaultIdealDurationMinutes": 20
    },
    {
      "type": "social_site",
      "name": "LinkedIn Company Page",
      "url": "https://linkedin.com/company/clienta",
      "isRequired": true,
      "defaultPostingFrequency": 8,
      "defaultIdealDurationMinutes": 30
    }
  ]
}
```

**Result:**
- ✅ Custom template created with existing + 2 new assets
- ✅ 2 new tasks created for TikTok and LinkedIn
- ✅ All existing tasks remain unchanged
- ✅ Other clients (B, C) unaffected

---

### Example 2: Replace Existing Assets

**Scenario:** Client A wants to replace their old Twitter account with a new one.

**Steps:**
```bash
# Find the old asset ID first (from assignment.template.sitesAssets)
# Let's say old Twitter asset has ID: 45

POST /api/assignments/assignment_abc123/customize-template

{
  "replacements": [
    {
      "oldAssetId": 45,
      "newAssetName": "New Twitter Account @ClientA_Official",
      "newAssetType": "social_site",
      "newAssetUrl": "https://twitter.com/ClientA_Official",
      "newAssetDescription": "New official Twitter account",
      "isRequired": true,
      "defaultPostingFrequency": 10,
      "defaultIdealDurationMinutes": 25
    }
  ]
}
```

**Result:**
- ✅ Custom template created
- ✅ Old Twitter asset updated with new details
- ✅ Old tasks for Twitter → archived/cancelled
- ✅ New task created for new Twitter account
- ✅ Other clients unaffected

---

### Example 3: Add New + Replace Existing (Complex Case)

**Scenario:** Client A wants to:
- Add Instagram and Pinterest
- Replace old Facebook page with new one
- Replace old website URL

**Steps:**
```bash
POST /api/assignments/assignment_abc123/customize-template

{
  "customTemplateName": "Client A Custom Package - Dec 2024",
  "newAssets": [
    {
      "type": "social_site",
      "name": "Instagram Business",
      "url": "https://instagram.com/clienta_business",
      "isRequired": true,
      "defaultPostingFrequency": 20,
      "defaultIdealDurationMinutes": 25
    },
    {
      "type": "social_site",
      "name": "Pinterest Board",
      "url": "https://pinterest.com/clienta",
      "isRequired": false,
      "defaultPostingFrequency": 5,
      "defaultIdealDurationMinutes": 30
    }
  ],
  "replacements": [
    {
      "oldAssetId": 23,
      "newAssetName": "New Facebook Business Page",
      "newAssetUrl": "https://facebook.com/clienta-official",
      "isRequired": true,
      "defaultPostingFrequency": 12
    },
    {
      "oldAssetId": 24,
      "newAssetName": "Updated Company Website",
      "newAssetType": "web2_site",
      "newAssetUrl": "https://clienta-new-domain.com",
      "isRequired": true,
      "defaultPostingFrequency": 8
    }
  ]
}
```

**Result:**
- ✅ Custom template created: "Client A Custom Package - Dec 2024"
- ✅ 2 new tasks for Instagram + Pinterest
- ✅ 2 replacement tasks for Facebook + Website
- ✅ 4 old tasks archived (old Facebook + Website tasks)
- ✅ All other existing tasks remain unchanged
- ✅ Other clients unaffected

---

## 🔍 How It Works Internally

### 1. Template Cloning Process
```
Original Template (ID: temp_1)
├── Asset A (ID: 10)
├── Asset B (ID: 11)
└── Asset C (ID: 12)

↓ Clone for Client A

Custom Template (ID: temp_custom_1)
├── Asset A (ID: 20) ← Cloned
├── Asset B (ID: 21) ← Cloned
└── Asset C (ID: 22) ← Cloned
```

### 2. Asset Replacement Mapping
```
Assignment has tasks:
- Task 1 → Asset 10 (old Twitter)
- Task 2 → Asset 11 (Facebook)
- Task 3 → Asset 12 (Website)

Replacement Request:
{
  oldAssetId: 10,  // Old Twitter
  newAssetId: 20   // New Twitter in custom template
}

Result:
- Task 1 → Archived (cancelled)
- NEW Task 4 → Asset 20 (New Twitter)
- Task 2 → Unchanged
- Task 3 → Unchanged
```

### 3. Task Generation Logic
```javascript
// Only creates tasks for:
1. NEW assets (not in original template)
2. REPLACED assets (with old tasks archived)

// Does NOT create tasks for:
- Existing assets that already have tasks
- Assets from original template (unless replaced)
```

---

## 🧪 Testing Guide

### Test Case 1: Simple Add
```bash
# Get assignment info
GET /api/assignments/assignment_123

# Note: template.sitesAssets should have N assets
# Note: tasks should have M tasks

# Customize
POST /api/assignments/assignment_123/customize-template
{
  "newAssets": [
    {
      "type": "social_site",
      "name": "Test New Asset",
      "isRequired": true,
      "defaultPostingFrequency": 5
    }
  ]
}

# Verify
GET /api/assignments/assignment_123

# Expected:
# - template.id should be different (new custom template)
# - template.sitesAssets should have N+1 assets
# - tasks should have M+1 tasks (one new task for new asset)
# - All old tasks should be unchanged (same IDs, status, etc.)
```

### Test Case 2: Replacement
```bash
# Get asset ID to replace
GET /api/assignments/assignment_123
# Note: Find an asset ID, let's say ID: 15

# Replace
POST /api/assignments/assignment_123/customize-template
{
  "replacements": [
    {
      "oldAssetId": 15,
      "newAssetName": "Replaced Asset",
      "isRequired": true
    }
  ]
}

# Verify
GET /api/assignments/assignment_123

# Expected:
# - Old tasks for asset 15 should have status: "cancelled"
# - New task should exist for the replaced asset
# - Task count = M - (old tasks for asset 15) + 1
```

---

## 🚨 Important Notes

### Data Integrity
- ✅ All operations are wrapped in transactions
- ✅ If any step fails, everything rolls back
- ✅ Activity logs track all changes

### Performance
- ✅ Uses efficient bulk operations (createMany)
- ✅ Minimal database queries with proper includes
- ✅ Indexed lookups on key fields

### Limitations
- ⚠️ Cannot "un-customize" back to default template automatically
  - Solution: Create a new assignment or manually delete custom template
- ⚠️ Custom templates increase database size
  - Solution: Periodic cleanup of unused custom templates
- ⚠️ Team members are cloned but may need re-assignment
  - Solution: Review team assignments after customization

### Best Practices
1. Always use `customize-template` endpoint (one-step solution)
2. Provide clear custom template names (include client name + date)
3. Use replacements instead of delete + add for better tracking
4. Review archived tasks periodically
5. Test on non-production first

---

## 📊 Database Impact

### What Gets Created
- ✅ 1 new Template record
- ✅ N new TemplateSiteAsset records (N = assets in original template + new assets)
- ✅ M new TemplateTeamMember records (M = team members in original template)
- ✅ 1 Assignment update (templateId changed)
- ✅ P new Task records (P = new/replaced assets)
- ✅ P new AssignmentSiteAssetSetting records
- ✅ 1 ActivityLog record

### What Gets Updated
- ✅ Old tasks → status changed to "cancelled" (for replacements)
- ✅ Assignment → templateId updated

### What Remains Unchanged
- ✅ Original template and its assets
- ✅ Other clients' assignments
- ✅ Other clients' tasks
- ✅ Client record
- ✅ Package record

---

## 🎓 Frontend Integration Example

```typescript
// Example: Add new assets for a client

const customizeClientTemplate = async (
  assignmentId: string,
  newAssets: any[],
  replacements: any[]
) => {
  try {
    const response = await fetch(
      `/api/assignments/${assignmentId}/customize-template`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-actor-id': currentUserId, // Optional: for activity logging
        },
        body: JSON.stringify({
          customTemplateName: `Custom for ${clientName} - ${new Date().toLocaleDateString()}`,
          newAssets,
          replacements,
        }),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to customize template');
    }

    const data = await response.json();
    console.log('✅ Template customized:', data.assignment);
    
    // Refresh assignment data
    return data.assignment;
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
};

// Usage
await customizeClientTemplate(
  'assignment_123',
  [
    {
      type: 'social_site',
      name: 'Instagram',
      isRequired: true,
      defaultPostingFrequency: 10,
    },
  ],
  []
);
```

---

## 📞 Support

For questions or issues:
1. Check this documentation first
2. Review API response error messages
3. Check activity logs for detailed operation history
4. Contact development team

---

## 🔄 Version History

- **v1.0** (Current) - Initial implementation with full CRUD support
  - Clone template for client
  - Add new assets
  - Replace existing assets
  - Auto task generation
  - Task archival for replacements

---

## 🏁 Summary

This system provides a **complete solution** for customizing client templates without affecting other clients:

✅ **Zero Schema Changes** - Uses existing models  
✅ **Fully Transactional** - All-or-nothing operations  
✅ **Client Isolation** - Each client gets their own custom template  
✅ **Task Automation** - Auto-generates tasks for new/replaced assets  
✅ **Audit Trail** - Activity logs for all operations  
✅ **Scalable** - Can handle any number of customizations  

**Recommended Endpoint:** `/api/assignments/{id}/customize-template` (one-step solution)
