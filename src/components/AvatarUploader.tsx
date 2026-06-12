import { useCallback, useRef, useState } from "react";
import { Camera, Loader2, Sparkles, Trash2, Upload, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { enhanceAvatar, generateAvatar, getAvatarUploadUrl } from "@/lib/profile.functions";
import { cn } from "@/lib/utils";

interface AvatarUploaderProps {
  currentUrl: string | null | undefined;
  userName?: string | null;
  bio?: string | null;
  onUploadComplete: (path: string) => void;
  /** Called when the user clears / removes the picture */
  onClear?: () => void;
}

// Derive the storage object path ("<uid>/avatar.jpg") from a public avatar URL.
function pathFromPublicUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const marker = "/avatars/";
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length).split("?")[0];
}

export function AvatarUploader({
  currentUrl,
  userName,
  bio,
  onUploadComplete,
  onClear,
}: AvatarUploaderProps) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [generating, setGenerating] = useState(false);
  // Local preview: starts from currentUrl so it persists across sessions without extra fetches
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null);
  // Track if we've cleared so we don't re-hydrate from currentUrl after a clear
  const [cleared, setCleared] = useState(false);
  // Storage path of the current avatar — set on upload, or derived from currentUrl.
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Show the signed URL when no local preview exists (i.e., page reload scenario)
  const displayUrl = cleared ? null : (preview ?? currentUrl);
  const activePath = uploadedPath ?? pathFromPublicUrl(currentUrl);
  const initial = (userName?.trim().charAt(0) ?? "U").toUpperCase();
  const busy = uploading || enhancing || generating;
  const hasImage = !!displayUrl;

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (JPG, PNG, WEBP, GIF)");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5 MB");
      return;
    }

    // Show local preview immediately
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setCleared(false);
    setUploading(true);

    try {
      const { signedUrl, token, path } = await getAvatarUploadUrl({
        data: {
          fileName: file.name,
          contentType: file.type as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
        },
      });

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .uploadToSignedUrl(signedUrl.split("avatars/")[1] ?? "", token, file, {
          contentType: file.type,
          upsert: true,
        });

      if (uploadError) throw new Error(uploadError.message);

      setUploadedPath(path);
      onUploadComplete(path);
      toast.success("Profile picture updated — click Save to keep it.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
      setPreview(null);
    } finally {
      setUploading(false);
    }
  }

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  async function handleEnhance() {
    if (!activePath) {
      toast.error("Upload a profile picture first");
      return;
    }
    setEnhancing(true);
    const toastId = toast.loading("Enhancing your photo with AI…");
    try {
      const { path, previewDataUrl } = await enhanceAvatar({ data: { path: activePath } });
      setUploadedPath(path);
      if (previewDataUrl) setPreview(previewDataUrl);
      setCleared(false);
      onUploadComplete(path);
      toast.success("Professional headshot ready! Save to keep it.", { id: toastId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI enhancement failed", { id: toastId });
    } finally {
      setEnhancing(false);
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    const toastId = toast.loading("Generating an AI profile picture…");
    try {
      const { path, previewDataUrl } = await generateAvatar({
        data: { name: userName ?? undefined, bio: bio ?? undefined },
      });
      setUploadedPath(path);
      if (previewDataUrl) setPreview(previewDataUrl);
      setCleared(false);
      onUploadComplete(path);
      toast.success("AI profile picture ready! Save to keep it.", { id: toastId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI generation failed", { id: toastId });
    } finally {
      setGenerating(false);
    }
  }

  function handleClear() {
    setPreview(null);
    setUploadedPath(null);
    setCleared(true);
    onClear?.();
    toast.info("Profile picture cleared — click Save to apply.");
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Drop zone / preview */}
      <div
        className={cn(
          "relative flex h-32 w-32 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 transition-colors",
          dragging
            ? "border-gold bg-gold/10"
            : "border-line/60 bg-sidebar hover:border-teal/40",
        )}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        title="Click or drag to upload"
      >
        {displayUrl ? (
          <img
            src={displayUrl}
            alt="Profile"
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-4xl font-bold text-muted-foreground">{initial}</span>
        )}

        {/* Overlay on hover / while working */}
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center rounded-full bg-black/50 transition-opacity",
            busy ? "opacity-100" : "opacity-0 hover:opacity-100",
          )}
        >
          {busy ? (
            <Loader2 className="h-8 w-8 animate-spin text-white" />
          ) : (
            <Camera className="h-8 w-8 text-white" />
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
      </div>

      <p className="annotation text-center text-muted-foreground">
        Drag & drop or click to upload · max 5 MB
      </p>

      <div className="flex flex-wrap justify-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          <Upload className="mr-1.5 h-3.5 w-3.5" />
          Upload
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleEnhance}
          disabled={busy || !hasImage}
          className="border-gold/40 text-gold hover:bg-gold/10"
        >
          {enhancing ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
          )}
          Enhance with AI
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleGenerate}
          disabled={busy}
          className="border-teal/40 text-teal hover:bg-teal/10"
        >
          {generating ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Wand2 className="mr-1.5 h-3.5 w-3.5" />
          )}
          Generate AI photo
        </Button>

        {hasImage && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleClear}
            disabled={busy}
            className="border-destructive/40 text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Clear resource
          </Button>
        )}
      </div>
    </div>
  );
}
