import { useCallback, useRef, useState } from "react";
import { Camera, Loader2, Sparkles, Upload, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { enhanceAvatar, generateAvatar, getAvatarUploadUrl } from "@/lib/profile.functions";
import { cn } from "@/lib/utils";

interface AvatarUploaderProps {
  currentUrl: string | null | undefined;
  userName?: string | null;
  bio?: string | null;
  onUploadComplete: (publicUrl: string) => void;
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
}: AvatarUploaderProps) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  // Storage path of the current avatar — set on upload, or derived from currentUrl.
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const displayUrl = preview ?? currentUrl;
  const activePath = uploadedPath ?? pathFromPublicUrl(currentUrl);
  const initial = (userName?.trim().charAt(0) ?? "U").toUpperCase();
  const busy = uploading || enhancing || generating;

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (JPG, PNG, WEBP, GIF)");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5 MB");
      return;
    }

    // Local preview immediately
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setUploading(true);

    try {
      // Get signed upload URL from server
      const { signedUrl, token, publicUrl, path } = await getAvatarUploadUrl({
        data: {
          fileName: file.name,
          contentType: file.type as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
        },
      });

      // Upload directly to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .uploadToSignedUrl(signedUrl.split("avatars/")[1] ?? "", token, file, {
          contentType: file.type,
          upsert: true,
        });

      if (uploadError) throw new Error(uploadError.message);

      setUploadedPath(path);
      // Add cache-bust so browser reloads the new image
      setPreview(`${publicUrl}?t=${Date.now()}`);
      onUploadComplete(publicUrl);
      toast.success("Profile picture updated");
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
      // Runs entirely server-side: the server reads your photo from storage,
      // sends it to the AI image model, and saves the enhanced result back.
      const { publicUrl, path } = await enhanceAvatar({ data: { path: activePath } });
      setUploadedPath(path);
      setPreview(`${publicUrl}?t=${Date.now()}`);
      onUploadComplete(publicUrl);
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
      const { publicUrl, path } = await generateAvatar({
        data: { name: userName ?? undefined, bio: bio ?? undefined },
      });
      setUploadedPath(path);
      setPreview(`${publicUrl}?t=${Date.now()}`);
      onUploadComplete(publicUrl);
      toast.success("AI profile picture ready! Save to keep it.", { id: toastId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI generation failed", { id: toastId });
    } finally {
      setGenerating(false);
    }
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
          disabled={busy || !displayUrl}
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
      </div>
    </div>
  );
}
