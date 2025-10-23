# Custom Template System - Usage Examples

## 🎯 Quick Start Guide

### Scenario: Client wants to add new social media assets mid-package

**Given:**
- Client "ABC Company" has Assignment ID: `assignment_abc123`
- Currently using default "Premium Package Template"
- Package is 2 months into a 6-month duration
- Client wants to add Instagram and TikTok accounts

**Solution (ONE API CALL):**

```bash
POST /api/assignments/assignment_abc123/customize-template
Content-Type: application/json

{
  "customTemplateName": "ABC Company Custom - December 2024",
  "newAssets": [
    {
      "type": "social_site",
      "name": "Instagram Business Account",
      "url": "https://instagram.com/abccompany",
      "description": "Main business Instagram profile",
      "isRequired": true,
      "defaultPostingFrequency": 15,
      "defaultIdealDurationMinutes": 30
    },
    {
      "type": "social_site",
      "name": "TikTok Account",
      "url": "https://tiktok.com/@abccompany",
      "description": "Brand awareness on TikTok",
      "isRequired": true,
      "defaultPostingFrequency": 20,
      "defaultIdealDurationMinutes": 25
    }
  ]
}
```

**What happens:**
1. ✅ System clones the "Premium Package Template" → "ABC Company Custom - December 2024"
2. ✅ Adds Instagram and TikTok assets to custom template
3. ✅ Creates 2 new tasks: "Instagram Business Account Task" and "TikTok Account Task"
4. ✅ Updates assignment to use custom template
5. ✅ All existing tasks remain unchanged
6. ✅ Other clients using "Premium Package Template" are unaffected

---

## 📋 Common Use Cases

### Use Case 1: Add Multiple New Assets

**Scenario:** Client wants to add 5 new backlink sites

```javascript
// JavaScript/TypeScript Example
const addBacklinks = async (assignmentId) => {
  const response = await fetch(`/api/assignments/${assignmentId}/customize-template`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      newAssets: [
        {
          type: 'backlinks',
          name: 'Guest Post on TechBlog.com',
          url: 'https://techblog.com',
          isRequired: true,
          defaultPostingFrequency: 1,
          defaultIdealDurationMinutes: 120
        },
        {
          type: 'backlinks',
          name: 'Directory Listing - YellowPages',
          url: 'https://yellowpages.com',
          isRequired: false,
          defaultPostingFrequency: 1,
          defaultIdealDurationMinutes: 30
        },
        {
          type: 'backlinks',
          name: 'Forum Comment - Reddit',
          url: 'https://reddit.com/r/business',
          isRequired: false,
          defaultPostingFrequency: 5,
          defaultIdealDurationMinutes: 20
        },
        {
          type: 'backlinks',
          name: 'Social Bookmark - Pinterest',
          url: 'https://pinterest.com',
          isRequired: false,
          defaultPostingFrequency: 10,
          defaultIdealDurationMinutes: 15
        },
        {
          type: 'backlinks',
          name: 'Press Release Distribution',
          isRequired: true,
          defaultPostingFrequency: 2,
          defaultIdealDurationMinutes: 90
        }
      ]
    })
  });

  const data = await response.json();
  console.log('✅ Added 5 backlink assets, created 5 new tasks');
  return data.assignment;
};
```

---

### Use Case 2: Replace Old Social Media Account

**Scenario:** Client changed their Twitter handle, need to update

```bash
# Step 1: Find the old asset ID
GET /api/assignments/assignment_xyz789

# Response shows template.sitesAssets contains:
# { id: 42, name: "Twitter @OldHandle", type: "social_site", ... }

# Step 2: Replace with new account
POST /api/assignments/assignment_xyz789/customize-template

{
  "replacements": [
    {
      "oldAssetId": 42,
      "newAssetName": "Twitter @NewOfficialHandle",
      "newAssetType": "social_site",
      "newAssetUrl": "https://twitter.com/NewOfficialHandle",
      "newAssetDescription": "Updated official Twitter account",
      "isRequired": true,
      "defaultPostingFrequency": 10,
      "defaultIdealDurationMinutes": 20
    }
  ]
}
```

**Result:**
- Old Twitter tasks → Status changed to "cancelled"
- New task created for new Twitter account
- Settings updated automatically

---

### Use Case 3: Add New + Replace Existing (Complex)

**Scenario:** Client wants to:
- Add YouTube channel
- Add LinkedIn Company Page
- Replace old website URL
- Replace Facebook page

```json
POST /api/assignments/assignment_123/customize-template

{
  "customTemplateName": "Client Premium Plus - Custom Package",
  "newAssets": [
    {
      "type": "youtube_video_optimization",
      "name": "YouTube Channel - Product Reviews",
      "url": "https://youtube.com/@clientreviews",
      "description": "Video content strategy",
      "isRequired": true,
      "defaultPostingFrequency": 4,
      "defaultIdealDurationMinutes": 180
    },
    {
      "type": "social_site",
      "name": "LinkedIn Company Page",
      "url": "https://linkedin.com/company/client-corp",
      "description": "B2B networking and content",
      "isRequired": true,
      "defaultPostingFrequency": 8,
      "defaultIdealDurationMinutes": 45
    }
  ],
  "replacements": [
    {
      "oldAssetId": 15,
      "newAssetName": "New Company Website - clientcorp.com",
      "newAssetType": "web2_site",
      "newAssetUrl": "https://clientcorp.com",
      "newAssetDescription": "Migrated to new domain",
      "isRequired": true,
      "defaultPostingFrequency": 10
    },
    {
      "oldAssetId": 18,
      "newAssetName": "Facebook Business Page - Official",
      "newAssetType": "social_site",
      "newAssetUrl": "https://facebook.com/clientcorp.official",
      "newAssetDescription": "Verified business page",
      "isRequired": true,
      "defaultPostingFrequency": 12
    }
  ]
}
```

**Result:**
- ✅ 2 new tasks created (YouTube, LinkedIn)
- ✅ 2 replacement tasks created (Website, Facebook)
- ✅ 2 old tasks archived (old Website, old Facebook)
- ✅ Custom template has all assets from original + 2 new ones

---

### Use Case 4: Client Needs Graphics Design Service Added

**Scenario:** Client didn't have graphics in original package, wants to add it

```bash
POST /api/assignments/assignment_456/customize-template

{
  "newAssets": [
    {
      "type": "graphics_design",
      "name": "Social Media Graphics Pack",
      "description": "Monthly graphics for all social platforms",
      "isRequired": true,
      "defaultPostingFrequency": 20,
      "defaultIdealDurationMinutes": 120
    },
    {
      "type": "graphics_design",
      "name": "Blog Featured Images",
      "description": "Custom images for blog posts",
      "isRequired": true,
      "defaultPostingFrequency": 10,
      "defaultIdealDurationMinutes": 60
    },
    {
      "type": "image_optimization",
      "name": "Website Image Optimization",
      "description": "Compress and optimize all site images",
      "isRequired": true,
      "defaultPostingFrequency": 1,
      "defaultIdealDurationMinutes": 90
    }
  ]
}
```

---

### Use Case 5: Add Guest Posting Campaign

**Scenario:** Client wants to add a guest posting service mid-contract

```bash
POST /api/assignments/assignment_789/customize-template

{
  "customTemplateName": "Client Package + Guest Posting",
  "newAssets": [
    {
      "type": "guest_posting",
      "name": "High Authority Guest Posts",
      "description": "5 guest posts per month on DA 50+ sites",
      "isRequired": true,
      "defaultPostingFrequency": 5,
      "defaultIdealDurationMinutes": 240
    },
    {
      "type": "content_writing",
      "name": "Guest Post Content Creation",
      "description": "800-1000 word articles for guest posting",
      "isRequired": true,
      "defaultPostingFrequency": 5,
      "defaultIdealDurationMinutes": 150
    }
  ]
}
```

---

## 🔧 Advanced Scenarios

### Scenario A: Bulk Client Customization

**Need:** Add Instagram to all clients in "Premium Package"

```javascript
// Server-side script or admin tool
const addInstagramToAllPremiumClients = async () => {
  // 1. Get all assignments using Premium Package template
  const response = await fetch('/api/assignments?status=active');
  const assignments = await response.json();
  
  const premiumAssignments = assignments.filter(
    a => a.template?.name === 'Premium Package Template'
  );

  // 2. Customize each assignment
  for (const assignment of premiumAssignments) {
    try {
      await fetch(`/api/assignments/${assignment.id}/customize-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customTemplateName: `${assignment.client.name} - Premium + Instagram`,
          newAssets: [
            {
              type: 'social_site',
              name: 'Instagram Business Profile',
              isRequired: true,
              defaultPostingFrequency: 15,
              defaultIdealDurationMinutes: 30
            }
          ]
        })
      });
      console.log(`✅ Updated ${assignment.client.name}`);
    } catch (error) {
      console.error(`❌ Failed for ${assignment.client.name}:`, error);
    }
  }
};
```

---

### Scenario B: Seasonal Asset Addition

**Need:** Add holiday campaign assets for Q4

```javascript
const addHolidayCampaign = async (assignmentId, clientName) => {
  await fetch(`/api/assignments/${assignmentId}/customize-template`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customTemplateName: `${clientName} - Holiday Campaign 2024`,
      newAssets: [
        {
          type: 'social_site',
          name: 'Holiday Campaign - Facebook',
          description: 'Black Friday / Cyber Monday promotions',
          isRequired: true,
          defaultPostingFrequency: 30,
          defaultIdealDurationMinutes: 20
        },
        {
          type: 'graphics_design',
          name: 'Holiday Graphics Bundle',
          description: 'Seasonal banners and social graphics',
          isRequired: true,
          defaultPostingFrequency: 15,
          defaultIdealDurationMinutes: 180
        },
        {
          type: 'content_writing',
          name: 'Holiday Blog Content',
          description: 'Gift guides and seasonal articles',
          isRequired: true,
          defaultPostingFrequency: 8,
          defaultIdealDurationMinutes: 120
        }
      ]
    })
  });
};
```

---

### Scenario C: Asset Migration (Replace Multiple)

**Need:** Client rebranded, all social media changed

```json
POST /api/assignments/assignment_rebrand/customize-template

{
  "customTemplateName": "Client Rebrand - New Assets",
  "replacements": [
    {
      "oldAssetId": 10,
      "newAssetName": "Facebook - NewBrandName Official",
      "newAssetUrl": "https://facebook.com/newbrandname"
    },
    {
      "oldAssetId": 11,
      "newAssetName": "Twitter - @NewBrandName",
      "newAssetUrl": "https://twitter.com/NewBrandName"
    },
    {
      "oldAssetId": 12,
      "newAssetName": "Instagram - @NewBrandName",
      "newAssetUrl": "https://instagram.com/newbrandname"
    },
    {
      "oldAssetId": 13,
      "newAssetName": "LinkedIn - NewBrandName Inc",
      "newAssetUrl": "https://linkedin.com/company/newbrandname"
    }
  ]
}
```

**Result:** All 4 social accounts replaced, old tasks archived, new tasks created

---

## 🧪 Testing Checklist

### Before Customization
- [ ] Get assignment details: `GET /api/assignments/{id}`
- [ ] Note current template ID
- [ ] Count current tasks: `assignment.tasks.length`
- [ ] Count current assets: `assignment.template.sitesAssets.length`
- [ ] Note specific asset IDs if planning replacements

### After Customization
- [ ] Verify new template ID is different
- [ ] Verify template name matches custom name
- [ ] Verify asset count increased by number of new assets
- [ ] Verify new tasks created for new assets
- [ ] Verify old tasks archived (if replacements)
- [ ] Verify new tasks created for replacements
- [ ] Check other clients' assignments remain unchanged

### Verification Query
```bash
# Before
GET /api/assignments/assignment_123

# Save response, note:
# - templateId: "template_original"
# - tasks: [10 tasks]
# - template.sitesAssets: [8 assets]

# Customize (add 2 assets)
POST /api/assignments/assignment_123/customize-template
{
  "newAssets": [{ /* asset 1 */ }, { /* asset 2 */ }]
}

# After
GET /api/assignments/assignment_123

# Verify:
# - templateId: "template_custom_xyz" (different!)
# - tasks: [12 tasks] (10 old + 2 new)
# - template.sitesAssets: [10 assets] (8 old + 2 new)
```

---

## 📊 Response Format Reference

### Successful Response
```json
{
  "message": "Custom template created and assignment updated successfully",
  "assignment": {
    "id": "assignment_123",
    "templateId": "template_custom_456",
    "clientId": "client_abc",
    "status": "active",
    "assignedAt": "2024-01-01T00:00:00.000Z",
    "client": {
      "id": "client_abc",
      "name": "ABC Company",
      "email": "contact@abccompany.com"
    },
    "template": {
      "id": "template_custom_456",
      "name": "ABC Company Custom - December 2024",
      "description": "Custom template for client: ABC Company. Modified from: Premium Package Template",
      "sitesAssets": [
        {
          "id": 100,
          "name": "Facebook Page",
          "type": "social_site",
          "isRequired": true,
          "defaultPostingFrequency": 10
        },
        // ... existing assets ...
        {
          "id": 110,
          "name": "Instagram Business Account",
          "type": "social_site",
          "isRequired": true,
          "defaultPostingFrequency": 15
        }
      ],
      "templateTeamMembers": [...]
    },
    "tasks": [
      {
        "id": "task_new_1",
        "name": "Instagram Business Account Task",
        "status": "pending",
        "priority": "medium",
        "templateSiteAssetId": 110,
        "notes": "[NEW ASSET] Added to custom template"
      },
      // ... other tasks ...
    ],
    "siteAssetSettings": [...]
  }
}
```

### Error Responses

**Assignment Not Found (404)**
```json
{
  "message": "Assignment not found"
}
```

**No Template Attached (400)**
```json
{
  "message": "Assignment has no template attached"
}
```

**Invalid Asset Type (400)**
```json
{
  "message": "Failed to customize template",
  "error": "Invalid enum value. Expected 'social_site' | 'web2_site' | ..."
}
```

---

## 💡 Tips & Best Practices

### Naming Conventions
✅ **Good:** "ABC Company Custom - Dec 2024"  
✅ **Good:** "Client Premium + Social Media Boost"  
✅ **Good:** "Holiday Campaign Package - Q4 2024"  
❌ **Bad:** "Custom Template"  
❌ **Bad:** "Template Copy"  

### When to Use This System
✅ Client wants additional services mid-contract  
✅ Client's social media accounts changed  
✅ Client needs seasonal/temporary assets  
✅ Client upgraded package but contract already started  
✅ Client wants to test new channels  

### When NOT to Use
❌ Client wants to cancel/reduce services (use task cancellation instead)  
❌ Client starting fresh contract (create new assignment)  
❌ Need to modify ALL clients (update default template instead)  
❌ Testing purposes (use dev/staging environment)  

---

## 🔍 Debugging

### Check Activity Logs
```sql
-- View all customization activities
SELECT * FROM "ActivityLog" 
WHERE action IN ('customize_template', 'clone_for_client', 'sync_template')
ORDER BY timestamp DESC;

-- View specific client's customizations
SELECT * FROM "ActivityLog" 
WHERE action = 'customize_template' 
  AND details->>'clientId' = 'client_123'
ORDER BY timestamp DESC;
```

### Find Custom Templates
```sql
-- Find all custom templates
SELECT * FROM "Template"
WHERE description LIKE '%Custom template for client:%'
ORDER BY id DESC;

-- Find templates not used by any assignment
SELECT t.* FROM "Template" t
LEFT JOIN "Assignment" a ON a."templateId" = t.id
WHERE a.id IS NULL
  AND t.description LIKE '%Custom%';
```

### Check Task Generation
```sql
-- Find tasks created for specific asset
SELECT t.*, tsa.name as asset_name
FROM "Task" t
JOIN "TemplateSiteAsset" tsa ON t."templateSiteAssetId" = tsa.id
WHERE t."assignmentId" = 'assignment_123'
  AND t.notes LIKE '%[NEW ASSET]%'
ORDER BY t."createdAt" DESC;
```

---

## 🎬 Complete End-to-End Example

```typescript
/**
 * Complete workflow: Client wants to expand their package
 */
async function expandClientPackage() {
  const assignmentId = 'assignment_abc123';
  
  // Step 1: Get current state
  console.log('📋 Fetching current assignment...');
  const currentAssignment = await fetch(`/api/assignments/${assignmentId}`)
    .then(r => r.json());
  
  console.log('Current template:', currentAssignment.template.name);
  console.log('Current assets:', currentAssignment.template.sitesAssets.length);
  console.log('Current tasks:', currentAssignment.tasks.length);
  
  // Step 2: Identify what to add/replace
  const assetsToAdd = [
    {
      type: 'social_site',
      name: 'Instagram Business',
      url: 'https://instagram.com/client',
      isRequired: true,
      defaultPostingFrequency: 15,
      defaultIdealDurationMinutes: 30
    },
    {
      type: 'youtube_video_optimization',
      name: 'YouTube Channel',
      url: 'https://youtube.com/@client',
      isRequired: true,
      defaultPostingFrequency: 4,
      defaultIdealDurationMinutes: 180
    }
  ];
  
  // Find old Facebook asset to replace
  const oldFacebookAsset = currentAssignment.template.sitesAssets.find(
    a => a.name.includes('Facebook') && a.type === 'social_site'
  );
  
  const replacements = oldFacebookAsset ? [
    {
      oldAssetId: oldFacebookAsset.id,
      newAssetName: 'Facebook Business Page - Verified',
      newAssetUrl: 'https://facebook.com/client.official',
      newAssetDescription: 'New verified business page',
      isRequired: true,
      defaultPostingFrequency: 12
    }
  ] : [];
  
  // Step 3: Execute customization
  console.log('🚀 Customizing template...');
  const result = await fetch(`/api/assignments/${assignmentId}/customize-template`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-actor-id': 'user_manager_123'
    },
    body: JSON.stringify({
      customTemplateName: `${currentAssignment.client.name} - Expanded Package`,
      newAssets: assetsToAdd,
      replacements
    })
  }).then(r => r.json());
  
  // Step 4: Verify results
  console.log('✅ Success!');
  console.log('New template:', result.assignment.template.name);
  console.log('New assets:', result.assignment.template.sitesAssets.length);
  console.log('New tasks:', result.assignment.tasks.length);
  
  // Step 5: Show what changed
  const newTasks = result.assignment.tasks.filter(
    t => t.notes?.includes('[NEW ASSET]') || t.notes?.includes('[REPLACEMENT]')
  );
  console.log(`\n📝 Created ${newTasks.length} new tasks:`);
  newTasks.forEach(t => {
    console.log(`  - ${t.name} (${t.status})`);
  });
  
  const archivedTasks = result.assignment.tasks.filter(
    t => t.status === 'cancelled' && t.notes?.includes('[AUTO-ARCHIVED]')
  );
  console.log(`\n📦 Archived ${archivedTasks.length} old tasks:`);
  archivedTasks.forEach(t => {
    console.log(`  - ${t.name}`);
  });
  
  return result.assignment;
}

// Run it!
expandClientPackage()
  .then(() => console.log('\n🎉 Package expansion complete!'))
  .catch(err => console.error('❌ Error:', err));
```

---

## 📚 Related Documentation

- [CUSTOM_TEMPLATE_SYSTEM.md](./CUSTOM_TEMPLATE_SYSTEM.md) - Complete system documentation
- Prisma Schema - See `Assignment`, `Template`, `TemplateSiteAsset` models
- Task Generation Logic - See `/api/assignments/route.ts`

---

**Last Updated:** December 2024  
**Version:** 1.0
