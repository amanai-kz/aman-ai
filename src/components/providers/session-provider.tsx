"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import { ReactNode } from "react";
import { LocaleProvider } from "@/components/providers/locale-provider";

export function SessionProvider({ children }: { children: ReactNode }) {
  return (
    <NextAuthSessionProvider>
      <LocaleProvider>{children}</LocaleProvider>
    </NextAuthSessionProvider>
  );
}
