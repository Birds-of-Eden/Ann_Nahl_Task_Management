// Minimal client helpers for auth used by client components
// signUp.email(payload, hooks) -> creates user via /api/users
// signOut() -> POST /api/auth/sign-out and returns boolean

type SignUpPayload = {
  name?: string;
  email: string;
  password: string;
  role?: string | { id: string; name?: string } | null;
  roleId?: string | null;
  clientId?: string | null;
  [k: string]: any;
};

export const signUp = {
  email: async (
    payload: SignUpPayload,
    hooks?: {
      onRequest?: () => void;
      onSuccess?: (res?: any) => void;
      onError?: (err: any) => void;
    }
  ) => {
    try {
      hooks?.onRequest?.();

      const body: any = { ...payload };

      // If caller passed role as name, resolve to roleId
      if (body.role && typeof body.role === "string") {
        try {
          const rolesRes = await fetch("/api/roles");
          if (rolesRes.ok) {
            const rolesJson = await rolesRes.json();
            const roles = rolesJson?.data || [];
            const found = roles.find(
              (r: any) => r.name?.toLowerCase() === body.role.toLowerCase()
            );
            if (found) body.roleId = found.id;
          }
        } catch (e) {
          // ignore and let server validate
        }
      }

      // If roleId missing, server will return 400; forward as-is
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!res.ok) {
        hooks?.onError?.(json);
        return json;
      }

      hooks?.onSuccess?.(json);
      return json;
    } catch (err) {
      hooks?.onError?.(err);
      return { error: err };
    }
  },
};

export async function signOut() {
  try {
    const res = await fetch("/api/auth/sign-out", { method: "POST" });
    if (!res.ok) return false;
    return true;
  } catch (e) {
    console.error("signOut error:", e);
    return false;
  }
}

export default { signUp, signOut };
