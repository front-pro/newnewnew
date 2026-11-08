import { NextResponse } from "next/server";
import { getSessionToken, publicUser, readStore } from "../_lib";

async function get(request: Request) {
  const store = await readStore();
  const userId = store.sessions[getSessionToken(request)];
  const user = store.users.find(item => item.id === userId);
  const response = user ? NextResponse.json({ user: publicUser(user) }) : NextResponse.json({ user: null });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const GET = (request: Request) => get(request);
