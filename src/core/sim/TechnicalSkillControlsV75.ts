/** Versioned local technique execution inputs. Names are not extra rating buffs. */
export const TECHNICAL_SKILL_IDS_V75 = ['baserunning', 'bunting', 'advanced_fielding', 'bat_to_run_transition', 'slow_ball_charge', 'low_zone_command'] as const;
export const TECHNICAL_SKILL_IDS_V77 = [...TECHNICAL_SKILL_IDS_V75, 'inside_command', 'high_zone_hitting', 'low_zone_hitting', 'pitcher_field_reaction'] as const;
/** Connected 2026-11-02. They sit outside V77 so its catalog and migrations stay exact. */
export const TECHNICAL_SKILL_IDS_CONNECTED_V1 = ['inside_zone_hitting', 'outside_zone_hitting', 'fastball_recognition', 'breaking_ball_recognition',
  'opposite_field_technique', 'pull_side_transfer', 'multi_direction_contact', 'pitch_platoon_left', 'diagonal_command', 'dangerous_miss',
  'release_miss_pattern', 'early_count_approach', 'walk_prone_approach', 'pitch_strong_batter_response'] as const;
export const SIGNED_TECHNICAL_SKILL_IDS_V1: readonly string[] = ['baserunning', 'pitch_platoon_left', 'dangerous_miss', 'early_count_approach'];
export type TechnicalSkillIdV75 = typeof TECHNICAL_SKILL_IDS_V77[number];
export type TechnicalSkillControlsV75 = Readonly<Partial<Record<TechnicalSkillIdV75 | typeof TECHNICAL_SKILL_IDS_CONNECTED_V1[number], number>>>;
export function validateTechnicalSkillControlsV75(raw: unknown): TechnicalSkillControlsV75 {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('technical skills: object required');
  for (const [key, value] of Object.entries(raw)) if (!([...TECHNICAL_SKILL_IDS_V77, ...TECHNICAL_SKILL_IDS_CONNECTED_V1] as readonly string[]).includes(key)
    || typeof value !== 'number' || !Number.isFinite(value) || value < -2 || value > 2
    || (!SIGNED_TECHNICAL_SKILL_IDS_V1.includes(key) && value < 0)) throw Error('technical skills: invalid execution control');
  return raw as TechnicalSkillControlsV75;
}
const blend = (u: number) => { const t = Math.max(0, Math.min(1, u)); return t * t * (3 - 2 * t); };
const FASTBALL_FAMILY: readonly string[] = ['fastball', 'sinker', 'cutter'];
/** How much of a conditional batting technique applies to this swing. Each one acts
 * only in its own condition and only on the swing's position and timing error, the
 * same channel as high/low zone hitting. A hit, spin or exit speed is never named. */
export function resolveLiveContextHitStrengthV1(skills: TechnicalSkillControlsV75 | undefined, input: Readonly<{ bats: 'R' | 'L'; perceivedX: number;
  zoneCenterX?: number; zoneHalfWidth: number; pitchType: string; pullAngleDegrees?: number }>): number {
  if (skills === undefined) return 0;
  const inside = (input.perceivedX - (input.zoneCenterX ?? 0)) * (input.bats === 'R' ? -1 : 1) / input.zoneHalfWidth, pull = input.pullAngleDegrees ?? 0,
    pullWeight = blend((pull - 5) / 15), oppositeWeight = blend((-pull - 5) / 15);
  return (skills.inside_zone_hitting ?? 0) * blend((inside - .2) / .5) + (skills.outside_zone_hitting ?? 0) * blend((-inside - .2) / .5)
    + (FASTBALL_FAMILY.includes(input.pitchType) ? skills.fastball_recognition ?? 0 : skills.breaking_ball_recognition ?? 0)
    + (skills.pull_side_transfer ?? 0) * pullWeight + (skills.opposite_field_technique ?? 0) * oppositeWeight
    + (skills.multi_direction_contact ?? 0) * Math.max(pullWeight, oppositeWeight);
}
