// app/api/presence/heartbeat/route.ts

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/authz";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
  Vary: "Cookie",
};

// ✅ শুধু authenticated ইউজার—কোনো extra permission লাগবে না
export const POST = withAuth(async () => {
  try {
    // withAuth -> requireAuth পাস করলে user নিশ্চিত—getServerSession দিয়ে ভ্যালিডেটেড
    // এখানে DB আপডেট করলেই হবে (user id টা middleware/withAuth-এ ভেরিফাইড)
    // তবে user.id লাগলে চাইলে withAuth-কে একটু বাড়িয়ে req-এ বসাতে পারেন।
    // এখানে আমরা সরাসরি lastSeenAt আপডেট করছি—current user context ধরেই।

    // 💡 safest: prisma.$executeRawOr use updateMany with session user id if you pass it.
    // Minimal approach: let DB do the update using session.subject via NextAuth token in middleware.
    // কিন্তু withAuth বর্তমানে user অবজেক্ট রিটার্ন করে না, তাই আমরা আল্টারনেটিভ হিসেবে
    // ট্রানজ্যাকশন-কম এন্ডপয়েন্ট রেখে দিচ্ছি: lastSeenAt আপডেট ক্লায়েন্ট-সাইডে userId দিয়ে করুন
    // অথবা নিচের মত ছোট হেল্পার ব্যবহার করুন (ঐচ্ছিক) — দেখুন নোট।

    // 🔧 বাস্তব আপডেট (server-side user id নিশ্চিত করতে ছোট হেল্পার ইউজ করুন)
    // এখানে সরাসরি session থেকে id রিড করার জন্য ছোট হেল্পার আনছি:
    const { getServerSession } = await import("next-auth");
    const { authOptions } = await import("@/lib/auth");
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id as string | undefined;

    if (!userId) {
      return NextResponse.json(
        { ok: false },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    await prisma.user.update({
      where: { id: userId },
      data: { lastSeenAt: new Date() },
    });

    return NextResponse.json({ ok: true }, { headers: NO_STORE_HEADERS });
  } catch (e) {
    console.error("presence/heartbeat error:", e);
    return NextResponse.json(
      { ok: false },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
});
