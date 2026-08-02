export type RecoveryTier = 'critical' | 'standard' | 'archival';

export interface RecoveryObjective {
  tier: RecoveryTier;
  rpoMinutes: number;
  rtoMinutes: number;
  verificationCadenceDays: number;
  description: string;
}

export interface RecoveryEvidence {
  backupCreatedAt: Date;
  recoveryCompletedInMinutes?: number;
  now?: Date;
}

export interface RecoveryObjectiveAssessment {
  tier: RecoveryTier;
  rpoMet: boolean;
  rtoMet: boolean | null;
  backupAgeMinutes: number;
  target: RecoveryObjective;
  status: 'pass' | 'partial' | 'fail';
}

const OBJECTIVES: Record<RecoveryTier, RecoveryObjective> = {
  critical: {
    tier: 'critical',
    rpoMinutes: 15,
    rtoMinutes: 60,
    verificationCadenceDays: 30,
    description: 'Active production work with frequent backup and monthly restore evidence.',
  },
  standard: {
    tier: 'standard',
    rpoMinutes: 24 * 60,
    rtoMinutes: 8 * 60,
    verificationCadenceDays: 90,
    description: 'Normal creator projects with daily backup and quarterly restore evidence.',
  },
  archival: {
    tier: 'archival',
    rpoMinutes: 7 * 24 * 60,
    rtoMinutes: 72 * 60,
    verificationCadenceDays: 180,
    description: 'Inactive or completed projects with weekly backup and semiannual restore evidence.',
  },
};

export function recoveryObjectiveFor(tier: RecoveryTier): RecoveryObjective {
  return { ...OBJECTIVES[tier] };
}

export function assessRecoveryObjective(
  tier: RecoveryTier,
  evidence: RecoveryEvidence,
): RecoveryObjectiveAssessment {
  const target = recoveryObjectiveFor(tier);
  const now = evidence.now ?? new Date();
  const backupAgeMinutes = Math.max(0, Math.floor((now.getTime() - evidence.backupCreatedAt.getTime()) / 60_000));
  const rpoMet = backupAgeMinutes <= target.rpoMinutes;
  const rtoMet = typeof evidence.recoveryCompletedInMinutes === 'number'
    ? evidence.recoveryCompletedInMinutes <= target.rtoMinutes
    : null;
  const status = !rpoMet || rtoMet === false ? 'fail' : rtoMet === null ? 'partial' : 'pass';

  return { tier, rpoMet, rtoMet, backupAgeMinutes, target, status };
}
