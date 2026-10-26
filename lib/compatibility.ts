export type CompatibilityProfile = {
  user_id: string;
  compatibility_values: string[] | null;
  compatibility_interests: string[] | null;
  communication_style: string | null;
  connection_pace: string | null;
};

export type CompatibilityResult = {
  score: number;
  sharedValues: string[];
  sharedInterests: string[];
  breakdown: {
    values: number;
    interests: number;
    communication: number;
    pace: number;
  };
  explanation: string;
};

const WEIGHTS = {
  values: 0.4,
  interests: 0.35,
  communication: 0.15,
  pace: 0.1,
} as const;

function normalize(items: string[] | null | undefined): string[] {
  return [
    ...new Set(
      (items ?? [])
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

function overlapScore(
  first: string[] | null | undefined,
  second: string[] | null | undefined,
): number | null {
  const a = normalize(first);
  const b = normalize(second);

  // Missing answers are not treated as incompatibility.
  if (a.length === 0 || b.length === 0) return null;

  const secondSet = new Set(b);
  const firstSet = new Set(a);

  const shared = a.filter((item) => secondSet.has(item)).length;

  // Average the proportion of each person's selections shared
  // with the other person. The result is between 0 and 1.
  const firstCoverage = shared / firstSet.size;
  const secondCoverage = shared / secondSet.size;

  return (firstCoverage + secondCoverage) / 2;
}

function exactMatchScore(
  first: string | null | undefined,
  second: string | null | undefined,
): number | null {
  if (!first || !second) return null;

  return first.trim().toLowerCase() === second.trim().toLowerCase() ? 1 : 0;
}

function percentage(value: number | null): number {
  return value === null ? 0 : Math.round(value * 100);
}

export function calculateCompatibility(
  currentUser: CompatibilityProfile,
  otherUser: CompatibilityProfile,
): CompatibilityResult {
  const sharedValues = normalize(currentUser.compatibility_values).filter(
    (value) => normalize(otherUser.compatibility_values).includes(value),
  );

  const sharedInterests = normalize(currentUser.compatibility_interests).filter(
    (interest) =>
      normalize(otherUser.compatibility_interests).includes(interest),
  );

  const values = overlapScore(
    currentUser.compatibility_values,
    otherUser.compatibility_values,
  );

  const interests = overlapScore(
    currentUser.compatibility_interests,
    otherUser.compatibility_interests,
  );

  const communication = exactMatchScore(
    currentUser.communication_style,
    otherUser.communication_style,
  );

  const pace = exactMatchScore(
    currentUser.connection_pace,
    otherUser.connection_pace,
  );

  const factors: { score: number | null; weight: number }[] = [
  { score: values, weight: WEIGHTS.values },
  { score: interests, weight: WEIGHTS.interests },
  { score: communication, weight: WEIGHTS.communication },
  { score: pace, weight: WEIGHTS.pace },
];

const availableFactors = factors.filter(
  (factor) => factor.score !== null
);

  const availableWeight = factors.reduce(
    (total, factor) => total + factor.weight,
    0,
  );

  const weightedScore =
    availableWeight === 0
      ? 0
      : factors.reduce(
          (total, factor) => total + factor.score * factor.weight,
          0,
        ) / availableWeight;

  const score = Math.round(weightedScore * 100);

  const explanations: string[] = [];

  if (sharedValues.length > 0) {
    explanations.push(
      `${sharedValues.length} shared ${
        sharedValues.length === 1 ? "value" : "values"
      }`,
    );
  }

  if (sharedInterests.length > 0) {
    explanations.push(
      `${sharedInterests.length} shared ${
        sharedInterests.length === 1 ? "interest" : "interests"
      }`,
    );
  }

  if (communication === 1) {
    explanations.push("similar communication preferences");
  }

  if (pace === 1) {
    explanations.push("a similar connection pace");
  }

  return {
    score,
    sharedValues,
    sharedInterests,
    breakdown: {
      values: percentage(values),
      interests: percentage(interests),
      communication: percentage(communication),
      pace: percentage(pace),
    },
    explanation:
      explanations.length > 0
        ? explanations.join(" · ")
        : "Explore each other's preferences to discover common ground.",
  };
}
