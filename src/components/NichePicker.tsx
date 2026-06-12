import { useState } from "react";
import { Check, Plus, Search } from "lucide-react";
import { POPULAR_NICHES } from "@/lib/niches";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function NichePicker({
  selected,
  max = 10,
  onAdd,
}: {
  selected: string[];
  max?: number;
  onAdd: (niche: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const atMax = selected.length >= max;
  const trimmed = search.trim();
  const existsInList = POPULAR_NICHES.some(
    (n) => n.toLowerCase() === trimmed.toLowerCase(),
  );
  const alreadySelected = (n: string) =>
    selected.some((s) => s.toLowerCase() === n.toLowerCase());

  function handleAdd(niche: string) {
    if (atMax || alreadySelected(niche)) return;
    onAdd(niche);
    setSearch("");
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={atMax}
          className="w-full justify-start border-dashed text-muted-foreground"
        >
          <Search className="mr-1.5 h-3.5 w-3.5" />
          {atMax ? `Maximum ${max} niches reached` : "Search popular niches…"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Search niches…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>
              {trimmed ? (
                <button
                  onClick={() => handleAdd(trimmed)}
                  className="flex w-full items-center gap-2 px-2 py-1.5 text-sm text-gold hover:bg-accent"
                >
                  <Plus className="h-3.5 w-3.5" /> Add "{trimmed}"
                </button>
              ) : (
                "No niche found."
              )}
            </CommandEmpty>
            <CommandGroup>
              {POPULAR_NICHES.map((niche) => {
                const isSel = alreadySelected(niche);
                return (
                  <CommandItem
                    key={niche}
                    value={niche}
                    onSelect={() => handleAdd(niche)}
                    disabled={isSel}
                    className={cn(isSel && "opacity-50")}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        isSel ? "opacity-100 text-gold" : "opacity-0",
                      )}
                    />
                    {niche}
                  </CommandItem>
                );
              })}
              {trimmed && !existsInList && (
                <CommandItem
                  value={`__add_${trimmed}`}
                  onSelect={() => handleAdd(trimmed)}
                  className="text-gold"
                >
                  <Plus className="mr-2 h-4 w-4" /> Add "{trimmed}"
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
