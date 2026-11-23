"use client";

import { useState, type SubmitEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { registerUser } from "@/api/auth";
import { ROUTES } from "@/lib/routes";
import { safeReturnTo } from "@/lib/return-to";
import { useAuth } from "@/auth/useAuth";

export default function Register({ next }: { next?: string }) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const router = useRouter();
  const destination = safeReturnTo(next);
  const inputClass = "h-11 w-full rounded-lg border border-input bg-background px-3 outline-none focus-visible:ring-2 focus-visible:ring-brand";

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    const confirmPassword = String(data.get("confirmPassword") ?? "");

    if (!name) { setError("Please enter your full name."); return; }
    if (password.length < 8 || password.length > 100) {
      setError("Password must be between 8 and 100 characters."); return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match."); return;
    }

    setLoading(true);
    try {
      const response = await registerUser({ name, email, password });
      signIn(response);
      router.replace(destination);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 409) setError("This email is already registered.");
        else if (err.response?.status === 422) setError("Please check your registration information.");
        else setError("Unable to create account. Please try again.");
      } else {
        setError("An unexpected error occurred.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center bg-surface-warm px-4 py-12">
      <Card className="w-full max-w-md gap-0 rounded-2xl p-8 shadow-lg">
        <div className="mb-8 text-center">
          <h1 className="font-heading text-3xl font-bold">Create an Account</h1>
          <p className="mt-2 text-muted-foreground">Join Game Night Planner today!</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">Full Name</label>
            <input id="name" name="name" type="text" placeholder="Enter your full name"
              autoComplete="name" minLength={1} maxLength={100} required className={inputClass} />
          </div>
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">Email</label>
            <input id="email" name="email" type="email" placeholder="Enter your email"
              autoComplete="email" maxLength={254} required className={inputClass} />
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">Password</label>
            <input id="password" name="password" type="password" placeholder="Create a password"
              autoComplete="new-password" minLength={8} maxLength={100} required className={inputClass} />
            <p className="text-xs text-muted-foreground">Password must be at least 8 characters.</p>
          </div>
          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="text-sm font-medium">Confirm Password</label>
            <input id="confirmPassword" name="confirmPassword" type="password"
              placeholder="Confirm your password" autoComplete="new-password" required className={inputClass} />
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={loading}
            className="h-11 w-full rounded-lg bg-brand-strong text-white hover:bg-brand">
            {loading ? "Creating Account..." : "Create Account"}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href={`${ROUTES.login}?next=${encodeURIComponent(destination)}`}
            className="font-semibold text-brand-strong hover:underline">Log In</Link>
        </p>
      </Card>
    </div>
  );
}
