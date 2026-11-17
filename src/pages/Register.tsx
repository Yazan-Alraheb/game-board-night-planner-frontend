
import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ROUTES } from "@/lib/routes";

function Register() {
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    const formData = new FormData(event.currentTarget);

    const name = String(formData.get("name") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(
      formData.get("confirmPassword") ?? ""
    );

    if (!name) {
      setError("Please enter your full name.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    // PR 1: Frontend only. No account is created.
    // API integration will be implemented in PR 2.
    setMessage(
      "Registration form ready. Backend integration coming next."
    );
  }

  const inputClass =
    "h-11 w-full rounded-lg border border-input " +
    "bg-background px-3 outline-none " +
    "focus-visible:ring-2 focus-visible:ring-brand";

  return (
    <div className="flex min-h-[80vh] items-center justify-center bg-surface-warm px-4 py-12">
      <Card className="w-full max-w-md gap-0 rounded-2xl p-8 shadow-lg">
        <div className="mb-8 text-center">
          <h1 className="font-heading text-3xl font-bold">
            Create an Account
          </h1>
          <p className="mt-2 text-muted-foreground">
            Join Game Night Planner today!
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">
              Full Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              placeholder="Enter your full name"
              autoComplete="name"
              minLength={1}
              maxLength={100}
              required
              className={inputClass}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="Enter your email"
              autoComplete="email"
              maxLength={254}
              required
              className={inputClass}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="Create a password"
              autoComplete="new-password"
              minLength={8}
              maxLength={100}
              required
              className={inputClass}
            />
            <p className="text-xs text-muted-foreground">
              Must be at least 8 characters.
            </p>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="confirmPassword"
              className="text-sm font-medium"
            >
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              placeholder="Confirm your password"
              autoComplete="new-password"
              required
              className={inputClass}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          {message && (
            <p role="status" className="text-sm text-brand-strong">
              {message}
            </p>
          )}

          <Button
            type="submit"
            className="h-11 w-full rounded-lg bg-brand-strong text-white hover:bg-brand"
          >
            Create Account
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            to={ROUTES.login}
            className="font-semibold text-brand-strong hover:underline"
          >
            Log In
          </Link>
        </p>
      </Card>
    </div>
  );
}

export default Register;
