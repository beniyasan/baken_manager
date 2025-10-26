import { supabaseClient } from "@/lib/supabaseClient";

const bucket = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "bet-images";

export const uploadBetImage = async (userId: string, file: File, existingPath?: string | null) => {
  if (!bucket) throw new Error("Storage バケット名が設定されていません");

  const ext = file.name.split(".").pop() || "jpg";
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error } = await supabaseClient.storage.from(bucket).upload(path, file, {
    upsert: true,
    cacheControl: "3600",
    contentType: file.type,
  });

  if (error) throw error;

  if (existingPath && existingPath !== path) {
    await removeBetImage(existingPath).catch(() => undefined);
  }

  const { data: publicData } = supabaseClient.storage.from(bucket).getPublicUrl(path);
  return {
    path,
    url: publicData?.publicUrl ?? null,
  };
};

export const removeBetImage = async (path: string | null | undefined) => {
  if (!path) return;
  const { error } = await supabaseClient.storage.from(bucket).remove([path]);
  if (error) throw error;
};
