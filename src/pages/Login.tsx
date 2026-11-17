
import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

function Login() {
  const [message, setMessage] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // PR 1: Frontend only.
    // FastAPI authentication will be connected in PR 2.
    setMessage("Login form ready. Backend integration coming next.");
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center bg-surface-warm px-4 py-12">
      <Card className="w-full max-w-md gap-0 rounded-2xl p-8 shadow-lg">
        <div className="mb-8 text-center">
          <h1 className="font-heading text-3xl font-bold">
            Welcome Back
          </h1>
          <p className="mt-2 text-muted-foreground">
            Log in to your Game Night account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              name="email"
              placeholder="Enter your email"
              autoComplete="email"
              required
              maxLength={254}
              className="h-11 w-full rounded-lg border border-input bg-background px-3 outline-none focus-visible:ring-2 focus-visible:ring-brand"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              type="password"
              name="password"
              placeholder="Enter your password"
              autoComplete="current-password"
              required
              className="h-11 w-full rounded-lg border border-input bg-background px-3 outline-none focus-visible:ring-2 focus-visible:ring-brand"
            />
          </div>

          <Button
            type="submit"
            className="h-11 w-full rounded-lg bg-brand-strong text-white hover:bg-brand"
          >
            Log In
          </Button>

          {message && (
            <p role="status" className="text-center text-sm text-brand-strong">
              {message}
            </p>
          )}
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Don't have an account?{" "}
          <Link
            to="/register"
            className="font-semibold text-brand-strong hover:underline"
          >
            Sign up
          </Link>
        </p>
      </Card>
    </div>
  );
}

export default Login;
