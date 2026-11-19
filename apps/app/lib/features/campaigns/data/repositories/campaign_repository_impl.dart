import '../../domain/entities/campaign_entities.dart';
import '../../domain/repositories/campaign_repository.dart';
import '../datasources/campaign_local_datasource.dart';
import '../datasources/campaign_remote_datasource.dart';

class CampaignRepositoryImpl implements CampaignRepository {
  static CampaignRepositoryImpl? _instance;

  final CampaignRemoteDataSource _remoteDataSource;
  final CampaignLocalDataSource _localDataSource;

  CampaignRepositoryImpl({
    CampaignRemoteDataSource? remoteDataSource,
    CampaignLocalDataSource? localDataSource,
  })  : _remoteDataSource = remoteDataSource ?? CampaignRemoteDataSource(),
        _localDataSource = localDataSource ?? CampaignLocalDataSource();

  static CampaignRepositoryImpl get instance {
    _instance ??= CampaignRepositoryImpl();
    return _instance!;
  }

  static void resetForTesting() {
    _instance = null;
  }

  // ---------------------------------------------------------------------------
  // Briefs / Campaigns
  // ---------------------------------------------------------------------------

  @override
  Future<List<CampaignBrief>> getBrandBriefs({String? status}) async {
    return _remoteDataSource.getAssignments(status: status, forBrand: true);
  }

  @override
  Future<List<CampaignBrief>> getDiscoverBriefs({String? category, String? query}) async {
    final briefs = await _remoteDataSource.getAssignments(
      category: category,
      query: query,
      status: 'PUBLISHED',
    );
    final savedIds = await _localDataSource.getSavedBriefIds();
    return briefs.map((b) => b.copyWith(isBookmarked: savedIds.contains(b.id))).toList();
  }

  @override
  Future<CampaignBrief?> getBriefDetail(String id) async {
    final brief = await _remoteDataSource.getAssignmentDetail(id);
    if (brief != null) {
      final isSaved = await _localDataSource.isBriefSaved(id);
      return brief.copyWith(isBookmarked: isSaved);
    }
    return null;
  }

  @override
  Future<CampaignBrief> createBrief(CampaignBrief brief, {bool publishImmediately = false}) async {
    final created = await _remoteDataSource.createAssignment(brief, publishImmediately: publishImmediately);
    await _localDataSource.clearDraftBrief();
    return created;
  }

  @override
  Future<bool> publishBrief(String id) async {
    return _remoteDataSource.publishAssignment(id);
  }

  // ---------------------------------------------------------------------------
  // Applications & Applicants
  // ---------------------------------------------------------------------------

  @override
  Future<List<ApplicationItem>> getBriefApplicants(String briefId, {String? status}) async {
    return _remoteDataSource.getBriefApplicants(briefId, status: status);
  }

  @override
  Future<List<ApplicationItem>> getMyApplications({String? status}) async {
    return _remoteDataSource.getMyApplications(status: status);
  }

  @override
  Future<ApplicationItem?> getApplicationDetail(String id) async {
    return _remoteDataSource.getApplicationDetail(id);
  }

  @override
  Future<bool> submitApplication({
    required String briefId,
    required int proposedRate,
    required String coverLetter,
    required int estimatedDays,
    List<String> portfolioLinks = const [],
  }) async {
    return _remoteDataSource.submitApplication(
      briefId: briefId,
      proposedRate: proposedRate,
      coverLetter: coverLetter,
      estimatedDays: estimatedDays,
      portfolioLinks: portfolioLinks,
    );
  }

  @override
  Future<bool> updateApplicantStatus(
    String applicationId,
    ApplicationStatus status, {
    String? rejectionReason,
  }) async {
    return _remoteDataSource.updateApplicantStatus(
      applicationId,
      status,
      rejectionReason: rejectionReason,
    );
  }

  @override
  Future<bool> acceptApplication(
    String briefId,
    String applicationId, {
    required int finalRate,
    List<MilestoneItem> milestones = const [],
  }) async {
    return _remoteDataSource.acceptApplication(
      briefId,
      applicationId,
      finalRate: finalRate,
      milestones: milestones,
    );
  }

  @override
  Future<bool> withdrawApplication(String applicationId) async {
    return _remoteDataSource.withdrawApplication(applicationId);
  }

  // ---------------------------------------------------------------------------
  // Bookmarks / Saved Briefs (E12)
  // ---------------------------------------------------------------------------

  @override
  Future<bool> toggleBookmarkBrief(String briefId) async {
    return _localDataSource.toggleSavedBrief(briefId);
  }

  @override
  Future<List<String>> getSavedBriefIds() async {
    return _localDataSource.getSavedBriefIds();
  }

  @override
  Future<List<CampaignBrief>> getSavedBriefs() async {
    final savedIds = await _localDataSource.getSavedBriefIds();
    final allBriefs = await _remoteDataSource.getAssignments(status: 'PUBLISHED');
    return allBriefs.where((b) => savedIds.contains(b.id)).map((b) => b.copyWith(isBookmarked: true)).toList();
  }
}
