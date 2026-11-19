import '../entities/campaign_entities.dart';

abstract class CampaignRepository {
  /// Fetches briefs created by the authenticated brand (E01)
  Future<List<CampaignBrief>> getBrandBriefs({String? status});

  /// Queries all published briefs for creators/professionals (E07 feed)
  Future<List<CampaignBrief>> getDiscoverBriefs({String? category, String? query});

  /// Fetches a single brief's full details (E07)
  Future<CampaignBrief?> getBriefDetail(String id);

  /// Creates a new brief as draft or published (E02-E05)
  Future<CampaignBrief> createBrief(CampaignBrief brief, {bool publishImmediately = false});

  /// Publishes an existing draft brief
  Future<bool> publishBrief(String id);

  /// Fetches applicants for a brand's brief (E06)
  Future<List<ApplicationItem>> getBriefApplicants(String briefId, {String? status});

  /// Fetches applications submitted by the authenticated creator (E10)
  Future<List<ApplicationItem>> getMyApplications({String? status});

  /// Fetches single application pitch & status detail (E11)
  Future<ApplicationItem?> getApplicationDetail(String id);

  /// Submits an application/pitch for a brief (E08)
  Future<bool> submitApplication({
    required String briefId,
    required int proposedRate,
    required String coverLetter,
    required int estimatedDays,
    List<String> portfolioLinks = const [],
  });

  /// Updates an applicant's status: SHORTLISTED, REJECTED, etc. (E06)
  Future<bool> updateApplicantStatus(
    String applicationId,
    ApplicationStatus status, {
    String? rejectionReason,
  });

  /// Accepts an applicant, creates project, and locks brief (E14)
  Future<bool> acceptApplication(
    String briefId,
    String applicationId, {
    required int finalRate,
    List<MilestoneItem> milestones = const [],
  });

  /// Withdraws a pending pitch by the creator (E11, POP-E01)
  Future<bool> withdrawApplication(String applicationId);

  /// Toggles saving/bookmarking a brief locally & in cache (E12)
  Future<bool> toggleBookmarkBrief(String briefId);

  /// Returns list of bookmarked brief IDs
  Future<List<String>> getSavedBriefIds();

  /// Returns full brief objects for all bookmarked briefs (E12)
  Future<List<CampaignBrief>> getSavedBriefs();
}
