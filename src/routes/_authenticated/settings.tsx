import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, ShieldCheck, Lock, Mail } from "lucide-react";
import { toast } from "sonner";

import { CropCard, Eyebrow, PageHeader } from "@/components/blueprint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { LENGTHS, type LengthId } from "@/lib/proposal-constants";
import { getProfile, updateProfile } from "@/lib/profile.functions";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: () => getProfile(),
  });

  const profile = data?.profile;
  const isAdmin = data?.isAdmin ?? false;

  const [name, setName] = useState("");
  const [defaultLength, setDefaultLength] = useState<LengthId>("robust");
  const [defaultPlan, setDefaultPlan] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name ?? "");
      setDefaultLength((profile.default_length as LengthId) ?? "robust");
      setDefaultPlan(profile.default_plan ?? false);
    }
  }, [profile]);

  const save = useMutation({
    mutationFn: () =>
      updateProfile({
        data: { name, default_length: defaultLength, default_plan: defaultPlan },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Settings saved");
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
        title="Settings"
        description="Your profile and default preferences for new proposals."
      />

      <div className="space-y-5">
        {/* Profile */}
        <CropCard className="p-6">
          <Eyebrow index="01">profile</Eyebrow>
          <div className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Display name</Label>
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
          </div>
        </CropCard>

        {/* Defaults */}
        <CropCard className="p-6">
          <Eyebrow index="02">proposal defaults</Eyebrow>
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

        {/* Password placeholder */}
        <CropCard className="p-6">
          <Eyebrow index="03">security</Eyebrow>
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
