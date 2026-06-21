// v1 — voice profile injection helpers
// Used to inject the user's writing style into proposal generation prompts.

export function buildVoiceProfileBlock(voiceProfile: Record<string, unknown> | null | undefined): string {
  if (!voiceProfile || Object.keys(voiceProfile).length === 0) return "";
  return `\n- VOICE PROFILE (match this writing style): ${JSON.stringify(voiceProfile)}`;
}
