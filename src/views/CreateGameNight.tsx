"use client";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import { CalendarDays, CalendarPlus, Check, Dices, MapPin, Sparkles, Users } from "lucide-react";
import api from "@/api/client";
import { Button } from "@/components/ui/button";
import { getFriends } from "@/api/friends";
import { useAuth } from "@/auth/useAuth";
import { formatEventDate, getInitials, placeholderColor } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { Game } from "@/types/game";
import type { PublicUser } from "@/types/friend";

const toggleId = (ids: number[], id: number) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);

function FormSection({ step, title, children }: { step: string; title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-4 flex items-baseline gap-3 text-xl font-bold">
        <span className="font-mono text-sm text-cta">{step}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function InfoRow({ icon: Icon, children }: { icon: typeof Dices; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="size-4 text-cta" aria-hidden="true" />
      {children}
    </div>
  );
}

function GameArt({ game, className }: { game: Game; className?: string }) {
  return (
    <div className={cn("flex items-center justify-center", placeholderColor(game.id), className)}>
      {game.image_url ? <img src={game.image_url} alt="" className="size-full object-cover" /> : <Dices className="size-10 opacity-60" />}
    </div>
  );
}

function Avatar({ person, className }: { person: PublicUser; className?: string }) {
  return (
    <span className={cn("flex items-center justify-center overflow-hidden rounded-full font-bold", placeholderColor(person.id), className)}>
      {person.avatar_url ? <img src={person.avatar_url} alt="" className="size-full object-cover" /> : getInitials(person.name)}
    </span>
  );
}

export default function CreateGameNight() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id;
  const [form, setForm] = useState({ name: "", startsAt: "", location: "", notes: "" });
  const [gameIds, setGameIds] = useState<number[]>([]);
  const [inviteeIds, setInviteeIds] = useState<number[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [friends, setFriends] = useState<PublicUser[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (userId === undefined) return;
    api
      .get<{ games: { game: Game }[] }>(`/users/${userId}/collection`, { params: { status: "owned" } })
      .then((res) => setGames(res.data.games.map((entry) => entry.game)))
      .catch(() => {});
  }, [userId]);

  useEffect(() => {
    getFriends().then(setFriends).catch(() => {});
  }, []);

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value });
  const date = new Date(form.startsAt);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await api.post("/game-nights", { name: form.name.trim(), starts_at: date.toISOString(), location: form.location.trim(), notes: form.notes.trim() || null, game_ids: gameIds, invitee_ids: inviteeIds });
      setCreated(true);
      setTimeout(() => router.push(ROUTES.home), 1500);
    } catch (err) {
      const detail = axios.isAxiosError(err) ? err.response?.data?.detail : null;
      setError(typeof detail === "string" ? detail : "Unable to create game night. Please try again.");
      setSubmitting(false);
    }
  }

  const picked = games.filter((g) => gameIds.includes(g.id));
  const guests = friends.filter((f) => inviteeIds.includes(f.id));
  const [featured, ...others] = picked;

  return (
    <div className="min-h-screen bg-surface-warm">
      {created && (
        <p role="status" className="fixed right-6 bottom-6 z-50 flex items-center gap-2 rounded-xl bg-brand-strong px-5 py-3 font-semibold text-white shadow-lg">
          <Check className="size-5" aria-hidden="true" />
          Game night created!
        </p>
      )}
      <section className="bg-brand px-4 py-12 text-brand-foreground">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center gap-3">
            <CalendarPlus className="size-9" aria-hidden="true" />
            <h1 className="font-heading text-4xl font-bold">Let&apos;s Make a Game Night!</h1>
          </div>
          <p className="mt-3 text-lg text-white/90">Pick a time, choose a game, and invite your crew.</p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <form onSubmit={handleSubmit} className="grid overflow-hidden rounded-3xl border bg-white lg:grid-cols-[1fr_340px]">
          <div className="flex flex-col gap-10 p-6 sm:p-10">
            <FormSection step="01" title="The details">
              <div className="grid gap-4 text-sm font-medium sm:grid-cols-2">
                <label className="flex flex-col gap-2 sm:col-span-2">Name<input required value={form.name} onChange={set("name")} placeholder="Friday Strategy Night" className="rounded-xl border px-4 py-3 font-normal focus-visible:border-brand focus-visible:outline-none" /></label>
                <label className="flex flex-col gap-2">Date &amp; time<input required type="datetime-local" value={form.startsAt} onChange={set("startsAt")} className="rounded-xl border px-4 py-3 font-normal focus-visible:border-brand focus-visible:outline-none" /></label>
                <label className="flex flex-col gap-2">Location<input required value={form.location} onChange={set("location")} placeholder="42 Maple Street" className="rounded-xl border px-4 py-3 font-normal focus-visible:border-brand focus-visible:outline-none" /></label>
                <label className="flex flex-col gap-2 sm:col-span-2">Notes<textarea rows={3} value={form.notes} onChange={set("notes")} placeholder="Bring snacks!" className={cn("rounded-xl border px-4 py-3 font-normal focus-visible:border-brand focus-visible:outline-none", "resize-none")} /></label>
              </div>
            </FormSection>

            <FormSection step="02" title="From your collection">
              {games.length === 0 ? (
                <p className="rounded-2xl border-2 border-dashed p-6 text-center text-sm text-muted-foreground">
                  No games in your collection yet.{" "}
                  <Link href={ROUTES.collection} className="font-semibold text-brand-strong hover:underline">Add some</Link>
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {games.map((g) => {
                    const on = gameIds.includes(g.id);
                    return (
                      <button key={g.id} type="button" aria-pressed={on} onClick={() => setGameIds(toggleId(gameIds, g.id))} className={cn("relative overflow-hidden rounded-2xl border-2 text-left", on && "border-brand")}>
                        <GameArt game={g} className="aspect-square w-full" />
                        <p className="truncate p-3 text-sm font-semibold">{g.name}<span className="block text-xs font-normal text-muted-foreground">{g.minimum_players}–{g.maximum_players} players · {g.playtime} min</span></p>
                        {on && <Check className="absolute top-2 right-2 size-7 rounded-full bg-brand p-1.5 text-white" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </FormSection>

            <FormSection step="03" title="Your crew">
              {friends.length === 0 ? (
                <p className="rounded-2xl border-2 border-dashed p-6 text-center text-sm text-muted-foreground">No friends to invite yet.</p>
              ) : (
                <div className="grid grid-cols-3 gap-4 sm:grid-cols-5">
                  {friends.map((f) => {
                    const on = inviteeIds.includes(f.id);
                    return (
                      <button key={f.id} type="button" aria-pressed={on} onClick={() => setInviteeIds(toggleId(inviteeIds, f.id))} className="flex flex-col items-center gap-2 text-sm font-medium">
                        <span className="relative">
                          <Avatar person={f} className={cn("size-16 text-lg", on && "ring-4 ring-brand")} />
                          {on && <Check className="absolute -right-1 -bottom-1 size-6 rounded-full bg-brand p-1 text-white" />}
                        </span>
                        <span className={cn("max-w-full truncate", on && "text-brand-strong")}>{f.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </FormSection>
          </div>

          <aside className="relative flex flex-col gap-5 border-t-2 border-dashed bg-brand-soft/40 p-6 sm:p-8 lg:border-t-0 lg:border-l-2" aria-label="Your game night">
            <span className="absolute -top-4 -left-4 size-8 rounded-full border bg-surface-warm" />
            <span className="absolute -top-4 -right-4 size-8 rounded-full border bg-surface-warm lg:top-auto lg:-bottom-4 lg:-left-4" />
            <p className="font-mono text-xs tracking-widest text-brand-strong uppercase">Now playing</p>
            {featured ? (
              <GameArt game={featured} className="aspect-square overflow-hidden rounded-2xl border" />
            ) : (
              <Link href={ROUTES.collection} className="flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border bg-white text-muted-foreground hover:border-brand hover:text-brand-strong">
                <Dices className="size-10" aria-hidden="true" />
                <span className="text-sm">Add a game from your collection</span>
              </Link>
            )}
            <div className="text-center">
              <h2 className="font-heading text-3xl font-bold">{featured ? featured.name : "No game yet"}</h2>
              {others.length > 0 && <p className="text-sm text-muted-foreground">+ {others.map((g) => g.name).join(", ")}</p>}
            </div>
            <div className="flex flex-col gap-2 text-sm">
              <InfoRow icon={CalendarDays}>{form.startsAt ? formatEventDate(date.toISOString()) : <span className="text-muted-foreground">Pick a date</span>}</InfoRow>
              <InfoRow icon={MapPin}>{form.location || <span className="text-muted-foreground">Add a location</span>}</InfoRow>
              <InfoRow icon={Users}>
                {guests.map((f) => <Avatar key={f.id} person={f} className="-mr-3 size-7 text-[10px] ring-2 ring-white" />)}
                <span className={cn("text-muted-foreground", guests.length > 0 && "ml-4")}>{guests.length ? `${guests.length} guests` : "Invite your crew"}</span>
              </InfoRow>
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={submitting} className="mt-auto h-13 rounded-xl bg-cta text-lg font-bold text-cta-foreground hover:bg-cta/90">
              <Sparkles className="size-5" />
              {created ? "Created!" : submitting ? "Creating..." : "Create Game Night"}
            </Button>
          </aside>
        </form>
      </div>
    </div>
  );
}
