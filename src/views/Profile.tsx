
"use client";

import { useEffect, useRef, useState, type SubmitEvent } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@/components/ui/avatar";

import { useAuth } from "@/auth/useAuth";
import { getSession } from "@/auth/session";
import type { AuthResponse } from "@/api/auth";

import { getProfile, updateProfile } from "@/api/profile";
import {
  getPreferences,
  updatePreferences,
} from "@/api/preferences";

import type { PreferenceUpdateRequest } from "@/types/preference";

import {
  PROFILE_CATEGORIES,
  PLAYTIME_OPTIONS,
  DEFAULT_PREFERENCES,
  toggleCategory,
  getPlaytimeOption,
  formatMemberSince,
} from "@/lib/profile";

import { getInitials, placeholderColor } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

interface ProfileDraft {
  name: string;
  bio: string;
  avatarUrl: string;
  preferences: PreferenceUpdateRequest;
}

function isValidAvatarUrl(value: string): boolean {
  if (!value.trim()) return true;

  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export default function Profile() {
  const { session } = useAuth();

  if (!session) return null;

  return (
    <ProfileEditor
      key={`${session.user.id}:${session.access_token}`}
      session={session}
    />
  );
}

function ProfileEditor({ session }: { session: AuthResponse }) {
  const router = useRouter();
  const { signIn, signOut } = useAuth();

  const userId = session.user.id;
  const accessToken = session.access_token;

  const [draft, setDraft] = useState<ProfileDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingAvatar, setEditingAvatar] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const saveController = useRef<AbortController | null>(null);

  // Load profile and preferences.
  useEffect(() => {
    const controller = new AbortController();

    async function loadProfile() {
      setLoading(true);
      setError("");

      try {
        const [profile, preferences] = await Promise.all([
          getProfile(userId, controller.signal),
          getPreferences(userId, controller.signal),
        ]);

        if (controller.signal.aborted) return;

        setDraft({
          name: profile.name,
          bio: profile.bio ?? "",
          avatarUrl: profile.avatar_url ?? "",
          preferences: preferences
            ? {
                favorite_categories: preferences.favorite_categories,
                disliked_categories: preferences.disliked_categories,
                preferred_difficulty: preferences.preferred_difficulty,
                preferred_playtime: preferences.preferred_playtime,
              }
            : {
                ...DEFAULT_PREFERENCES,
                favorite_categories: [],
                disliked_categories: [],
              },
        });
      } catch {
        if (!controller.signal.aborted) {
          setError("Unable to load your profile. Please try again.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      controller.abort();
      saveController.current?.abort();
    };
  }, [userId, accessToken, reloadKey]);

  function handleSignOut() {
    saveController.current?.abort();
    signOut();
    router.replace(ROUTES.login);
  }

  async function handleSave(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!draft || saveController.current) return;

    setError("");
    setMessage("");

    const name = draft.name.trim();
    const avatarUrl = draft.avatarUrl.trim();

    if (!name) {
      setError("Please enter your name.");
      return;
    }

    if (!isValidAvatarUrl(avatarUrl)) {
      setError("Please enter a valid HTTP or HTTPS image URL.");
      return;
    }

    const controller = new AbortController();
    saveController.current = controller;

    setSaving(true);

    let profileSaved = false;

    // Make sure an older request cannot restore a previous account.
    function currentSession() {
      const current = getSession();

      if (
        controller.signal.aborted ||
        current?.user.id !== userId ||
        current.access_token !== accessToken
      ) {
        return null;
      }

      return current;
    }

    try {
      if (!currentSession()) return;

      // Save the user's profile.
      const updatedUser = await updateProfile(
        userId,
        {
          name,
          bio: draft.bio.trim() || null,
          avatar_url: avatarUrl || null,
        },
        controller.signal
      );

      profileSaved = true;

      const current = currentSession();
      if (!current) return;

      // Update the navbar and stored authentication session.
      signIn({
        ...current,
        user: updatedUser,
      });

      // Save preferences separately.
      const updatedPreferences = await updatePreferences(
        userId,
        draft.preferences,
        controller.signal
      );

      if (!currentSession()) return;

      setDraft({
        name: updatedUser.name,
        bio: updatedUser.bio ?? "",
        avatarUrl: updatedUser.avatar_url ?? "",
        preferences: {
          favorite_categories: updatedPreferences.favorite_categories,
          disliked_categories: updatedPreferences.disliked_categories,
          preferred_difficulty: updatedPreferences.preferred_difficulty,
          preferred_playtime: updatedPreferences.preferred_playtime,
        },
      });

      setEditingAvatar(false);
      setMessage("Your changes have been saved.");
    } catch {
      if (!controller.signal.aborted) {
        setError(
          profileSaved
            ? "Your profile was saved, but preferences could not be saved. Please try again."
            : "Unable to save your changes. Please try again."
        );
      }
    } finally {
      saveController.current = null;

      if (!controller.signal.aborted) {
        setSaving(false);
      }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-warm px-4 py-12">
        <p role="status" className="mx-auto max-w-3xl">
          Loading your profile...
        </p>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="min-h-screen bg-surface-warm px-4 py-12">
        <Card className="mx-auto max-w-3xl p-6">
          <p role="alert" className="text-destructive">
            {error}
          </p>
          <Button onClick={() => setReloadKey((key) => key + 1)}>
            Try Again
          </Button>
        </Card>
      </div>
    );
  }

  const categories = Array.from(
    new Set([
      ...PROFILE_CATEGORIES,
      ...draft.preferences.favorite_categories,
    ])
  );

  const selectedPlaytime = getPlaytimeOption(
    draft.preferences.preferred_playtime
  );

  return (
    <main className="min-h-screen bg-surface-warm px-4 py-10 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-8 font-heading text-3xl font-bold">
          Profile &amp; Preferences
        </h1>

        <form onSubmit={handleSave} className="space-y-10">

          {/* Your Profile */}
          <Card className="gap-5 rounded-2xl p-6 sm:p-8">
            <h2 className="font-heading text-xl font-bold">
              Your Profile
            </h2>

            <div className="flex items-center gap-5">
              <div className="relative shrink-0">
                <Avatar className="size-20">
                  {draft.avatarUrl && isValidAvatarUrl(draft.avatarUrl) && (
                    <AvatarImage
                      src={draft.avatarUrl}
                      alt=""
                      referrerPolicy="no-referrer"
                    />
                  )}

                  <AvatarFallback
                    className={cn(
                      "text-xl font-semibold",
                      placeholderColor(userId)
                    )}
                  >
                    {getInitials(draft.name)}
                  </AvatarFallback>
                </Avatar>

                <button
                  type="button"
                  aria-label="Edit profile picture"
                  aria-expanded={editingAvatar}
                  disabled={saving}
                  onClick={() => setEditingAvatar(!editingAvatar)}
                  className="absolute bottom-0 right-0 flex size-8 items-center justify-center rounded-full bg-brand-strong text-white"
                >
                  <Pencil className="size-4" />
                </button>
              </div>

              <div className="min-w-0 flex-1">
                <input
                  type="text"
                  aria-label="Full name"
                  value={draft.name}
                  disabled={saving}
                  required
                  onChange={(event) =>
                    setDraft({ ...draft, name: event.target.value })
                  }
                  className="w-full border-b border-input bg-transparent py-1 font-heading text-xl font-bold outline-none focus:border-brand"
                />

                <p className="mt-1 break-words text-sm text-muted-foreground">
                  @{session.user.username} · Member since{" "}
                  {formatMemberSince(session.user.created_at)}
                </p>
              </div>
            </div>

            {/* Avatar editing */}
            {editingAvatar && (
              <div className="space-y-2">
                <label htmlFor="avatarUrl" className="text-sm font-medium">
                  Profile Picture URL
                </label>

                <input
                  id="avatarUrl"
                  type="text"
                  value={draft.avatarUrl}
                  placeholder="https://example.com/image.jpg"
                  disabled={saving}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      avatarUrl: event.target.value,
                    })
                  }
                  className="h-11 w-full rounded-lg border border-input bg-background px-3 outline-none focus-visible:ring-2 focus-visible:ring-brand"
                />

                <Button
                  type="button"
                  variant="outline"
                  disabled={saving}
                  onClick={() =>
                    setDraft({ ...draft, avatarUrl: "" })
                  }
                >
                  Remove Picture
                </Button>
              </div>
            )}

            {/* Biography */}
            <div className="space-y-2">
              <label htmlFor="bio" className="text-sm font-medium">
                Bio
              </label>

              <textarea
                id="bio"
                rows={3}
                value={draft.bio}
                disabled={saving}
                placeholder="Tell us a little about yourself..."
                onChange={(event) =>
                  setDraft({ ...draft, bio: event.target.value })
                }
                className="w-full resize-y rounded-xl border border-input bg-background p-3 outline-none focus-visible:ring-2 focus-visible:ring-brand"
              />
            </div>
          </Card>

          {/* Game Preferences */}
          <Card className="gap-6 rounded-2xl p-6 sm:p-8">
            <h2 className="font-heading text-xl font-bold">
              Game Preferences
            </h2>

            {/* Favorite Categories */}
            <fieldset disabled={saving} className="space-y-3">
              <legend className="mb-2 text-sm font-medium">
                Favorite Categories
              </legend>

              <div className="flex flex-wrap gap-2">
                {categories.map((category) => {
                  const selected =
                    draft.preferences.favorite_categories.includes(category);

                  return (
                    <button
                      key={category}
                      type="button"
                      aria-pressed={selected}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          preferences: {
                            ...draft.preferences,
                            favorite_categories: toggleCategory(
                              draft.preferences.favorite_categories,
                              category
                            ),
                          },
                        })
                      }
                      className={cn(
                        "rounded-full border px-4 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-brand",
                        selected
                          ? "border-brand-strong bg-brand-strong text-white"
                          : "border-input bg-background text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {category}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* Preferred Play Time */}
            <fieldset disabled={saving}>
              <legend className="mb-3 text-sm font-medium">
                Preferred Play Time
              </legend>

              <div className="space-y-3">
                {PLAYTIME_OPTIONS.map((option) => {
                  const selected =
                    selectedPlaytime === option.value;

                  return (
                    <label
                      key={option.value}
                      className={cn(
                        "flex cursor-pointer items-center rounded-xl border px-4 py-3 text-sm focus-within:ring-2 focus-within:ring-brand",
                        selected
                          ? "border-brand-strong bg-brand-soft text-brand-strong"
                          : "border-input bg-background hover:bg-muted"
                      )}
                    >
                      <input
                        type="radio"
                        name="preferredPlaytime"
                        value={option.value}
                        checked={selected}
                        className="sr-only"
                        onChange={() =>
                          setDraft({
                            ...draft,
                            preferences: {
                              ...draft.preferences,
                              preferred_playtime: option.value,
                            },
                          })
                        }
                      />

                      {option.label}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </Card>

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

          {/* Page Actions */}
          <div className="flex items-center justify-between gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleSignOut}
              className="rounded-xl border-destructive/40 px-6 text-destructive hover:bg-destructive/10"
            >
              Sign Out
            </Button>

            <Button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-brand-strong px-6 text-white hover:bg-brand"
            >
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </main>
  );
}
