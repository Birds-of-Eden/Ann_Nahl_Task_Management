# Google Drive Private Access Testing Checklist (বাংলায়)

## 🚀 দ্রুত Setup চেকলিস্ট

### ✅ Google Cloud Console Setup
- [ ] Google Cloud Console এ লগইন করেছেন
- [ ] Google Drive API enable করেছেন
- [ ] OAuth consent screen configure করেছেন
- [ ] Scopes যুক্ত করেছেন:
  - [ ] `openid`
  - [ ] `email`
  - [ ] `profile`
  - [ ] `https://www.googleapis.com/auth/drive.readonly` ⭐ **গুরুত্বপূর্ণ!**
- [ ] Test users add করেছেন (development mode এর জন্য)
- [ ] Authorized redirect URIs verify করেছেন

### ✅ Environment Variables
- [ ] `.env` file এ সব variables আছে:
  ```env
  NEXTAUTH_URL=http://localhost:3000
  NEXTAUTH_SECRET=your-secret
  GOOGLE_CLIENT_ID=...
  GOOGLE_CLIENT_SECRET=...
  GOOGLE_DRIVE_API_KEY=...
  ```

### ✅ Code Changes
- [ ] `lib/auth.ts` update হয়েছে (Google provider এ scopes যুক্ত)
- [ ] JWT callback এ access token store করা হচ্ছে
- [ ] Session callback এ token pass হচ্ছে
- [ ] `components/onboarding/image-gallery.tsx` update হয়েছে
- [ ] `components/drive-image-gallery.tsx` update হয়েছে

---

## 🧪 Testing পদক্ষেপ

### Step 1: Application চালান
```bash
npm run dev
```
- [ ] Application successfully চালু হয়েছে
- [ ] Console এ কোনো error নেই

### Step 2: Sign Out করুন (যদি logged in থাকেন)
- [ ] Browser এ profile/settings থেকে sign out করেছেন
- [ ] Session clear হয়েছে

### Step 3: Fresh Google Login করুন
- [ ] Sign in page এ গিয়েছেন
- [ ] "Sign in with Google" button click করেছেন
- [ ] **Google Consent Screen দেখাচ্ছে?** ⚠️
  - যদি না দেখায়: Google account settings এ গিয়ে app permission revoke করুন, তারপর আবার try করুন
  - Consent screen এ "See, edit, create, and delete all of your Google Drive files" permission দেখাচ্ছে?
- [ ] "Allow" button click করেছেন
- [ ] Successfully logged in হয়েছে

### Step 4: Session Check করুন
Browser console এ paste করুন:
```javascript
fetch('/api/auth/session')
  .then(r => r.json())
  .then(s => {
    console.log('Session:', s);
    console.log('Has Google Token:', !!s?.user?.googleAccessToken);
    if (s?.user?.googleAccessToken) {
      console.log('✅ Token আছে! Length:', s.user.googleAccessToken.length);
    } else {
      console.log('❌ Token নেই! Re-login করুন।');
    }
  });
```
- [ ] Session data দেখা যাচ্ছে?
- [ ] `user.googleAccessToken` আছে?
- [ ] Token একটা long string (100+ characters)?

---

## 📁 Drive Folder Testing

### Test Case 1: Public Folder (সাধারণ test)
**Setup:**
1. আপনার Google Drive এ যান
2. একটা folder create করুন: "Test Public Images"
3. কিছু images upload করুন
4. Folder এ right-click → "Share" → "Anyone with the link" → "Viewer" → Copy link

**Test:**
- [ ] Client onboarding page এ যান
- [ ] Image Gallery section এ link paste করুন
- [ ] "Validate" button click করুন
- [ ] ✅ Images load হচ্ছে?
- [ ] ✅ Preview দেখা যাচ্ছে?
- [ ] ✅ Download/Copy কাজ করছে?

**Expected:** ✅ সব কাজ করবে (আগের মতোই)

---

### Test Case 2: Private Folder (নতুন feature!)
**Setup:**
1. Google Drive এ নতুন folder create করুন: "Test Private Images"
2. কিছু images upload করুন
3. Folder এ **NO SHARING করবেন না** (completely private রাখুন)
4. Folder এ click করে URL bar থেকে link copy করুন
   - Format: `https://drive.google.com/drive/folders/XXXXX`

**Test:**
- [ ] Client onboarding page এ যান
- [ ] Private folder link paste করুন
- [ ] "Validate" button click করুন

**Expected Results:**
- যদি Google দিয়ে login করা থাকে:
  - [ ] ✅ Images load হবে
  - [ ] ✅ Preview দেখাবে
  - [ ] ✅ "Folder is not public" error আসবে না
- যদি Google দিয়ে login না করা থাকে:
  - [ ] ❌ Error message দেখাবে

---

### Test Case 3: Shared Private Folder
**Setup:**
1. অন্য একটা Google account থেকে folder create করুন
2. Images upload করুন
3. আপনার main account কে share করুন (Viewer permission)
4. Link copy করুন

**Test:**
- [ ] আপনার main account দিয়ে login করুন
- [ ] Shared folder link paste করুন
- [ ] "Validate" button click করুন
- [ ] ✅ Images load হচ্ছে? (কারণ আপনার access আছে)

---

### Test Case 4: No Access Folder
**Setup:**
1. অন্য কারো private folder link নিন (যার access নেই)
2. অথবা একটা private folder link নিন যা share করা হয়নি

**Test:**
- [ ] Link paste করুন
- [ ] "Validate" button click করুন

**Expected:**
- [ ] ❌ Error message: "User is not authorized for this private folder"
- [ ] ⚠️ এটা normal behavior (কারণ access নেই)

---

## 🔍 Debug Checklist (সমস্যা হলে)

### Issue: Consent Screen দেখাচ্ছে না
**Debug Steps:**
1. [ ] Google Cloud Console → OAuth consent screen
2. [ ] "Test users" section এ আপনার email আছে?
3. [ ] Publishing status "Testing" অথবা "Published"?
4. [ ] Scopes properly configured?

**Fix:**
```bash
# Browser থেকে Google permission revoke করুন:
# https://myaccount.google.com/connections
# আপনার app খুঁজে "Remove Access" click করুন
# তারপর re-login করুন
```

---

### Issue: "Access Token missing" Warning
**Debug Steps:**
1. [ ] Browser console check করুন:
   ```javascript
   fetch('/api/auth/session').then(r=>r.json()).then(console.log)
   ```
2. [ ] `user.googleAccessToken` আছে?

**Fix:**
- Re-login করুন (sign out → sign in with Google)
- Consent screen এ সব permissions দিন

---

### Issue: "Folder is not public" Error (Private folder এ)
**Debug Steps:**
1. [ ] Network tab check করুন
2. [ ] `/api/drive?folderId=...` request এ `accessToken` parameter আছে?
3. [ ] Response status code কি? (403 = no access, 404 = not found)

**Fix:**
- যদি `accessToken` parameter না থাকে → Re-login করুন
- যদি 403 error → Drive folder এ সত্যিই access আছে কিনা check করুন

---

### Issue: Images Load হচ্ছে না
**Debug Steps:**
1. [ ] Browser console এ error আছে?
2. [ ] Network tab এ failed requests আছে?
3. [ ] API response দেখুন:
   ```javascript
   fetch('/api/drive?folderId=YOUR_FOLDER_ID&accessToken=YOUR_TOKEN')
     .then(r => r.json())
     .then(console.log);
   ```

**Fix:**
- Google Drive API quota exceed হয়েছে কিনা check করুন
- Server logs check করুন

---

## ✅ Success Indicators

### যদি সব ঠিকঠাক কাজ করে:

1. **Login করার সময়:**
   - ✅ Google consent screen দেখাচ্ছে
   - ✅ Drive permission চাইছে
   - ✅ Successfully logged in হচ্ছে

2. **Session Check:**
   - ✅ `session.user.googleAccessToken` আছে
   - ✅ Token একটা long string

3. **Public Folders:**
   - ✅ Load হচ্ছে
   - ✅ Preview কাজ করছে

4. **Private Folders (যার access আছে):**
   - ✅ Load হচ্ছে
   - ✅ "Folder is not public" error আসছে না
   - ✅ Images perfectly দেখাচ্ছে

5. **Browser Network Tab:**
   - ✅ `/api/drive?folderId=...&accessToken=...` requests যাচ্ছে
   - ✅ Status code 200
   - ✅ Images returning হচ্ছে

---

## 🎯 Final Checklist

### আপনি জানবেন implementation সফল হয়েছে যখন:

- [x] Code changes complete হয়েছে
- [ ] Google Cloud Console properly setup হয়েছে
- [ ] Development mode এ test করা হয়েছে
- [ ] Public folders কাজ করছে
- [ ] **Private folders (নিজের) কাজ করছে** ⭐ **এটাই main goal!**
- [ ] Shared folders (access থাকলে) কাজ করছে
- [ ] No access folders properly error দিচ্ছে
- [ ] Browser console এ কোনো error নেই

---

## 📞 যদি সমস্যা থাকে

### Common Issues:

1. **"redirect_uri_mismatch" Error:**
   - Google Cloud Console এ redirect URI check করুন
   - Development: `http://localhost:3000/api/auth/callback/google`
   - Production: `https://your-domain.com/api/auth/callback/google`

2. **"Access blocked" Error:**
   - OAuth consent screen এ test user হিসেবে আপনার email add করুন

3. **Token expire হয়ে যায়:**
   - Access token প্রায় 1 ঘন্টা valid থাকে
   - Expire হলে re-login করুন

---

## 🎉 Testing Complete!

যদি উপরের সব test case pass করে, তাহলে congratulations! 🎊

আপনার system এখন:
- ✅ Public Drive folders support করে
- ✅ Private Drive folders support করে
- ✅ Shared folders support করে
- ✅ Proper error handling করে

**Implementation successful!** 🚀
