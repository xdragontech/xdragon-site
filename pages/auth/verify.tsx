// pages/auth/verify.tsx
import React from "react";
import type { GetServerSideProps } from "next";
import Link from "next/link";
import { prisma } from "../../lib/prisma";

type Props = {
  success: boolean;
  message: string;
};

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const token = String(ctx.query.token || "");
  const email = String(ctx.query.email || "").toLowerCase().trim();

  if (!token || !email) {
    return { props: { success: false, message: "Missing verification token." } };
  }

  try {
    const record = await prisma.emailVerificationToken.findUnique({ where: { token } });
    if (!record || record.identifier !== email) {
      return { props: { success: false, message: "That verification link is invalid or has already been used." } };
    }

    if (record.expires.getTime() < Date.now()) {
      await prisma.emailVerificationToken.delete({ where: { token } }).catch(() => {});
      return { props: { success: false, message: "That verification link has expired. Please sign up again." } };
    }

    await prisma.user.update({
      where: { email },
      data: { emailVerified: new Date() },
    });

    await prisma.emailVerificationToken.delete({ where: { token } }).catch(() => {});

    return { props: { success: true, message: "Email verified — you can now log in." } };
  } catch (e) {
    console.error("verify error:", e);
    return { props: { success: false, message: "Verification failed. Please try again." } };
  }
};

export default function VerifyPage({ success, message }: Props) {
  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Account Verification</h1>
        <p className="mt-3 text-sm text-neutral-700">{message}</p>

        <div className="mt-6 flex gap-3">
          <Link
            href="/auth/signin"
            className="inline-flex items-center justify-center rounded-xl bg-black text-white px-4 py-2 text-sm font-semibold"
          >
            Go to Login
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl border border-neutral-300 px-4 py-2 text-sm font-semibold"
          >
            Back to Site
          </Link>
        </div>

        {success && (
          <p className="mt-4 text-xs text-neutral-500">
            You can now log in with your email + password.
          </p>
        )}
      </div>
    </main>
  );
}
