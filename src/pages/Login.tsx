import { useState, type SubmitEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { loginUser } from "@/api/auth";
import { ROUTES } from "@/lib/routes";
import { useAuth } from "@/auth/useAuth";

function Login() {
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const location = useLocation();

  const requestedPage = (location.state as {
    from?: unknown;
    } | null)?.from;

  const destination =
    typeof requestedPage === "string" &&
    requestedPage.startsWith("/") &&
    !requestedPage.startsWith("//") &&
    !requestedPage.includes("\\") &&
    ![ROUTES.login, ROUTES.register].includes(
      requestedPage.split(/[?#]/)[0] as
        typeof ROUTES.login | typeof ROUTES.register
    )
      ? requestedPage
      : ROUTES.home;


  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
  event.preventDefault();

  setError("");
  setMessage("");
  setLoading(true);

  const formData = new FormData(event.currentTarget);

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  try {
    const response = await loginUser({ email, password });

    signIn(response);
    navigate(destination, { replace: true });

    
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      if (err.response?.status === 401) {
        setError("Incorrect email or password.");
      } else if (err.response?.status === 422) {
        setError("Please enter a valid email and password.");
      } else {
        setError("Unable to log in. Please try again.");
      }
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
          disabled={loading}
          className="h-11 w-full rounded-lg bg-brand-strong text-white hover:bg-brand"
        >
          {loading ? "Logging in..." : "Log In"}
        </Button>

        {error && (
          <p role="alert" className="text-center text-sm text-destructive">
            {error}
          </p>
        )}

        {message && (
          <p role="status" className="text-center text-sm text-brand-strong">
            {message}
          </p>
        )}
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Don't have an account?{" "}
        <Link
          to={ROUTES.register}
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
