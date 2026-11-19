import Login from "@/views/Login";
import { safeReturnTo } from "@/lib/return-to";

type Props = { searchParams: Promise<{ next?: string | string[] }> };

export default async function LoginPage({ searchParams }: Props) {
  const { next } = await searchParams;
  const value = Array.isArray(next) ? next[0] : next;
  return <Login next={safeReturnTo(value)} />;
}
