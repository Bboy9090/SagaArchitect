import { createHash } from 'node:crypto';

const PLACEHOLDER = /(?:example|placeholder|changeme|replace[-_ ]?me|your[-_ ]?(?:token|key|secret|password)|dummy|fake|sample|<[^>]+>|\*{3,}|x{6,})/i;

const DETECTORS = [
  {
    category: 'postgres-url-with-password',
    pattern: /\bpostgres(?:ql)?:\/\/[^\s:@/]+:([^\s@/]+)@[^\s'"`]+/gi,
  },
  {
    category: 'openai-api-key',
    pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}\b/g,
  },
  {
    category: 'github-token',
    pattern: /\bgh(?:p|o|u|s|r)_[A-Za-z0-9]{20,}\b/g,
  },
  {
    category: 'jwt-like-token',
    pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
  },
  {
    category: 'assigned-secret-value',
    pattern: /\b(?:password|passwd|secret|token|api[_-]?key|service[_-]?role[_-]?key)\s*[:=]\s*["']?([^\s"'#;,]{12,})/gi,
  },
];

export function fingerprintSecret(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

export function scanTextForSecretFingerprints(text) {
  const findings = [];
  const seen = new Set();

  for (const detector of DETECTORS) {
    detector.pattern.lastIndex = 0;
    let match;
    while ((match = detector.pattern.exec(text)) !== null) {
      const matchedValue = match[0];
      const candidateValue = match[1] || matchedValue;
      if (PLACEHOLDER.test(candidateValue)) continue;
      const fingerprint = fingerprintSecret(matchedValue);
      const key = `${detector.category}:${fingerprint}`;
      if (seen.has(key)) continue;
      seen.add(key);
      findings.push({
        category: detector.category,
        fingerprint,
      });
    }
  }

  return findings.sort((left, right) =>
    left.category.localeCompare(right.category)
    || left.fingerprint.localeCompare(right.fingerprint)
  );
}

export function buildHistoryAuditReport({ objects, currentTree = new Set(), generatedAt = new Date().toISOString() }) {
  const findings = [];
  const uniqueFingerprints = new Set();

  for (const object of objects) {
    for (const finding of object.findings || []) {
      const currentTreeKey = `${object.sha}\0${object.path || ''}`;
      findings.push({
        category: finding.category,
        fingerprint: finding.fingerprint,
        blobSha: object.sha,
        path: object.path || null,
        currentTree: currentTree.has(currentTreeKey),
      });
      uniqueFingerprints.add(finding.fingerprint);
    }
  }

  findings.sort((left, right) =>
    Number(right.currentTree) - Number(left.currentTree)
    || String(left.path).localeCompare(String(right.path))
    || left.category.localeCompare(right.category)
    || left.fingerprint.localeCompare(right.fingerprint)
  );

  const currentTreeFindings = findings.filter((finding) => finding.currentTree).length;
  const historicalOnlyFindings = findings.length - currentTreeFindings;

  return {
    format: 'phoenix-creator-studio.git-history-secret-audit',
    version: 1,
    generatedAt,
    secretValuesIncluded: false,
    findingCount: findings.length,
    uniqueFingerprintCount: uniqueFingerprints.size,
    currentTreeFindings,
    historicalOnlyFindings,
    currentTreeClean: currentTreeFindings === 0,
    historyClean: historicalOnlyFindings === 0,
    reviewRequired: findings.length > 0,
    findings,
  };
}
