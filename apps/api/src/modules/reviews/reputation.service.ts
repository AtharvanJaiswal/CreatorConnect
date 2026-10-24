import type {
  ReputationSummaryResponse,
  RatingDistribution,
  CategoryAverages,
} from '@creatorconnect/contracts';
import { roundRatingForDisplay } from '@creatorconnect/utils';
import { ReviewsRepository } from './reviews.repository.js';

export class ReputationService {
  constructor(private repo = new ReviewsRepository()) {}

  /**
   * Platform prior parameters for deterministic Bayesian reputation scoring.
   * Prior mean m = 4.0 (baseline expected rating in the creator economy).
   * Confidence constant C = 5 (effective number of synthetic prior reviews).
   *
   * Formula:
   * S = (C * m + sum(ratings)) / (C + N)
   *
   * Properties:
   * 1. Cold-start safety: users with 0 reviews return null (unrated).
   * 2. Resistance to early manipulation: a single 5-star review yields (20 + 5) / 6 = 4.17 rather than 5.0.
   * 3. Asymptotic convergence: as N grows large, S -> mean(ratings).
   * 4. 100% deterministic, explainable, and rebuildable from raw immutable reviews.
   */
  private static readonly PRIOR_MEAN = 4.0;
  private static readonly PRIOR_WEIGHT = 5.0;

  async getReputationSummary(userId: string): Promise<ReputationSummaryResponse> {
    const raw = await this.repo.aggregateReputation(userId);

    const totalReviews = raw.totalCount;

    if (totalReviews === 0) {
      return {
        userId,
        totalReviews: 0,
        averageRating: null,
        bayesianScore: null,
        ratingDistribution: {
          1: 0,
          2: 0,
          3: 0,
          4: 0,
          5: 0,
        },
        categoryAverages: {
          communication: null,
          quality: null,
          adherence: null,
        },
        completedProjectCount: raw.completedProjectCount ?? 0,
      };
    }

    const averageRating = roundRatingForDisplay(raw.averageRating, 2);
    const sumRatings = (raw.averageRating ?? 0) * totalReviews;
    const bayesianNumerator =
      ReputationService.PRIOR_WEIGHT * ReputationService.PRIOR_MEAN + sumRatings;
    const bayesianDenominator = ReputationService.PRIOR_WEIGHT + totalReviews;
    const bayesianScore = roundRatingForDisplay(bayesianNumerator / bayesianDenominator, 2);

    const ratingDistribution: RatingDistribution = {
      1: raw.distribution[1] ?? 0,
      2: raw.distribution[2] ?? 0,
      3: raw.distribution[3] ?? 0,
      4: raw.distribution[4] ?? 0,
      5: raw.distribution[5] ?? 0,
    };

    const categoryAverages: CategoryAverages = {
      communication: roundRatingForDisplay(raw.communicationAverage, 2),
      quality: roundRatingForDisplay(raw.qualityAverage, 2),
      adherence: roundRatingForDisplay(raw.adherenceAverage, 2),
    };

    return {
      userId,
      totalReviews,
      averageRating,
      bayesianScore,
      ratingDistribution,
      categoryAverages,
      completedProjectCount: raw.completedProjectCount ?? 0,
    };
  }
}
