import { NextResponse } from "next/server";

export async function GET() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA || "dev";
  const msg = process.env.VERCEL_GIT_COMMIT_MESSAGE || "";
  const author = process.env.VERCEL_GIT_COMMIT_AUTHOR_LOGIN || "";
  const builtAt = process.env.VERCEL_DEPLOYMENT_URL
    ? new Date().toISOString()
    : "local-dev";
  return NextResponse.json({ sha, msg, author, builtAt });
}
