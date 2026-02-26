import { NextResponse } from "next/server";

type CloudStore = {
  notes: unknown[];
  updatedAt: number;
};

declare global {
  var __softStudyCloudStore: CloudStore | undefined;
}

const getStore = () => {
  if (!globalThis.__softStudyCloudStore) {
    globalThis.__softStudyCloudStore = {
      notes: [],
      updatedAt: Date.now(),
    };
  }
  return globalThis.__softStudyCloudStore;
};

export async function GET() {
  const store = getStore();
  return NextResponse.json(store);
}

export async function PUT(request: Request) {
  const body = (await request.json()) as { notes?: unknown[] };
  if (!Array.isArray(body.notes)) {
    return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
  }

  const nextStore: CloudStore = {
    notes: body.notes,
    updatedAt: Date.now(),
  };

  globalThis.__softStudyCloudStore = nextStore;
  return NextResponse.json(nextStore);
}
