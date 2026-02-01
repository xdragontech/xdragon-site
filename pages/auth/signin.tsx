// pages/auth/signin.tsx
import { getProviders, signIn } from "next-auth/react";
import type { GetServerSideProps } from "next";

type Props = {
  providers: Awaited<ReturnType<typeof getProviders>>;
};

export default function SignIn({ providers }: Props) {
  const emailProvider = providers && Object.values(providers).find((p) => p.id === "email");
  const google = providers && Object.values(providers).find((p) => p.id === "google");
  const github = providers && Object.values(providers).find((p) => p.id === "github");

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-3xl border border-neutral-200 bg-white shadow-sm p-8">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-black text-white grid place-items-center font-bold">XD</div>
          <div>
            <div className="text-lg font-semibold">X Dragon Tools</div>
            <div className="text-sm text-neutral-600">Sign in to access the Prompt Library.</div>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {emailProvider && (
            <button
              className="w-full rounded-2xl bg-black text-white px-4 py-3 text-sm font-semibold hover:opacity-90"
              onClick={() => signIn(emailProvider.id)}
            >
              Continue with Email (Magic Link)
            </button>
          )}

          <div className="grid grid-cols-2 gap-3">
            {google && (
              <button
                className="rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm font-semibold hover:bg-neutral-50"
                onClick={() => signIn(google.id)}
              >
                Google
              </button>
            )}
            {github && (
              <button
                className="rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm font-semibold hover:bg-neutral-50"
                onClick={() => signIn(github.id)}
              >
                GitHub
              </button>
            )}
          </div>

          <p className="text-xs text-neutral-500">
            By continuing, you agree to receive a sign-in email if you choose Magic Link.
          </p>
        </div>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async () => {
  const providers = await getProviders();
  return { props: { providers } };
};
