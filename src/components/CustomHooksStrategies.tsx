import { useState } from "react";
import { Loader2, Plus, Pencil, Trash2, Save, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  listCustomHooks,
  listCustomStrategies,
  upsertCustomHook,
  deleteCustomHook,
  upsertCustomStrategy,
  deleteCustomStrategy,
  type CustomHook,
  type CustomStrategy,
} from "@/lib/profile.functions";

// ─── Generic item editor ──────────────────────────────────────────────────────

type Item = { id: string; name: string; content: string };

function ItemForm({
  item,
  onSave,
  onCancel,
  saving,
}: {
  item: Partial<Item>;
  onSave: (name: string, content: string) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState(item.name ?? "");
  const [content, setContent] = useState(item.content ?? "");

  return (
    <div className="space-y-3 rounded-lg border border-gold/30 bg-gold/5 p-4">
      <div className="space-y-1.5">
        <Label htmlFor="item-name">Name</Label>
        <Input
          id="item-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. My Custom Hook"
          maxLength={120}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="item-content">Content / Description</Label>
        <Textarea
          id="item-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Describe how this hook/strategy works, or paste its template text…"
          rows={4}
          maxLength={2000}
          className="resize-none"
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
          <X className="mr-1 h-3.5 w-3.5" /> Cancel
        </Button>
        <Button
          size="sm"
          className="bg-gold text-primary-foreground hover:bg-gold-bright"
          onClick={() => onSave(name.trim(), content.trim())}
          disabled={!name.trim() || !content.trim() || saving}
        >
          {saving ? (
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="mr-1 h-3.5 w-3.5" />
          )}
          Save
        </Button>
      </div>
    </div>
  );
}

function ItemCard({
  item,
  onEdit,
  onDelete,
  deleting,
}: {
  item: Item;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-line/60 p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-white">{item.name}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground line-clamp-2">
          {item.content}
        </p>
      </div>
      <div className="flex shrink-0 gap-1">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={onDelete}
          disabled={deleting}
        >
          {deleting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
    </div>
  );
}

// ─── Custom Hooks panel ───────────────────────────────────────────────────────

export function CustomHooksPanel() {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: hooks = [], isLoading } = useQuery({
    queryKey: ["custom-hooks"],
    queryFn: () => listCustomHooks(),
  });

  const upsert = useMutation({
    mutationFn: (vars: { id?: string; name: string; content: string }) =>
      upsertCustomHook({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custom-hooks"] });
      setEditingId(null);
      toast.success("Hook saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteCustomHook({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custom-hooks"] });
      toast.success("Hook deleted");
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setDeletingId(null),
  });

  const editing = hooks.find((h) => h.id === editingId);

  return (
    <div className="space-y-3">
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading hooks…
        </div>
      ) : hooks.length === 0 && editingId !== "new" ? (
        <p className="text-sm text-muted-foreground">No custom hooks yet.</p>
      ) : null}

      {hooks.map((h: CustomHook) =>
        editingId === h.id ? (
          <ItemForm
            key={h.id}
            item={h}
            saving={upsert.isPending}
            onSave={(name, content) => upsert.mutate({ id: h.id, name, content })}
            onCancel={() => setEditingId(null)}
          />
        ) : (
          <ItemCard
            key={h.id}
            item={h}
            onEdit={() => setEditingId(h.id)}
            onDelete={() => {
              setDeletingId(h.id);
              remove.mutate(h.id);
            }}
            deleting={deletingId === h.id && remove.isPending}
          />
        ),
      )}

      {editingId === "new" && (
        <ItemForm
          item={{}}
          saving={upsert.isPending}
          onSave={(name, content) => upsert.mutate({ name, content })}
          onCancel={() => setEditingId(null)}
        />
      )}

      {editingId !== "new" && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setEditingId("new")}
          className="w-full border-dashed"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Custom Hook
        </Button>
      )}
    </div>
  );
}

// ─── Custom Strategies panel ──────────────────────────────────────────────────

export function CustomStrategiesPanel() {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: strategies = [], isLoading } = useQuery({
    queryKey: ["custom-strategies"],
    queryFn: () => listCustomStrategies(),
  });

  const upsert = useMutation({
    mutationFn: (vars: { id?: string; name: string; content: string }) =>
      upsertCustomStrategy({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custom-strategies"] });
      setEditingId(null);
      toast.success("Strategy saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteCustomStrategy({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custom-strategies"] });
      toast.success("Strategy deleted");
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setDeletingId(null),
  });

  const editing = strategies.find((s: CustomStrategy) => s.id === editingId);

  return (
    <div className="space-y-3">
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading strategies…
        </div>
      ) : strategies.length === 0 && editingId !== "new" ? (
        <p className="text-sm text-muted-foreground">No custom strategies yet.</p>
      ) : null}

      {strategies.map((s: CustomStrategy) =>
        editingId === s.id ? (
          <ItemForm
            key={s.id}
            item={s}
            saving={upsert.isPending}
            onSave={(name, content) => upsert.mutate({ id: s.id, name, content })}
            onCancel={() => setEditingId(null)}
          />
        ) : (
          <ItemCard
            key={s.id}
            item={s}
            onEdit={() => setEditingId(s.id)}
            onDelete={() => {
              setDeletingId(s.id);
              remove.mutate(s.id);
            }}
            deleting={deletingId === s.id && remove.isPending}
          />
        ),
      )}

      {editingId === "new" && (
        <ItemForm
          item={{}}
          saving={upsert.isPending}
          onSave={(name, content) => upsert.mutate({ name, content })}
          onCancel={() => setEditingId(null)}
        />
      )}

      {editingId !== "new" && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setEditingId("new")}
          className="w-full border-dashed"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Custom Strategy
        </Button>
      )}
    </div>
  );
}
