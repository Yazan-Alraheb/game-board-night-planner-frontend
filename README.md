
# Game Night Planner - Frontend

A web application for discovering board games, managing personal game collections, and organizing game nights.

## Tech Stack

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS 4
- ShadCN UI / Base UI
- Axios
- Bun

The frontend communicates with a separate FastAPI backend and PostgreSQL database.

## Prerequisites

- Node.js 20.9 or newer
- Bun
- FastAPI backend running locally

## Getting Started

1. Clone the repository:

   git clone https://github.com/Yazan-Alraheb/game-board-night-planner-frontend.git

2. Enter the project directory:

   cd game-board-night-planner-frontend

3. Install dependencies:

   bun install

4. Configure environment variables:

   cp .env.example .env.local

5. Start the development server:

   bun run dev

6. Open http://localhost:3000

## Backend Connection

The frontend uses Next.js rewrites to forward requests from `/api/*` to the FastAPI backend.

By default, FastAPI runs at:

http://127.0.0.1:8000

The backend must be running for Login, Registration, and game-related API requests to work.

To use a different backend address, update `FASTAPI_ORIGIN` in `.env.local` and restart Next.js.

## Available Commands

- `bun run dev` - Start development server
- `bun run build` - Create production build
- `bun run start` - Start production server
- `bun run lint` - Run Oxlint
- `bun run typecheck` - Check TypeScript
- `bun run test` - Run unit tests (Bun test runner, `*.test.ts` files in `src/`)

## Authentication

Authentication currently uses JWT tokens stored in sessionStorage.

Protected routes require login, and users return to their previous page after successfully logging in.

For production, HttpOnly cookie authentication with CSRF protection is recommended.

### Registration

Users register with a full name, unique username, email, and password.

Username requirements:

- Between 3 and 32 characters.
- Letters, numbers, and underscores only.
- Case-insensitive and stored in lowercase.
- Must be unique.

### Login

Users can log in using either their username or email.

Protected routes require login, and users return to their previous page after successfully logging in.

Logging out clears the authentication session. Login form values are reset after successful authentication.

Sessions created before the username update require users to log in again.

For production, HttpOnly cookie authentication with CSRF protection is recommended.


## Friends and Username Search

Users can search for other members by display name or username.

- Partial name and username searches are supported.
- Searches are case-insensitive.
- Use @username for an exact username match.

Usernames are displayed in search results, incoming requests, outgoing requests, and the friends list.

## Username Backend Compatibility

This frontend requires the backend username implementation.

Existing PostgreSQL databases must apply the username migration documented in the backend repository before using this feature.

Existing accounts receive generated usernames and retain their original email and password.


## Profile & Preferences

Authenticated users can access their profile by clicking their name in the navigation bar or visiting `/profile`.

### Profile Features

- Edit display name and biography.
- Update or remove the profile picture using an image URL.
- View the account username and membership date.
- Save profile changes to the backend.
- Automatically synchronize updated profile information with the authentication session.
- Sign out directly from the profile page.

Usernames remain read-only.

### Game Preferences

Users can select multiple favorite game categories and a preferred playtime.

Available playtime options:

- Quick: Under 30 minutes (stored as 25 minutes).
- Medium: 30–90 minutes (stored as 60 minutes).
- Long: Over 90 minutes (stored as 120 minutes).

Previously saved difficulty and disliked category preferences are preserved when updating the profile.

### Backend Integration

The profile page uses the following authenticated API endpoints:

- GET /api/users/{id}
- PUT /api/users/{id}
- GET /api/users/{id}/preferences
- PUT /api/users/{id}/preferences

## Project Structure

- `src/app/` - Next.js pages and layouts
- `src/views/` - Reusable page components
- `src/components/` - Shared UI components
- `src/auth/` - Authentication and session management
- `src/api/` - FastAPI requests
- `src/lib/` - Shared utilities
