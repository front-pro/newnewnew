import { NextResponse } from "next/server";
import { currentUser, readUserAudit, withStoreReadLock } from "../_lib";

export const GET = (request: Request) => withStoreReadLock(async () => {
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ error: "Жүйеге кіріңіз" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const events = await readUserAudit(user.id, 30);
  return NextResponse.json({ events }, { headers: { "Cache-Control": "private, no-store" } });
});
