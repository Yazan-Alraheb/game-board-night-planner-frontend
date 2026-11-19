import Register from "@/views/Register";
import { safeReturnTo } from "@/lib/return-to";

type Props = { searchParams: Promise<{ next?: string | string[] }> };

export default async function RegisterPage({ searchParams }: Props) {
  const { next } = await searchParams;
  const value = Array.isArray(next) ? next[0] : next;
  return <Register next={safeReturnTo(value)} />;
}
