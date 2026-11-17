import api from "@/api/client";

// Data required for login
export interface LoginRequest {
  email: string;
  password: string;
}

// Data required for registration
export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

// User information returned by FastAPI
export interface AuthUser {
  id: number;
  name: string;
  email: string;
  created_at: string;
  bio: string | null;
  avatar_url: string | null;
}

// Response returned after successful authentication
export interface AuthResponse {
  user: AuthUser;
  access_token: string;
  token_type: string;
}

// Send login information to FastAPI
export async function loginUser(
  credentials: LoginRequest
): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>(
    "/auth/login",
    credentials
  );

  return response.data;
}

// Send registration information to FastAPI
export async function registerUser(
  userData: RegisterRequest
): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>(
    "/auth/register",
    userData
  );

  return response.data;
}
