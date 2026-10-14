import { NextResponse } from "next/server";

const disabled = () => NextResponse.json({ error: "Authentication is not part of this local MVP." }, { status: 404 });
export const GET = disabled;
export const POST = disabled;
