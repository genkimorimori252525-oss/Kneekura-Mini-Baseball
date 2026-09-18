import type {
  DefensiveAlignment,
} from '../sim/strategy/DefensiveAlignment';
import {
  createCanonicalEvidenceFingerprint,
} from './CanonicalEvidenceFingerprint';

export type DefensiveContactClassification =
  | 'out'
  | 'single'
  | 'double'
  | 'triple'
  | 'home_run'
  | 'error'
  | 'fielders_choice';

export type SameContactComparisonContact<
  TEvidence = unknown,
> = Readonly<{
  contactId: string;
  evidence: TEvidence;
}>;

export type SameContactComparisonAlignment = Readonly<{
  alignmentId: string;
  alignment: DefensiveAlignment;
}>;

export type SameContactAlignmentEvaluation = Readonly<{
  classification: DefensiveContactClassification;
  runsAllowed: number;
  extraBasesAllowed: number;
  evidence: unknown;
}>;

export type SameContactAlignmentEvaluator<
  TEvidence = unknown,
> = (
  input: Readonly<{
    contact: SameContactComparisonContact<TEvidence>;
    alignmentId: string;
    alignment: DefensiveAlignment;
  }>,
) => SameContactAlignmentEvaluation;

export type SameContactEvaluationRecord = Readonly<{
  contactId: string;
  classification: DefensiveContactClassification;
  runsAllowed: number;
  extraBasesAllowed: number;
  evidence: unknown;
  evidenceFingerprint: string;
}>;

export type SameContactAggregate = Readonly<{
  contacts: number;
  outs: number;
  singles: number;
  doubles: number;
  triples: number;
  homeRuns: number;
  errors: number;
  fieldersChoices: number;
  hits: number;
  totalBases: number;
  runsAllowed: number;
  extraBasesAllowed: number;
  fieldableBalls: number;
  hitsOnFieldableBalls: number;
  fieldableHitRate: number | null;
}>;

export type SameContactAlignmentResult = Readonly<{
  alignmentId: string;
  alignmentFingerprint: string;
  evaluations: readonly SameContactEvaluationRecord[];
  aggregate: SameContactAggregate;
}>;

export type SameContactAlignmentComparisonResult =
  Readonly<{
    contactsFingerprint: string;
    alignments:
      readonly SameContactAlignmentResult[];
  }>;

export type SameContactAlignmentComparisonInput<
  TEvidence = unknown,
> = Readonly<{
  contacts:
    readonly SameContactComparisonContact<TEvidence>[];
  alignments:
    readonly SameContactComparisonAlignment[];
  evaluator:
    SameContactAlignmentEvaluator<TEvidence>;
}>;

const validateNonNegativeFinite = (
  name: string,
  value: number,
): void => {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(
      `${name} must be finite and non-negative`,
    );
  }
};

const validateInput = <TEvidence>(
  input: SameContactAlignmentComparisonInput<TEvidence>,
): void => {
  if (input.contacts.length === 0) {
    throw new Error(
      'same-contact comparison requires at least one contact',
    );
  }
  if (input.alignments.length === 0) {
    throw new Error(
      'same-contact comparison requires at least one alignment',
    );
  }

  const contactIds = new Set<string>();
  for (const contact of input.contacts) {
    if (contact.contactId.length === 0) {
      throw new Error(
        'contactId must not be empty',
      );
    }
    if (contactIds.has(contact.contactId)) {
      throw new Error(
        'same-contact comparison contactIds must be unique',
      );
    }
    contactIds.add(contact.contactId);

    createCanonicalEvidenceFingerprint(
      contact.evidence,
    );
  }

  const alignmentIds = new Set<string>();
  for (const candidate of input.alignments) {
    if (candidate.alignmentId.length === 0) {
      throw new Error(
        'alignmentId must not be empty',
      );
    }
    if (alignmentIds.has(candidate.alignmentId)) {
      throw new Error(
        'same-contact comparison alignmentIds must be unique',
      );
    }
    alignmentIds.add(candidate.alignmentId);

    createCanonicalEvidenceFingerprint(
      candidate.alignment,
    );
  }
};

const aggregate = (
  evaluations: readonly SameContactEvaluationRecord[],
): SameContactAggregate => {
  const count = (
    classification: DefensiveContactClassification,
  ): number => evaluations.filter(
    (entry) => (
      entry.classification === classification
    ),
  ).length;

  const outs = count('out');
  const singles = count('single');
  const doubles = count('double');
  const triples = count('triple');
  const homeRuns = count('home_run');
  const errors = count('error');
  const fieldersChoices = count('fielders_choice');
  const hits = (
    singles
    + doubles
    + triples
    + homeRuns
  );
  const fieldableBalls = (
    evaluations.length - homeRuns
  );
  const hitsOnFieldableBalls = (
    singles + doubles + triples
  );

  return {
    contacts: evaluations.length,
    outs,
    singles,
    doubles,
    triples,
    homeRuns,
    errors,
    fieldersChoices,
    hits,
    totalBases: (
      singles
      + 2 * doubles
      + 3 * triples
      + 4 * homeRuns
    ),
    runsAllowed: evaluations.reduce(
      (total, entry) => (
        total + entry.runsAllowed
      ),
      0,
    ),
    extraBasesAllowed: evaluations.reduce(
      (total, entry) => (
        total + entry.extraBasesAllowed
      ),
      0,
    ),
    fieldableBalls,
    hitsOnFieldableBalls,
    fieldableHitRate: fieldableBalls === 0
      ? null
      : hitsOnFieldableBalls / fieldableBalls,
  };
};

export const compareSameContactDefensiveAlignments = <
  TEvidence,
>(
  input: SameContactAlignmentComparisonInput<TEvidence>,
): SameContactAlignmentComparisonResult => {
  validateInput(input);

  const contactsFingerprint =
    createCanonicalEvidenceFingerprint(
      input.contacts,
    );

  const alignments = input.alignments.map(
    (candidate) => {
      const alignmentFingerprint =
        createCanonicalEvidenceFingerprint(
          candidate.alignment,
        );

      const evaluations = input.contacts.map(
        (contact) => {
          const contactFingerprintBefore =
            createCanonicalEvidenceFingerprint(
              contact.evidence,
            );
          const alignmentFingerprintBefore =
            createCanonicalEvidenceFingerprint(
              candidate.alignment,
            );

          const result = input.evaluator({
            contact,
            alignmentId:
              candidate.alignmentId,
            alignment: candidate.alignment,
          });

          validateNonNegativeFinite(
            'runsAllowed',
            result.runsAllowed,
          );
          validateNonNegativeFinite(
            'extraBasesAllowed',
            result.extraBasesAllowed,
          );

          const contactFingerprintAfter =
            createCanonicalEvidenceFingerprint(
              contact.evidence,
            );
          if (
            contactFingerprintAfter
            !== contactFingerprintBefore
          ) {
            throw new Error(
              'alignment evaluator must not mutate contact evidence',
            );
          }

          const alignmentFingerprintAfter =
            createCanonicalEvidenceFingerprint(
              candidate.alignment,
            );
          if (
            alignmentFingerprintAfter
            !== alignmentFingerprintBefore
          ) {
            throw new Error(
              'alignment evaluator must not mutate defensive alignment',
            );
          }

          const record:
            SameContactEvaluationRecord = {
              contactId: contact.contactId,
              classification:
                result.classification,
              runsAllowed:
                result.runsAllowed,
              extraBasesAllowed:
                result.extraBasesAllowed,
              evidence: result.evidence,
              evidenceFingerprint:
                createCanonicalEvidenceFingerprint(
                  result.evidence,
                ),
            };

          return record;
        },
      );

      if (
        createCanonicalEvidenceFingerprint(
          input.contacts,
        ) !== contactsFingerprint
      ) {
        throw new Error(
          'alignment evaluator must not mutate contact evidence',
        );
      }

      return {
        alignmentId: candidate.alignmentId,
        alignmentFingerprint,
        evaluations,
        aggregate: aggregate(evaluations),
      };
    },
  );

  return {
    contactsFingerprint,
    alignments,
  };
};
