import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { password } = await request.json();

  if (!password || password !== process.env.SITE_PASSWORD) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set("auth", password, {
    httpOnly: true,
    path: "/",
    sameSite: "strict",
    // 30-day session
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}
