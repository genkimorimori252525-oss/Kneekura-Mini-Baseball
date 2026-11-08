import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import type { AimDirectionV122, BatterApproachV122 } from './BatterIntentV122';

export type BattingDirectionRequestV149 = Readonly<{ version: 'batting_direction_request_v149';
  sourceId: string; mode: 'AUTO' | AimDirectionV122 }>;
type PersonalDirection = Readonly<{ kind: 'AIMED' | 'REACTIVE'; aim: AimDirectionV122 | null;
  pullAngleDegrees: number | null; fieldAngleDegrees: number | null }>;
type LegacyDirection = Readonly<{ sectorIndex: number; pullAngleDegrees: number; fieldAngleDegrees: number }>;

export function validateBattingDirectionRequestV149(raw: unknown): BattingDirectionRequestV149 {
  const p = cloneInert(raw) as BattingDirectionRequestV149;
  if (!p || typeof p !== 'object' || Array.isArray(p) || Object.keys(p).sort().join('|') !== 'mode|sourceId|version'
    || p.version !== 'batting_direction_request_v149' || typeof p.sourceId !== 'string'
    || !p.sourceId.length || p.sourceId.length > 200 || p.sourceId.trim() !== p.sourceId
    || !['AUTO', 'PULL', 'CENTER', 'OPPOSITE'].includes(p.mode)) throw Error('打つ方向の指示が不正です。');
  return Object.freeze(p);
}

/** The request is temporary. Unknown personal preferences stay unknown;
 * AUTO without an authored prior means reactive observation, not a lottery.
 * Only the movement target is returned. Contact physics owns the actual spray. */
export function resolveBattingDirectionRequestV149(input: Readonly<{ request: BattingDirectionRequestV149;
  bats: 'R' | 'L'; selectedAtTick: number; personalDirection?: PersonalDirection;
  legacyDirection?: LegacyDirection | null; targetPullAnglesDegrees?: BatterApproachV122['targetPullAnglesDegrees'] }>) {
  const request = validateBattingDirectionRequestV149(input.request);
  if (!['R', 'L'].includes(input.bats) || !Number.isSafeInteger(input.selectedAtTick) || input.selectedAtTick < 0)
    throw Error('打つ方向の判断時刻・打席が不正です。');
  let owner: 'TEMPORARY_REQUEST' | 'PERSONAL_APPROACH' | 'LEGACY_DIRECTION_DISTRIBUTION' | 'OBSERVATION_RESPONSE',
    reason: string, targetBasis: 'AUTHORED_DIRECTION_TARGET' | 'DEFAULT_OPERATION_TARGET_NOT_MEASURED' | null = null;
  let direction: Readonly<{ kind: 'AIMED' | 'REACTIVE' | 'LEGACY_SECTOR'; aim: AimDirectionV122 | null;
    pullAngleDegrees: number | null; fieldAngleDegrees: number | null }>;
  if (request.mode !== 'AUTO') {
    owner = 'TEMPORARY_REQUEST'; reason = 'ONE_PITCH_DIRECTION_INSTRUCTION';
    // Operation defaults, never inferred personality, measured skill or exit angle.
    const defaults = { pull: 20, center: 0, opposite: -20 },
      key = ({ PULL: 'pull', CENTER: 'center', OPPOSITE: 'opposite' } as const)[request.mode],
      angle = (input.targetPullAnglesDegrees ?? defaults)[key];
    targetBasis = input.targetPullAnglesDegrees ? 'AUTHORED_DIRECTION_TARGET' : 'DEFAULT_OPERATION_TARGET_NOT_MEASURED';
    direction = { kind: 'AIMED', aim: request.mode, pullAngleDegrees: angle, fieldAngleDegrees: -angle * (input.bats === 'R' ? 1 : -1) };
  } else if (input.personalDirection) {
    owner = 'PERSONAL_APPROACH'; reason = 'AUTHORED_DIRECTION_PREFERENCE_RETAINED'; direction = { ...input.personalDirection };
  } else if (input.legacyDirection) {
    owner = 'LEGACY_DIRECTION_DISTRIBUTION'; reason = 'AUTHORED_FIVE_SECTOR_PRIOR_RETAINED';
    direction = { kind: 'LEGACY_SECTOR', aim: null, pullAngleDegrees: input.legacyDirection.pullAngleDegrees,
      fieldAngleDegrees: input.legacyDirection.fieldAngleDegrees };
  } else {
    owner = 'OBSERVATION_RESPONSE'; reason = 'NO_AUTHORED_DIRECTION_PREFERENCE';
    direction = { kind: 'REACTIVE', aim: null, pullAngleDegrees: null, fieldAngleDegrees: null };
  }
  return Object.freeze({ version: 'batting_direction_resolution_v149' as const, requestSourceId: request.sourceId, mode: request.mode,
    selectedAtTick: input.selectedAtTick, owner, reason, targetBasis, direction: Object.freeze(direction),
    persistentPreferenceChanged: false as const, opponentPrivateStateUsed: false as const, postContactResultOverride: false as const });
}
