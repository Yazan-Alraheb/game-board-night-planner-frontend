
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

## Authentication

Authentication currently uses JWT tokens stored in sessionStorage.

Protected routes require login, and users return to their previous page after successfully logging in.

For production, HttpOnly cookie authentication with CSRF protection is recommended.

## Project Structure

- `src/app/` - Next.js pages and layouts
- `src/views/` - Reusable page components
- `src/components/` - Shared UI components
- `src/auth/` - Authentication and session management
- `src/api/` - FastAPI requests
- `src/lib/` - Shared utilities
