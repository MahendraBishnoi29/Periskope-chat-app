/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const supabase = createRouteHandlerClient({ cookies });

    // Check if user is authenticated
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Convert file to buffer
    const buffer = await file.arrayBuffer();

    // Generate a unique file name
    const fileName = `${Date.now()}_${file.name}`;
    const filePath = `attachments/${fileName}`;

    // Upload file to Supabase Storage
    const { data, error } = await supabase.storage
      .from("chat-attachments")
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      console.error("Error uploading file:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("chat-attachments").getPublicUrl(filePath);

    return NextResponse.json({
      success: true,
      filePath,
      publicUrl,
      name: file.name,
      type: file.type,
      size: file.size,
    });
  } catch (error: any) {
    console.error("Error in upload route:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
