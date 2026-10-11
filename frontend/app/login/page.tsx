"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/app-provider";

export default function LoginPage() {
  const router = useRouter();
  const { signIn, signUp } = useApp();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegistration, setIsRegistration] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      if (isRegistration) await signUp(name, email, password);
      else await signIn(email, password);
      router.push("/scan?demo=1");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to sign in.");
    } finally { setIsSubmitting(false); }
  };
  return (
    <div className="mx-auto grid min-h-[calc(100vh-104px)] max-w-6xl items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-2">
      <div className="hidden overflow-hidden rounded-3xl border border-zinc-800 lg:block">
        <img
          src="https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=1300&q=85"
          alt="Fresh pasta at an Italian restaurant"
          className="h-[540px] w-full object-cover"
        />
      </div>
      <div className="mx-auto w-full max-w-md">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Link>
        <div className="mt-10 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-300">
          <Sparkles className="h-5 w-5" />
        </div>
        <h1 className="mt-5 text-4xl font-semibold tracking-tight text-white">
          Make every menu yours.
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-500">
          Save your palate, guardrails, and scanned menus.
        </p>
        <form onSubmit={submit} className="mt-8 space-y-4">
          {isRegistration && <label className="block text-xs font-medium text-zinc-400">
            First name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Priya"
              className="mt-2 h-12 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm text-white outline-none transition focus:border-blue-500"
            />
          </label>}
          <label className="block text-xs font-medium text-zinc-400">
            Email
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              placeholder="you@example.com"
              className="mt-2 h-12 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm text-white outline-none transition focus:border-blue-500"
            />
          </label>
          <label className="block text-xs font-medium text-zinc-400">Password<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" minLength={8} required placeholder="At least 8 characters" className="mt-2 h-12 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm text-white outline-none transition focus:border-blue-500" /></label>
          {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>}
          <button disabled={isSubmitting} className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60">
            {isSubmitting ? "Connecting…" : isRegistration ? "Create account" : "Continue to PreBite"} <ArrowRight className="h-4 w-4" />
          </button>
        </form>
        <button onClick={() => { setIsRegistration(!isRegistration); setError(null); }} className="mt-4 w-full text-center text-xs text-blue-400 hover:text-blue-300">{isRegistration ? "Already have an account? Sign in" : "New here? Create an account"}</button>
      </div>
    </div>
  );
}
