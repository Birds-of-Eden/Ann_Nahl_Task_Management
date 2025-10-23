# API Endpoints Summary - Custom Template System

## 📍 Core Endpoints

### 1. ⭐ Customize Template (RECOMMENDED)
**One-step solution for most use cases**

```
POST /api/assignments/{assignmentId}/customize-template
```

**Features:**
- Clones template automatically
- Adds new assets
- Replaces existing assets
- Creates tasks for new/replaced assets
- Archives old tasks for replacements
- Updates assignment

**Use when:**
- Client wants to add new assets mid-package
- Client needs to replace existing assets
- You want everything done in one call

---

### 2. Clone Template for Client
```
POST /api/templates/{templateId}/clone-for-client
```

**Body:**
```json
{
  "clientId": "client_123",
  "customName": "Optional custom name"
}
```

**Use when:**
- You want to manually clone template first
- Need to modify template before updating assignment

---

### 3. Add Assets to Template
```
POST /api/templates/{templateId}/add-assets
```

**Body:**
```json
{
  "assets": [
    {
      "type": "social_site",
      "name": "Instagram",
      "isRequired": true,
      "defaultPostingFrequency": 10
    }
  ]
}
```

**Use when:**
- Adding assets to an already-created custom template

---

### 4. Sync Assignment with Template
```
POST /api/assignments/{assignmentId}/sync-template
```

**Body:**
```json
{
  "newTemplateId": "template_custom_456",
  "replacements": [
    { "oldAssetId": 10, "newAssetId": 20 }
  ],
  "autoArchiveOld": true
}
```

**Use when:**
- Switching assignment to use a different template
- Already have custom template created

---

### 5. Regenerate Tasks
```
POST /api/assignments/{assignmentId}/regenerate-tasks
```

**Body:**
```json
{
  "onlyMissing": true,
  "forceRecreate": false
}
```

**Use when:**
- Assets were added directly to template via database
- Need to create tasks for assets without tasks

---

## 🎯 Common Scenarios

### Add New Assets Only
```bash
POST /api/assignments/assignment_123/customize-template

{
  "newAssets": [
    {
      "type": "social_site",
      "name": "Instagram",
      "isRequired": true,
      "defaultPostingFrequency": 10
    }
  ]
}
```

### Replace Existing Asset
```bash
POST /api/assignments/assignment_123/customize-template

{
  "replacements": [
    {
      "oldAssetId": 42,
      "newAssetName": "New Twitter Account",
      "newAssetUrl": "https://twitter.com/newhandle"
    }
  ]
}
```

### Add + Replace (Complex)
```bash
POST /api/assignments/assignment_123/customize-template

{
  "customTemplateName": "Client Custom Package",
  "newAssets": [
    { "type": "social_site", "name": "Instagram", "isRequired": true }
  ],
  "replacements": [
    { "oldAssetId": 15, "newAssetName": "New Website URL" }
  ]
}
```

---

## 📊 SiteAssetType Values

```typescript
type SiteAssetType = 
  | "social_site"
  | "web2_site"
  | "other_asset"
  | "graphics_design"
  | "image_optimization"
  | "content_studio"
  | "content_writing"
  | "backlinks"
  | "completed_com"
  | "youtube_video_optimization"
  | "monitoring"
  | "review_removal"
  | "summary_report"
  | "guest_posting"
```

---

## 🔄 Workflow Comparison

### Option A: One-Step (RECOMMENDED)
```
1. POST /api/assignments/{id}/customize-template
   ↓
Done! ✅
```

### Option B: Manual Multi-Step
```
1. POST /api/templates/{id}/clone-for-client
   ↓
2. POST /api/templates/{newId}/add-assets
   ↓
3. POST /api/assignments/{id}/sync-template
   ↓
Done! ✅
```

---

## ✅ Response Checklist

After calling customize-template, verify:
- `assignment.templateId` changed (new custom template)
- `assignment.template.name` has custom name
- `assignment.template.sitesAssets` includes new assets
- `assignment.tasks` includes new tasks with notes "[NEW ASSET]" or "[REPLACEMENT]"
- Old tasks for replaced assets have `status: "cancelled"`

---

## 🔍 Finding Asset IDs for Replacement

```bash
# Step 1: Get assignment details
GET /api/assignments/assignment_123

# Step 2: Look in response
{
  "template": {
    "sitesAssets": [
      {
        "id": 42,  // ← This is the oldAssetId
        "name": "Twitter @OldHandle",
        "type": "social_site"
      }
    ]
  }
}

# Step 3: Use that ID in replacement
POST /api/assignments/assignment_123/customize-template
{
  "replacements": [
    { "oldAssetId": 42, "newAssetName": "Twitter @NewHandle" }
  ]
}
```

---

## 🚨 Common Errors

### "Assignment not found"
- Check assignmentId is correct
- Verify assignment exists: `GET /api/assignments/{id}`

### "Assignment has no template attached"
- Assignment must have a template first
- Create assignment with template or update it

### "Invalid enum value"
- Check `type` field uses valid SiteAssetType
- See SiteAssetType values above

### "Template not found"
- Check templateId is correct
- Verify template exists: `GET /api/templates/{id}`

---

## 💡 Pro Tips

1. **Always use customize-template** unless you have specific reasons not to
2. **Include client name** in custom template name for easy identification
3. **Set autoArchiveOld: true** when replacing assets (default behavior)
4. **Add notes/description** to new assets for context
5. **Test on staging** before production for complex changes

---

## 📱 Frontend Integration Snippet

```typescript
// React/Next.js example
const customizeTemplate = async (
  assignmentId: string,
  newAssets: any[],
  replacements: any[]
) => {
  const response = await fetch(
    `/api/assignments/${assignmentId}/customize-template`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        newAssets,
        replacements,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  return response.json();
};

// Usage
try {
  const result = await customizeTemplate('assignment_123', [
    {
      type: 'social_site',
      name: 'Instagram',
      isRequired: true,
      defaultPostingFrequency: 10,
    },
  ], []);
  
  console.log('✅ Success:', result.assignment);
} catch (error) {
  console.error('❌ Error:', error.message);
}
```

---

## 🎓 Learn More

- **Full Documentation:** [CUSTOM_TEMPLATE_SYSTEM.md](./CUSTOM_TEMPLATE_SYSTEM.md)
- **Usage Examples:** [USAGE_EXAMPLES.md](./USAGE_EXAMPLES.md)
- **Prisma Schema:** `/prisma/schema.prisma`

---

**Last Updated:** December 2024  
**Version:** 1.0
