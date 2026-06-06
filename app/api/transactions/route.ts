import { NextResponse } from "next/server";

let memory: any[] = [];

export async function POST(req: Request) {
  const body = await req.json();

  memory.push({
    ...body,
    createdAt: new Date().toISOString(),
  });

  console.log("NEW TRANSACTION:", body);

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json(memory);
}