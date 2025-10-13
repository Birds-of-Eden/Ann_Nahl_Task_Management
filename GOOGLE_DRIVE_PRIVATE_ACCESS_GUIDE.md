# Google Drive Private Folder Access সম্পূর্ণ গাইড (বাংলায়)

## ১. সমস্যা কী ছিল?

### পূর্ববর্তী সমস্যা:
- ✅ **Public Google Drive folders** → কাজ করছিল
- ❌ **Private/Shared Google Drive folders** → কাজ করছিল না

### কারণ:
আপনার system **Google Drive API Key** use করছিল, যা শুধু public folders access করতে পারে। Private folders access করতে হলে **user-specific OAuth 2.0 Access Token** লাগে।

---

## ২. সমাধান কী করা হয়েছে?

### Implementation করা হয়েছে:

**A. NextAuth Google Provider এ Scopes যুক্ত করা হয়েছে:**
```typescript
// lib/auth.ts এ
Google({
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  authorization: {
    params: {
      // Google Drive read-only access scope যুক্ত করা হয়েছে
      scope: "openid email profile https://www.googleapis.com/auth/drive.readonly",
      access_type: "offline",
      prompt: "consent",
    },
  },
})
```

**B. JWT Callback এ Access Token Store করা হয়েছে:**
- User যখন Google দিয়ে login করবে, তখন Google Drive access token store হবে
- Token JWT এ safely store থাকবে

**C. Session এ Access Token Pass করা হয়েছে:**
- Frontend থেকে session.user.googleAccessToken পাওয়া যাবে
- এই token দিয়ে private folders access করা যাবে

**D. Image Gallery Component Update করা হয়েছে:**
- localStorage mock token এর বদলে NextAuth session থেকে token নেওয়া হচ্ছে
- useSession() hook use করা হয়েছে

---

## ৩. এখন কীভাবে কাজ করবে?

### Flow:

```
1. User Google দিয়ে Login করবে
   ↓
2. Google Drive permission চাইবে (consent screen দেখাবে)
   ↓
3. User permission দিলে Access Token পাওয়া যাবে
   ↓
4. Access Token session এ store হবে
   ↓
5. Image Gallery এ Drive Link দিলে:
   - Token সহ API call হবে
   - Private folders access হবে
   - Images দেখাবে ✅
```

---

## ৪. Setup পদক্ষেপ (আপনাকে করতে হবে)

### Step A: Google Cloud Console Setup

1. **Google Cloud Console এ যান:**
   - https://console.cloud.google.com/

2. **আপনার Project Select করুন**

3. **Google Drive API Enable করুন:**
   - "APIs & Services" > "Library"
   - "Google Drive API" search করুন
   - "Enable" button click করুন

4. **OAuth Consent Screen Configure করুন:**
   - "APIs & Services" > "OAuth consent screen"
   - User Type: External (অথবা Internal if G Suite)
   - App Name দিন
   - Support email দিন
   - Scopes add করুন:
     - `.../auth/userinfo.email`
     - `.../auth/userinfo.profile`
     - `.../auth/drive.readonly` ✅ **এটা গুরুত্বপূর্ণ!**

5. **Credentials Check করুন:**
   - "APIs & Services" > "Credentials"
   - আপনার OAuth 2.0 Client ID select করুন
   - "Authorized redirect URIs" verify করুন:
     ```
     http://localhost:3000/api/auth/callback/google
     https://your-production-domain.com/api/auth/callback/google
     ```

6. **Publishing Status:**
   - Development mode তে test করার জন্য test users add করুন
   - Production এ যাওয়ার জন্য "Publish App" করতে হবে

---

### Step B: Environment Variables Check

আপনার `.env` file এ নিচের variables থাকতে হবে:

```env
# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-here

# Google OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret

# Google Drive API Key (backup for public folders)
GOOGLE_DRIVE_API_KEY=your-api-key
```

---

## ৫. Testing কীভাবে করবেন

### Test করার পদক্ষেপ:

1. **Application চালান:**
   ```bash
   npm run dev
   ```

2. **Google দিয়ে Login করুন:**
   - Browser এ sign out করুন (যদি already logged in থাকেন)
   - Fresh login করুন Google account দিয়ে
   - Google permission consent screen দেখাবে
   - "Allow" click করে Drive access দিন

3. **Client Onboarding Page এ যান**

4. **Image Gallery তে Test করুন:**
   
   **Test Case 1 - Public Folder:**
   ```
   Link: https://drive.google.com/drive/folders/YOUR_PUBLIC_FOLDER_ID
   ✅ আগের মতোই কাজ করবে
   ```

   **Test Case 2 - Private Folder (শুধুমাত্র আপনার account এর):**
   ```
   Link: https://drive.google.com/drive/folders/YOUR_PRIVATE_FOLDER_ID
   ✅ এখন কাজ করবে! (আগে করতো না)
   ```

   **Test Case 3 - Shared Private Folder (অন্য কেউ share করেছে):**
   ```
   Link: https://drive.google.com/drive/folders/SHARED_FOLDER_ID
   ⚠️ শুধুমাত্র তখনই কাজ করবে যখন:
      - Drive owner ও Google দিয়ে login করেছে
      - অথবা যার সাথে shared করা হয়েছে সেই account দিয়ে login করেছে
   ```

---

## ৬. কীভাবে বুঝবেন যে কাজ করছে?

### Success Indicators:

**A. Login করার সময়:**
- Google consent screen দেখাবে যেখানে লেখা থাকবে:
  ```
  "This app wants to:
  - See, edit, create, and delete all of your Google Drive files"
  ```
  (অথবা similar message)

**B. Image Gallery তে:**
- Private folder link validate করলে images দেখাবে
- Error দেখাবে না যে "Folder is not public"

**C. Browser Console এ:**
- Network tab দেখুন
- `/api/drive?folderId=...&accessToken=...` এরকম request যাবে
- accessToken parameter থাকবে (খুবই long string)

---

## ৭. Troubleshooting (সমস্যা হলে)

### সমস্যা A: "Folder is not public" Error আসছে

**সমাধান:**
1. Re-login করুন (sign out → sign in)
2. Google consent screen এ সব permissions দিন
3. Browser console এ check করুন:
   ```javascript
   // Console এ paste করুন:
   fetch('/api/auth/session').then(r => r.json()).then(console.log)
   ```
   - `user.googleAccessToken` আছে কিনা দেখুন

### সমস্যা B: Consent Screen দেখাচ্ছে না

**সমাধান:**
1. Google Cloud Console এ OAuth consent screen configure করুন
2. `.../auth/drive.readonly` scope add করুন
3. Application এ `prompt: "consent"` থাকতে হবে (already আছে)

### সমস্যা C: "Access Denied" Error

**সমাধান:**
1. Google Cloud Console এ check করুন:
   - Google Drive API enable আছে কিনা
   - OAuth consent screen published কিনা
2. Test user হিসেবে আপনার email add করুন (development mode এ)

### সমস্যা D: Token Expire হয়ে যায়

**বর্তমান অবস্থা:**
- Access token প্রায় 1 ঘন্টা valid থাকে
- Expire হলে re-login করতে হবে

**ভবিষ্যৎ Enhancement (যদি প্রয়োজন হয়):**
- Refresh token logic implement করা যাবে
- Automatic token refresh করা যাবে

---

## ৮. Security Best Practices

### করণীয়:

1. ✅ **Access Token কখনো client-side log করবেন না**
2. ✅ **Environment variables safely store করুন**
3. ✅ **HTTPS use করুন production এ**
4. ✅ **Minimum required scopes ই use করুন** (drive.readonly, না drive.full)

### এড়িয়ে চলুন:

1. ❌ Access token publicly expose করবেন না
2. ❌ Token কখনো GitHub এ commit করবেন না
3. ❌ Unnecessary permissions চাইবেন না

---

## ৯. Production Deployment

### Production এ deploy করার আগে:

1. **Google Cloud Console এ:**
   - OAuth app "Publish" করুন
   - Production domain redirect URI add করুন

2. **Environment Variables:**
   ```env
   NEXTAUTH_URL=https://your-domain.com
   NEXTAUTH_SECRET=strong-random-secret
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   ```

3. **Testing:**
   - Production এ deploy করার পর test করুন
   - Different users দিয়ে test করুন

---

## ১০. Key Points সংক্ষেপে

### এখন যা সম্ভব:

✅ **Public Google Drive folders** → কাজ করবে  
✅ **Private folders (নিজের account এর)** → কাজ করবে  
✅ **Shared folders (access থাকলে)** → কাজ করবে  

### যা করতে হবে না:

❌ Folder manually public করার দরকার নেই  
❌ Link sharing setting change করার দরকার নেই  
❌ যেকোনো folder link দিলেই কাজ করবে (যদি access থাকে)  

### System কীভাবে কাজ করে:

```
User → Google Login → Drive Permission → Access Token → API Call → Images ✅
```

---

## ১১. Contact & Support

যদি কোনো সমস্যা হয়:

1. Browser console check করুন
2. Network tab এ API calls দেখুন
3. Server logs check করুন
4. Google Cloud Console এ API quotas দেখুন

---

**Implementation Complete! 🎉**

এখন আপনার system private Google Drive folders access করতে পারবে!
