import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Loader2, Sparkles, Trash2, Upload, Wand2, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  enhanceAvatar,
  generateAvatar,
  getAvatarUploadUrl,
} from "@/lib/profile.functions";
import {
  deleteProfileImage,
  listProfileImages,
  saveProfileImage,
  type ProfileImage,
} from "@/lib/profile-images.functions";
import { cn } from "@/lib/utils";

interface Props {
  selectedPath: string | null;
  onSelect: (img: { path: string; url: string } | null) => void;
}

export function ProfileImageGallery({ selectedPath, onSelect }: Props) {
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const imagesQuery = useQuery({
    queryKey: ["profile-images"],
    queryFn: () => listProfileImages(),
  });
  const images = imagesQuery.data ?? [];

  const saveMutation = useMutation({
    mutationFn: (input: { path: string; label?: string }) =>
      saveProfileImage({ data: { storage_path: input.path, label: input.label } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile-images"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteProfileImage({ data: { id } }),
    onMutate: (id) => setBusyId(id),
    onSettled: () => setBusyId(null),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile-images"] });
      toast.success("Image removed");
    },
  });

  async function handleUpload(file: File) {
    if (!file.type.startsWith("image/")) return toast.error("Please pick an image");
    if (file.size > 5 * 1024 * 1024) return toast.error("Image must be under 5 MB");
    const toastId = toast.loading("Uploading…");
    try {
      const profileKey = `gallery-${Date.now()}`;
      const { token, path } = await getAvatarUploadUrl({
        data: {
          fileName: file.name,
          contentType: file.type as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
          profileKey,
        },
      });
      const { error } = await supabase.storage
        .from("avatars")
        .uploadToSignedUrl(path, token, file, { contentType: file.type, upsert: true });
      if (error) throw new Error(error.message);
      await saveMutation.mutateAsync({ path, label: file.name.replace(/\.[^.]+$/, "") });
      toast.success("Added to your gallery", { id: toastId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed", { id: toastId });
    }
  }

  async function handleEnhance(img: ProfileImage) {
    setBusyId(img.id);
    const toastId = toast.loading("Enhancing with AI…");
    try {
      const { path } = await enhanceAvatar({ data: { path: img.storage_path } });
      await saveMutation.mutateAsync({ path, label: `Enhanced · ${img.label ?? "headshot"}` });
      toast.success("Enhanced copy saved to your gallery", { id: toastId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Enhancement failed", { id: toastId });
    } finally {
      setBusyId(null);
    }
  }

  async function handleGenerate() {
    const toastId = toast.loading("Generating AI headshot…");
    try {
      const { path } = await generateAvatar({ data: {} });
      await saveMutation.mutateAsync({ path, label: "AI generated" });
      toast.success("AI headshot saved", { id: toastId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed", { id: toastId });
    }
  }

  function pick(img: ProfileImage) {
    if (img.signed_url) onSelect({ path: img.storage_path, url: img.signed_url });
  }

  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-3">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-white">Profile picture</p>
          <p className="text-[11px] text-muted-foreground">
            Pick a saved headshot, upload, or enhance with AI.
          </p>
        </div>
        <div className="flex gap-1.5">
          <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()} className="h-7 text-[11px]">
            <Upload className="mr-1 h-3 w-3" /> Upload
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleGenerate}
            className="h-7 border-teal/40 text-[11px] text-teal hover:bg-teal/10"
          >
            <Wand2 className="mr-1 h-3 w-3" /> Generate
          </Button>
        </div>
      </div>

      {imagesQuery.isLoading ? (
        <div className="flex items-center justify-center py-4 text-xs text-muted-foreground">
          <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> Loading gallery…
        </div>
      ) : images.length === 0 ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center gap-1.5 rounded-md border border-dashed border-border py-6 text-xs text-muted-foreground hover:border-teal/40 hover:text-teal"
        >
          <Camera className="h-4 w-4" />
          No saved images yet — upload your first headshot
        </button>
      ) : (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
          {images.map((img) => {
            const active = selectedPath === img.storage_path;
            const busy = busyId === img.id;
            return (
              <div key={img.id} className="group relative">
                <button
                  type="button"
                  onClick={() => pick(img)}
                  className={cn(
                    "block aspect-square w-full overflow-hidden rounded-md border-2 transition-all",
                    active
                      ? "border-gold ring-2 ring-gold/40"
                      : "border-border/60 hover:border-teal/50",
                  )}
                  title={img.label ?? "Profile image"}
                >
                  {img.signed_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img.signed_url} alt={img.label ?? "Profile"} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">?</div>
                  )}
                </button>
                {active && (
                  <span className="pointer-events-none absolute right-1 top-1 rounded-full bg-gold p-0.5 text-primary-foreground">
                    <Check className="h-2.5 w-2.5" />
                  </span>
                )}
                <div className="absolute inset-x-1 bottom-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleEnhance(img); }}
                    disabled={busy}
                    className="flex-1 rounded bg-black/70 px-1 py-0.5 text-[9px] font-medium text-gold backdrop-blur hover:bg-black/90"
                    title="Enhance with AI"
                  >
                    {busy ? <Loader2 className="mx-auto h-2.5 w-2.5 animate-spin" /> : <Sparkles className="mx-auto h-2.5 w-2.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(img.id); }}
                    disabled={busy}
                    className="rounded bg-black/70 px-1 py-0.5 text-destructive backdrop-blur hover:bg-black/90"
                    title="Delete"
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedPath && (
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="mt-2 text-[10px] text-muted-foreground underline hover:text-white"
        >
          Clear selection
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleUpload(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
