import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { password } = await request.json();

  const envPassword = process.env.SITE_PASSWORD?.trim();
  const inputPassword = password?.trim();

  console.log("Auth attempt — received:", JSON.stringify(inputPassword), "env:", JSON.stringify(envPassword));

  if (!inputPassword || inputPassword !== envPassword) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set("auth", inputPassword, {
    httpOnly: true,
    path: "/",
    sameSite: "strict",
    // 30-day session
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}
