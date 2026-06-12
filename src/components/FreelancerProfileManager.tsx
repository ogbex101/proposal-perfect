import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  ChevronDown,
  Edit2,
  Loader2,
  Plus,
  Trash2,
  User,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  createFreelancerProfile,
  deleteFreelancerProfile,
  listFreelancerProfiles,
  switchFreelancerProfile,
  updateFreelancerProfile,
  type FreelancerProfile,
} from "@/lib/freelancer-profiles.functions";

// ─── Profile switcher (compact, for header/sidebar) ──────────────────────────

export function ProfileSwitcher() {
  const qc = useQueryClient();
  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["freelancer-profiles"],
    queryFn: () => listFreelancerProfiles(),
  });

  const active = profiles.find((p) => p.is_active);

  const switchMutation = useMutation({
    mutationFn: (id: string) => switchFreelancerProfile({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["freelancer-profiles"] });
      toast.success("Profile switched");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  if (profiles.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 border-line/60 text-sm">
          <User className="h-3.5 w-3.5 shrink-0" />
          <span className="max-w-[120px] truncate">{active?.label ?? "No profile"}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {profiles.map((p) => (
          <DropdownMenuItem
            key={p.id}
            onSelect={() => !p.is_active && switchMutation.mutate(p.id)}
            className="flex items-center gap-2"
          >
            {p.is_active ? (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-teal" />
            ) : (
              <span className="h-3.5 w-3.5 shrink-0" />
            )}
            <span className="truncate">{p.label}</span>
            {p.is_active && (
              <span className="ml-auto text-[10px] text-teal">active</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Full profile manager (for settings page) ─────────────────────────────────

type FormData = { label: string; name: string; bio: string; skills: string };

const EMPTY_FORM: FormData = { label: "", name: "", bio: "", skills: "" };

export function FreelancerProfileManager() {
  const qc = useQueryClient();
  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["freelancer-profiles"],
    queryFn: () => listFreelancerProfiles(),
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FreelancerProfile | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(p: FreelancerProfile) {
    setEditing(p);
    setForm({
      label: p.label,
      name: p.name ?? "",
      bio: p.bio ?? "",
      skills: (p.skills ?? []).join(", "),
    });
    setDialogOpen(true);
  }

  const createMutation = useMutation({
    mutationFn: () =>
      createFreelancerProfile({
        data: {
          label: form.label,
          name: form.name || null,
          bio: form.bio || null,
          skills: form.skills ? form.skills.split(",").map((s) => s.trim()).filter(Boolean) : [],
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["freelancer-profiles"] });
      toast.success("Profile created");
      setDialogOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      updateFreelancerProfile({
        data: {
          id: editing!.id,
          label: form.label,
          name: form.name || null,
          bio: form.bio || null,
          skills: form.skills ? form.skills.split(",").map((s) => s.trim()).filter(Boolean) : [],
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["freelancer-profiles"] });
      toast.success("Profile updated");
      setDialogOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const switchMutation = useMutation({
    mutationFn: (id: string) => switchFreelancerProfile({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["freelancer-profiles"] });
      toast.success("Active profile switched");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFreelancerProfile({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["freelancer-profiles"] });
      toast.success("Profile deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saving = createMutation.isPending || updateMutation.isPending;
  const canCreate = profiles.length < 10;

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading profiles…
        </div>
      ) : profiles.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No profiles yet. Create one to enable per-proposal profile selection.
        </p>
      ) : (
        <div className="space-y-2">
          {profiles.map((p) => (
            <div
              key={p.id}
              className={cn(
                "flex items-center gap-3 rounded-lg border p-3 transition-colors",
                p.is_active
                  ? "border-teal/40 bg-teal/5"
                  : "border-line/60 bg-background/40",
              )}
            >
              {/* Avatar / initial */}
              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-sidebar border border-line/60">
                {p.avatar_signed_url ? (
                  <img src={p.avatar_signed_url} alt={p.label} className="h-full w-full object-cover" />
                ) : (
                  <User className="h-4 w-4 text-muted-foreground" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white truncate">{p.label}</span>
                  {p.is_active && (
                    <span className="flex items-center gap-1 rounded-full bg-teal/15 px-2 py-0.5 text-[10px] font-medium text-teal">
                      <CheckCircle2 className="h-2.5 w-2.5" /> Active
                    </span>
                  )}
                </div>
                {p.name && <span className="text-xs text-muted-foreground truncate">{p.name}</span>}
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {!p.is_active && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-teal hover:bg-teal/10"
                    onClick={() => switchMutation.mutate(p.id)}
                    disabled={switchMutation.isPending}
                  >
                    Use
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-muted-foreground hover:text-white"
                  onClick={() => openEdit(p)}
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteMutation.mutate(p.id)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={openCreate}
          disabled={!canCreate}
          className="border-dashed"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          New profile
          {!canCreate && <span className="ml-1.5 text-xs text-muted-foreground">(max 10)</span>}
        </Button>
        <span className="text-xs text-muted-foreground">
          {profiles.length}/10 profiles
        </span>
      </div>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              {editing ? "Edit profile" : "Create profile"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="prof-label">Profile label <span className="text-destructive">*</span></Label>
              <Input
                id="prof-label"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="e.g. Web Developer, Copywriter, Video Editor"
              />
              <p className="text-xs text-muted-foreground">This shows in the profile switcher.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prof-name">Display name</Label>
              <Input
                id="prof-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. John Doe"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prof-bio">Bio</Label>
              <Textarea
                id="prof-bio"
                value={form.bio}
                onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                placeholder="Short professional bio for this profile…"
                rows={3}
                maxLength={1000}
                className="resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prof-skills">Skills (comma-separated)</Label>
              <Input
                id="prof-skills"
                value={form.skills}
                onChange={(e) => setForm((f) => ({ ...f, skills: e.target.value }))}
                placeholder="React, Node.js, Copywriting…"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-gold text-primary-foreground hover:bg-gold-bright"
              disabled={!form.label.trim() || saving}
              onClick={() => (editing ? updateMutation.mutate() : createMutation.mutate())}
            >
              {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              {editing ? "Save changes" : "Create profile"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Profile picker dialog (used at proposal send time) ───────────────────────

interface ProfilePickerDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (profile: FreelancerProfile) => void;
  title?: string;
}

export function ProfilePickerDialog({
  open,
  onClose,
  onConfirm,
  title = "Which profile do you want to use for this proposal?",
}: ProfilePickerDialogProps) {
  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["freelancer-profiles"],
    queryFn: () => listFreelancerProfiles(),
  });

  const [selectedId, setSelectedId] = useState<string>(() => {
    return profiles.find((p) => p.is_active)?.id ?? "";
  });

  // Pre-select active profile once loaded
  const active = profiles.find((p) => p.is_active);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" /> Select a profile
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">{title}</p>

        <div className="space-y-2 py-1">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : profiles.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No profiles found. Create one in Settings → Profiles.
            </p>
          ) : (
            profiles.map((p) => {
              const checked = (selectedId || active?.id) === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                    checked
                      ? "border-teal/40 bg-teal/5"
                      : "border-line/60 bg-background/40 hover:border-teal/20",
                  )}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar border border-line/60 overflow-hidden">
                    {p.avatar_signed_url ? (
                      <img src={p.avatar_signed_url} alt={p.label} className="h-full w-full object-cover" />
                    ) : (
                      <User className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-white truncate">{p.label}</span>
                    {p.name && <span className="block text-xs text-muted-foreground truncate">{p.name}</span>}
                  </div>
                  {checked && <CheckCircle2 className="h-4 w-4 shrink-0 text-teal" />}
                </button>
              );
            })
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            className="bg-gold text-primary-foreground hover:bg-gold-bright"
            disabled={!selectedId && !active}
            onClick={() => {
              const chosen = profiles.find((p) => p.id === (selectedId || active?.id));
              if (chosen) onConfirm(chosen);
            }}
          >
            Use this profile
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
