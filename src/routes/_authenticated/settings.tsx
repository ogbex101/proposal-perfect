import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  Save,
  ShieldCheck,
  Lock,
  Mail,
  Plus,
  X,
  GraduationCap,
  Briefcase,
  Zap,
  Users,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { CropCard, Eyebrow, PageHeader } from "@/components/blueprint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { LENGTHS, type LengthId } from "@/lib/proposal-constants";
import { getProfile, updateProfile, type Credential } from "@/lib/profile.functions";
import { AvatarUploader } from "@/components/AvatarUploader";
import { CustomHooksPanel, CustomStrategiesPanel } from "@/components/CustomHooksStrategies";
import { listSubProfiles, upsertSubProfile, deleteSubProfile, type SubProfile } from "@/lib/sub-profile.functions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog as SubDialog,
  DialogContent as SubDialogContent,
  DialogHeader as SubDialogHeader,
  DialogTitle as SubDialogTitle,
  DialogFooter as SubDialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useActiveProfile } from "@/hooks/use-active-profile";


export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

// ─── Small helpers ────────────────────────────────────────────────────────────

function TagList({
  label,
  items,
  placeholder,
  onChange,
}: {
  label: string;
  items: string[];
  placeholder: string;
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function add() {
    const v = draft.trim();
    if (!v || items.includes(v)) return;
    onChange([...items, v]);
    setDraft("");
    inputRef.current?.focus();
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          placeholder={placeholder}
          className="flex-1"
        />
        <Button variant="outline" size="sm" onClick={add} disabled={!draft.trim()}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <span
              key={item}
              className="flex items-center gap-1.5 rounded-full border border-line/60 bg-sidebar px-2.5 py-0.5 text-xs text-white"
            >
              {item}
              <button
                onClick={() => onChange(items.filter((i) => i !== item))}
                className="text-muted-foreground hover:text-destructive"
                aria-label={`Remove ${item}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function CredentialList({
  credentials,
  onChange,
}: {
  credentials: Credential[];
  onChange: (next: Credential[]) => void;
}) {
  function addRow() {
    onChange([...credentials, { title: "", institution: "", year: "" }]);
  }
  function remove(i: number) {
    onChange(credentials.filter((_, idx) => idx !== i));
  }
  function update(i: number, field: keyof Credential, value: string) {
    onChange(credentials.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)));
  }

  return (
    <div className="space-y-2">
      <Label>Credentials</Label>
      {credentials.map((c, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_80px_32px] gap-2 items-center">
          <Input
            value={c.title}
            onChange={(e) => update(i, "title", e.target.value)}
            placeholder="e.g. BSc Engineering"
          />
          <Input
            value={c.institution}
            onChange={(e) => update(i, "institution", e.target.value)}
            placeholder="University / Institute"
          />
          <Input
            value={c.year}
            onChange={(e) => update(i, "year", e.target.value)}
            placeholder="Year"
            maxLength={10}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={() => remove(i)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={addRow}
        className="w-full border-dashed"
      >
        <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Credential
      </Button>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function SettingsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: () => getProfile(),
  });

  const profile = data?.profile;
  const isAdmin = data?.isAdmin ?? false;
  const avatarSignedUrl = data?.avatarSignedUrl ?? null;

  // ── Form state ──
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [bio, setBio] = useState("");
  const [myStory, setMyStory] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [defaultLength, setDefaultLength] = useState<LengthId>("robust");
  const [defaultPlan, setDefaultPlan] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setName(profile.name ?? "");
    setPhone(profile.phone ?? "");
    setWhatsapp(profile.whatsapp ?? "");
    setBio(profile.bio ?? "");
    setMyStory(profile.my_story ?? "");
    setSkills(profile.skills ?? []);
    setCredentials((profile.credentials as Credential[]) ?? []);
    setBrands(profile.brands_worked ?? []);
    setAvatarUrl(profile.avatar_url ?? null);
    setDefaultLength((profile.default_length as LengthId) ?? "robust");
    setDefaultPlan(profile.default_plan ?? false);
  }, [profile]);

  const save = useMutation({
    mutationFn: () =>
      updateProfile({
        data: {
          name,
          phone,
          whatsapp,
          bio,
          my_story: myStory,
          skills,
          credentials,
          brands_worked: brands,
          avatar_url: avatarUrl,
          default_length: defaultLength,
          default_plan: defaultPlan,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Profile saved");
    },
    onError: (e: Error) => toast.error(e.message || "Could not save"),
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading settings…
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <PageHeader
        eyebrow="Configuration"
        title="Profile & Settings"
        description="Your professional identity and default preferences."
      />

      <div className="space-y-5">
        {/* ── 01 · Avatar ── */}
        <CropCard className="p-6">
          <Eyebrow index="01">profile picture</Eyebrow>
          <div className="mt-6">
            <AvatarUploader
              currentUrl={avatarSignedUrl}
              userName={name || profile?.email}
              bio={bio}
              onUploadComplete={(path) => setAvatarUrl(path)}
              onClear={() => setAvatarUrl(null)}
            />
          </div>
        </CropCard>


        {/* ── 03 · Basic info ── */}
        <CropCard className="p-6">
          <Eyebrow index="03">basic info</Eyebrow>
          <div className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" /> Email
                </Label>
                <Input value={profile?.email ?? ""} disabled className="opacity-70" />
                {isAdmin && (
                  <p className="annotation flex items-center gap-1.5 !text-gold">
                    <ShieldCheck className="h-3 w-3" /> Admin account
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone number</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+234 800 000 0000"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="whatsapp">WhatsApp number</Label>
                <Input
                  id="whatsapp"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="+234 800 000 0000"
                />
              </div>
            </div>
          </div>
        </CropCard>

        {/* ── 03 · Bio & story ── */}
        <CropCard className="p-6">
          <Eyebrow index="04">bio &amp; story</Eyebrow>
          <div className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Short professional bio (1–3 sentences)"
                rows={3}
                maxLength={1000}
                className="resize-none"
              />
              <p className="annotation text-right text-muted-foreground">
                {bio.length}/1000
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="my-story">My Story</Label>
              <Textarea
                id="my-story"
                value={myStory}
                onChange={(e) => setMyStory(e.target.value)}
                placeholder="Your longer origin story — what drives you, key experiences, why clients should trust you…"
                rows={6}
                maxLength={3000}
                className="resize-none"
              />
              <p className="annotation text-right text-muted-foreground">
                {myStory.length}/3000
              </p>
            </div>
          </div>
        </CropCard>

        {/* ── 04 · Skills ── */}
        <CropCard className="p-6">
          <Eyebrow index="05">
            <Zap className="inline h-3 w-3 mr-1" />
            skills
          </Eyebrow>
          <div className="mt-4">
            <TagList
              label="Add skills"
              items={skills}
              placeholder="e.g. Video Editing, Email Marketing…"
              onChange={setSkills}
            />
          </div>
        </CropCard>

        {/* ── 06 · Credentials ── */}
        <CropCard className="p-6">
          <Eyebrow index="06">
            <GraduationCap className="inline h-3 w-3 mr-1" />
            credentials
          </Eyebrow>
          <div className="mt-4">
            <CredentialList credentials={credentials} onChange={setCredentials} />
          </div>
        </CropCard>

        {/* ── 06 · Brands worked with ── */}
        <CropCard className="p-6">
          <Eyebrow index="06">
            <Briefcase className="inline h-3 w-3 mr-1" />
            brands worked with
          </Eyebrow>
          <div className="mt-4">
            <TagList
              label="Brands"
              items={brands}
              placeholder="e.g. Nike, Shopify, Agency XYZ…"
              onChange={setBrands}
            />
          </div>
        </CropCard>

        {/* ── 07 · Custom Hooks ── */}
        <CropCard className="p-6">
          <Eyebrow index="07">custom hooks</Eyebrow>
          <p className="mt-1 text-xs text-muted-foreground">
            Saved hooks appear as options in the proposal generator.
          </p>
          <div className="mt-4">
            <CustomHooksPanel />
          </div>
        </CropCard>

        {/* ── 08 · Custom Strategies ── */}
        <CropCard className="p-6">
          <Eyebrow index="08">custom strategies</Eyebrow>
          <p className="mt-1 text-xs text-muted-foreground">
            Saved strategies appear as options in the proposal generator.
          </p>
          <div className="mt-4">
            <CustomStrategiesPanel />
          </div>
        </CropCard>

        {/* ── 09 · Proposal defaults ── */}
        <CropCard className="p-6">
          <Eyebrow index="09">proposal defaults</Eyebrow>
          <div className="mt-4 space-y-5">
            <div className="space-y-2">
              <Label>Default length</Label>
              <div className="grid gap-2 sm:grid-cols-3">
                {LENGTHS.map((l) => {
                  const active = defaultLength === l.id;
                  return (
                    <button
                      key={l.id}
                      onClick={() => setDefaultLength(l.id)}
                      className={cn(
                        "rounded-lg border p-3 text-left transition-colors",
                        active
                          ? "border-gold/60 bg-gold/10"
                          : "border-line/60 hover:border-teal/40",
                      )}
                    >
                      <span
                        className={cn(
                          "block text-sm font-medium",
                          active ? "text-gold" : "text-white",
                        )}
                      >
                        {l.name}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {l.id === "brief"
                          ? "< 1500 chars"
                          : l.id === "robust"
                            ? "2000–3000 chars"
                            : "3000–5000 chars"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-line/60 p-3">
              <div>
                <p className="text-sm font-medium text-white">Include execution plan</p>
                <p className="text-xs text-muted-foreground">
                  Pre-enable the plan toggle on new proposals.
                </p>
              </div>
              <Switch checked={defaultPlan} onCheckedChange={setDefaultPlan} />
            </div>
          </div>
        </CropCard>

        {/* ── 10 · Security ── */}
        <CropCard className="p-6">
          <Eyebrow index="10">security</Eyebrow>
          <div className="mt-4 flex items-center justify-between rounded-lg border border-line/60 p-3">
            <div className="flex items-center gap-3">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-white">Password</p>
                <p className="text-xs text-muted-foreground">
                  Password changes arrive in a later phase.
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" disabled>
              Change
            </Button>
          </div>
        </CropCard>

        {/* ── 11 · Sub Profiles ── */}
        <CropCard className="p-6">
          <Eyebrow index="11">
            <Users className="inline h-3 w-3 mr-1" />
            sub profiles
          </Eyebrow>
          <p className="mt-1 text-xs text-muted-foreground">
            Create up to 9 additional personas. Each inherits from your head profile for any field left blank.
          </p>
          <div className="mt-4">
            <SubProfilesPanel />
          </div>
        </CropCard>

        {/* ── Save bar ── */}
        <div className="flex justify-end">
          <Button
            className="bg-gold text-primary-foreground hover:bg-gold-bright"
            disabled={save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-4 w-4" />
            )}
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}
