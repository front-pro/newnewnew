import { connection, NextResponse } from "next/server";
import { getSessionToken, publicUser, readStore, sessionUserId, withStoreReadLock } from "../_lib";

async function get(request: Request) {
  await connection();
  const store = await readStore();
  const userId = sessionUserId(store.sessions[getSessionToken(request)]);
  const user = store.users.find(item => item.id === userId);
  const response = user ? NextResponse.json({ user: publicUser(user) }) : NextResponse.json({ user: null });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const GET = (request: Request) => withStoreReadLock(() => get(request));
