import { NextResponse } from "next/server";
import { getSessionToken, publicUser, readStore, withStoreLock } from "../_lib";

async function get(request: Request) {
  const store = await readStore();
  const userId = store.sessions[getSessionToken(request)];
  const user = store.users.find(item => item.id === userId);
  return user ? NextResponse.json({ user: publicUser(user) }) : NextResponse.json({ user: null });
}
export const GET = (request: Request) => withStoreLock(() => get(request));
