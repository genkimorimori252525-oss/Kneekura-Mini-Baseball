/** Versioned local technique execution inputs. Names are not extra rating buffs. */
export const TECHNICAL_SKILL_IDS_V75 = ['baserunning', 'bunting', 'advanced_fielding', 'bat_to_run_transition', 'slow_ball_charge', 'low_zone_command'] as const;
export type TechnicalSkillIdV75 = typeof TECHNICAL_SKILL_IDS_V75[number];
export type TechnicalSkillControlsV75 = Readonly<Partial<Record<TechnicalSkillIdV75, number>>>;
export function validateTechnicalSkillControlsV75(raw: unknown): TechnicalSkillControlsV75 {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('technical skills: object required');
  for (const [key, value] of Object.entries(raw)) if (!(TECHNICAL_SKILL_IDS_V75 as readonly string[]).includes(key)
    || typeof value !== 'number' || !Number.isFinite(value) || value < -2 || value > 2
    || (key !== 'baserunning' && value < 0)) throw Error('technical skills: invalid execution control');
  return raw as TechnicalSkillControlsV75;
}
