# Quick Reference Guide - Google Drive Private Access (বাংলা)

## 🎯 এক নজরে Implementation

### কী সমস্যা ছিল?
- **আগে:** শুধু public Google Drive folders কাজ করতো
- **এখন:** Private এবং shared folders ও কাজ করবে

### কীভাবে solve করা হয়েছে?
- NextAuth Google provider এ Drive scope যুক্ত করা হয়েছে
- User এর Google access token session এ store করা হচ্ছে
- API calls এ token include করা হচ্ছে

---

## ⚡ দ্রুত Setup (5 মিনিটে)

### Step 1: Google Cloud Console
1. https://console.cloud.google.com/ এ যান
2. "APIs & Services" → "Library"
3. "Google Drive API" enable করুন
4. "OAuth consent screen" → Scopes add করুন:
   - `https://www.googleapis.com/auth/drive.readonly`

### Step 2: Test করুন
1. Application চালান: `npm run dev`
2. Sign out করুন (যদি logged in থাকেন)
3. Google দিয়ে fresh login করুন
4. Private folder link দিয়ে test করুন

---

## 🔥 দ্রুত Troubleshooting

### সমস্যা: Consent Screen দেখাচ্ছে না
```bash
# Solution:
1. Browser থেকে app permission revoke করুন:
   https://myaccount.google.com/connections
2. Clear browser cache
3. Re-login করুন
```

### সমস্যা: Access Token নেই
```javascript
// Browser console এ check করুন:
fetch('/api/auth/session').then(r=>r.json()).then(console.log)
// দেখুন: user.googleAccessToken আছে কিনা

// Fix: Re-login করুন
```

### সমস্যা: Private Folder Load হচ্ছে না
```
✅ Check: Google দিয়ে login করেছেন?
✅ Check: Consent screen এ Drive permission দিয়েছেন?
✅ Check: Folder এ সত্যিই access আছে?

Fix: Sign out → Sign in with Google → Allow permissions
```

---

## 📋 Quick Testing Commands

### Session Check
```javascript
// Browser console এ paste করুন:
fetch('/api/auth/session')
  .then(r => r.json())
  .then(s => console.log('Has Token:', !!s?.user?.googleAccessToken));
```

### API Direct Test
```javascript
// Replace YOUR_FOLDER_ID এবং YOUR_TOKEN:
fetch('/api/drive?folderId=YOUR_FOLDER_ID&accessToken=YOUR_TOKEN')
  .then(r => r.json())
  .then(console.log);
```

### Check Environment Variables
```bash
# Terminal এ:
node -e "console.log('GOOGLE_CLIENT_ID:', !!process.env.GOOGLE_CLIENT_ID)"
node -e "console.log('GOOGLE_CLIENT_SECRET:', !!process.env.GOOGLE_CLIENT_SECRET)"
```

---

## 🎨 Testing Scenarios সংক্ষেপে

| Folder Type | Access | Expected Result |
|------------|--------|-----------------|
| Public | Anyone | ✅ Works |
| Private (নিজের) | Owner | ✅ Works (নতুন!) |
| Shared (access আছে) | Viewer/Editor | ✅ Works (নতুন!) |
| Private (access নেই) | None | ❌ Error (expected) |

---

## 🔧 Modified Files

| File | Change |
|------|--------|
| `lib/auth.ts` | ✅ Google provider scope, JWT/session callbacks |
| `components/onboarding/image-gallery.tsx` | ✅ useSession hook, token from session |
| `components/drive-image-gallery.tsx` | ✅ useSession hook, token from session |
| `app/api/drive/route.ts` | ✅ Already supports accessToken parameter |

---

## 📝 Important URLs

### Development
- App: `http://localhost:3000`
- Auth callback: `http://localhost:3000/api/auth/callback/google`
- Session check: `http://localhost:3000/api/auth/session`

### Google Console
- Cloud Console: https://console.cloud.google.com/
- Manage permissions: https://myaccount.google.com/connections

---

## 💡 Pro Tips

### Tip 1: Token Validity
- Access token প্রায় **1 ঘন্টা** valid থাকে
- Expire হলে simply re-login করুন

### Tip 2: Testing Multiple Accounts
- Different browsers use করুন (Chrome, Firefox, Edge)
- অথবা Incognito mode use করুন

### Tip 3: Debugging
- Browser DevTools → Network tab always open রাখুন
- Console tab এ errors check করুন
- Preserve log enable করুন

### Tip 4: Scope Changes
- যদি scopes change করেন:
  1. User এর permission revoke করুন
  2. App cache clear করুন
  3. Fresh consent নিন

---

## 🚨 Common Errors & Solutions

### Error: "redirect_uri_mismatch"
**কারণ:** Google Cloud Console এ redirect URI match করছে না  
**সমাধান:** Console এ গিয়ে exact URI add করুন

### Error: "Access blocked: Authorization Error"
**কারণ:** OAuth consent screen properly configured না  
**সমাধান:** Test users add করুন অথবা app publish করুন

### Error: "Folder is not public or not found"
**কারণ:** Token missing অথবা expired  
**সমাধান:** Re-login করুন, session check করুন

### Error: "Failed to fetch media"
**কারণ:** Token invalid বা file access নেই  
**সমাধান:** Drive এ manually check করুন file access আছে কিনা

---

## ✅ Success Checklist (সংক্ষেপে)

- [ ] Google Drive API enabled
- [ ] OAuth scopes configured (`drive.readonly`)
- [ ] Code changes deployed
- [ ] Fresh Google login done
- [ ] Private folder test করা হয়েছে
- [ ] Images successfully load হচ্ছে

---

## 🎯 One-Command Debug

যদি কিছু কাজ না করে, এই commands গুলো run করুন:

```javascript
// Browser console এ paste করুন:
(async () => {
  const session = await fetch('/api/auth/session').then(r=>r.json());
  console.log('✅ Logged in:', !!session?.user);
  console.log('✅ Has email:', session?.user?.email);
  console.log('✅ Has Google token:', !!session?.user?.googleAccessToken);
  if (session?.user?.googleAccessToken) {
    console.log('✅ Token length:', session.user.googleAccessToken.length);
    console.log('🎉 All good! Private folders should work.');
  } else {
    console.log('❌ No Google token! Please:');
    console.log('   1. Sign out');
    console.log('   2. Sign in with Google');
    console.log('   3. Allow Drive permissions');
  }
})();
```

---

## 📞 Support

যদি এখনও কাজ না করে:

1. **Check করুন:**
   - Browser console errors
   - Network tab failed requests
   - Server logs

2. **Verify করুন:**
   - Google Cloud Console settings
   - Environment variables
   - Code changes properly deployed

3. **Test করুন:**
   - Different browser
   - Incognito mode
   - Different Google account

---

## 🎉 Success!

যখন এই দেখবেন, তখন বুঝবেন সব ঠিক আছে:

✅ Google login করার সময় Drive permission চাইছে  
✅ Session এ `googleAccessToken` আছে  
✅ Public folders load হচ্ছে  
✅ **Private folders load হচ্ছে (যেটা আগে হতো না!)**  
✅ Browser console এ কোনো error নেই  

**Implementation Complete! 🚀**

---

*সর্বশেষ আপডেট: Implementation এর সময়*
