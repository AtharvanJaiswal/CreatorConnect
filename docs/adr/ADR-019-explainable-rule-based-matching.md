# ADR-019: Explainable Rule-Based Candidate Matching & Recommendation Architecture

## Status

Approved

## Context

Brands need to match with creators and crew who possess the required skills, budget compatibility, verified social metrics, and availability. Deploying black-box machine learning or deep neural network recommenders on Day 1 is opaque, prone to hallucination, difficult to debug, and requires massive training datasets that do not exist for a greenfield platform.

## Decision

Implement a **Deterministic, Explainable Rule-Based Matcher** decoupled behind a **Matching Provider Port**:

1. **Interface Definition**:
   ```typescript
   export interface MatchingProvider {
     calculateMatchScore(candidate: CandidateProfile, criteria: CampaignCriteria): MatchResult;
     rankCandidates(campaignId: string): Promise<RankedCandidate[]>;
   }
   ```
2. **Deterministic Scoring Dimensions**:
   The match score (0 to 100) is computed as a weighted sum of explainable vectors:
   - **Skill Overlap (30%)**: Intersection of required skills vs. candidate verified skills.
   - **Budget / Rate Compatibility (25%)**: Candidate rate card alignment with campaign budget bounds.
   - **Audience & Genre Fit (20%)**: Primary category and target demographic alignment.
   - **Verification & Platform Reputation (15%)**: Trust badge, past project review score, completion rate.
   - **Response Velocity & Availability (10%)**: Average reply time and active calendar availability.
3. **Transparent Reason Codes**: Recommendations explicitly expose _why_ a candidate was recommended (e.g., `["EXACT_SKILL_MATCH: DaVinci Resolve", "BUDGET_ALIGNED", "TOP_RATED_EDITOR"]`).

## Alternatives Evaluated

- **Deep Learning / Black-Box AI Embeddings on Day 1**: Rejected because black-box recommendations cannot explain why a candidate was ranked #1 vs #10, making dispute resolution and fairness audits impossible.
- **Manual Unsorted Discovery**: Rejected because brands become overwhelmed by hundreds of unqualified applicant proposals.

## Consequences

- **Positive**: 100% explainable, auditable, and deterministic; zero cold-start training requirements; instant compute time (< 5ms per candidate evaluation).
- **Negative**: Lacks natural-language semantic nuance (e.g., matching "cinematic moody lighting" with "dark aesthetic reel" requires explicit keyword tagging).

## Security Impact

Guarantees algorithmic fairness and eliminates hidden algorithmic bias by exposing transparent, deterministic scoring criteria.

## Performance Impact

In-memory math execution; 50 candidates ranked in < 15ms.

## Migration Implications

In Phase 15, an `AIMatcher` implementing the exact same `MatchingProvider` interface can introduce vector embeddings (`pgvector` / OpenAI / Gemini) to augment rule-based scores with semantic understanding.
