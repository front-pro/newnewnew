import { NextResponse } from "next/server";
import { getSessionToken, publicUser, readStore } from "../_lib";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const store = await readStore();
  const userId = store.sessions[getSessionToken(request)];
  const user = store.users.find(item => item.id === userId);
  return user ? NextResponse.json({ user: publicUser(user) }) : NextResponse.json({ user: null });
}
