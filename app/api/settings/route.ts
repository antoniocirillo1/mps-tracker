import { NextResponse } from "next/server";
import {
  getTrackerSettings,
  updateTrackerSettings,
} from "@/lib/settings";

export async function GET() {
  try {
    return NextResponse.json(await getTrackerSettings());
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { ok: false, error: "Unable to load settings" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const settings = await updateTrackerSettings(body);

    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { ok: false, error: "Unable to save settings" },
      { status: 400 }
    );
  }
}
