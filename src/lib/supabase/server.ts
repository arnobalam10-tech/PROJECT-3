import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              // @supabase/ssr's own default is httpOnly: false (it supports a
              // browser-client cookie-reading pattern this app doesn't use --
              // src/lib/supabase/client.ts is unreferenced dead code, every
              // Supabase call in this app goes through server actions/RSC).
              // Force httpOnly so the session token is never readable by any
              // injected client-side JS (§24 item 8).
              cookieStore.set(name, value, { ...options, httpOnly: true });
            }
          } catch {
            // setAll called from a Server Component during render; the
            // middleware below is responsible for refreshing the session
            // in that case, so this can be safely ignored.
          }
        },
      },
    },
  );
}
