import { NextResponse } from "next/server";
import { currentUser, publicUser, readStore, withStoreLock, writeStore } from "../_lib";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status });

async function patch(request: Request) {
  try {
    const store = await readStore();
    const user = await currentUser(request, store);
    if (!user) return json({ error: "Жүйеге кіріңіз" }, 401);

    const body = await request.json();
    const name = String(body.name || "").trim();
    const avatar = body.avatar === null ? null : String(body.avatar || "");
    if (name.length < 2 || name.length > 80) return json({ error: "Аты 2–80 таңба болуы керек" }, 400);

    if (avatar) {
      const validImage = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+=*$/.test(avatar);
      if (!validImage) return json({ error: "PNG, JPG, WEBP немесе GIF форматындағы суретті таңдаңыз" }, 400);
      if (avatar.length > 1_400_000) return json({ error: "Аватар суреті 1 МБ-тан аспауы керек" }, 413);
    }

    user.name = name;
    user.avatar = avatar || undefined;
    await writeStore(store);
    return json({ user: publicUser(user) });
  } catch {
    return json({ error: "Профильді сақтау кезінде қате шықты" }, 500);
  }
}
export const PATCH = (request: Request) => withStoreLock(() => patch(request));
