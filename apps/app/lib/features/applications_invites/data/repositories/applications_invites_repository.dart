import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../domain/entities/application_entities.dart';
import '../../domain/entities/invitation_entities.dart';

final applicationsInvitesRepositoryProvider =
    Provider<ApplicationsInvitesRepository>((ref) {
  return MockApplicationsInvitesRepository();
});

abstract class ApplicationsInvitesRepository {
  Future<MonthlyQuotaInfo> getMonthlyQuota();
  Future<bool> checkAlreadyApplied(String assignmentId);
  Future<ApplicationModel> submitApplication({
    required String assignmentId,
    required String assignmentTitle,
    required String brandName,
    required String location,
    required int assignmentBudget,
    required String coverLetter,
    required int proposedRate,
    required int estimatedDays,
    List<PortfolioAttachment> attachments = const [],
  });
  Future<List<ApplicationModel>> getMyApplications();
  Future<ApplicationModel?> getApplicationDetail(String id);
  Future<bool> withdrawApplication(String id);

  Future<InvitationModel> sendDirectInvite({
    required String recipientId,
    required String recipientName,
    required String recipientRole,
    String? recipientAvatarUrl,
    required String projectTitle,
    required InviteType inviteType,
    required int budgetOffered,
    required String message,
    List<String> deliverables = const [],
    int expiresInDays = 7,
  });
  Future<List<InvitationModel>> getReceivedInvites();
  Future<List<InvitationModel>> getSentInvites();
  Future<InvitationModel?> getInviteDetail(String id);
  Future<bool> acceptInvite(String id);
  Future<bool> declineInvite(String id, String? reason);
  Future<bool> cancelInvite(String id);
}

class MockApplicationsInvitesRepository implements ApplicationsInvitesRepository {
  MonthlyQuotaInfo _quota = MonthlyQuotaInfo(
    remaining: 4,
    total: 5,
    resetDate: DateTime.now().add(const Duration(days: 12)),
    isPro: false,
  );

  final List<ApplicationModel> _applications = [
    ApplicationModel(
      id: 'app-001',
      assignmentId: 'asg-101',
      assignmentTitle: 'Summer Festive Lookbook Reels',
      brandName: 'Zara India',
      location: 'Mumbai',
      assignmentBudget: 15000,
      applicantId: 'usr-self',
      coverLetter:
          'Hi Zara team! I specialize in high-energy fashion transitions and color-graded cinematic reels in Mumbai. I have our 4K studio booked for this Thursday and can deliver the first draft within 48 hours with full licensing rights.',
      proposedRate: 15000,
      estimatedDays: 4,
      attachments: const [
        PortfolioAttachment(
          id: 'att-1',
          title: 'Festive_Reel.mp4',
          url: 'https://cdn.creatorconnect.io/samples/festive.mp4',
          type: 'video',
        ),
        PortfolioAttachment(
          id: 'att-2',
          title: 'Fashion Lookbook',
          url: 'https://instagram.com/p/sample',
          type: 'link',
        ),
      ],
      status: ApplicationStatus.shortlisted,
      brandFeedback:
          'We loved your festive samples! Can you deliver the raw footage within 48h?',
      timeline: [
        StatusTimelineEvent(
          title: 'Proposal Submitted',
          subtitle: '₹15,000 quote with 2 portfolio samples',
          timestamp: 'May 12, 10:30 AM',
          isDone: true,
        ),
        StatusTimelineEvent(
          title: 'Brand Reviewed Pitch',
          subtitle: 'Viewed by Creative Director at Zara India',
          timestamp: 'May 13, 02:15 PM',
          isDone: true,
        ),
        StatusTimelineEvent(
          title: 'Shortlisted for Hiring',
          subtitle: 'Direct chat channel unlocked',
          timestamp: 'May 14, 09:40 AM',
          isDone: true,
          isActive: true,
        ),
        StatusTimelineEvent(
          title: 'Escrow Deposit & Contract',
          subtitle: 'Contract creation upon final agreement',
          timestamp: 'Pending confirmation',
          isDone: false,
        ),
      ],
      createdAt: DateTime.now().subtract(const Duration(days: 2)),
      updatedAt: DateTime.now().subtract(const Duration(hours: 3)),
    ),
    ApplicationModel(
      id: 'app-002',
      assignmentId: 'asg-102',
      assignmentTitle: 'Fitness Routine Series',
      brandName: 'Cult.Fit',
      location: 'Bangalore',
      assignmentBudget: 25000,
      applicantId: 'usr-self',
      coverLetter:
          'Passionate fitness trainer and video editor. Experienced in creating concise 30-day HIIT and mobility challenges.',
      proposedRate: 20000,
      estimatedDays: 7,
      attachments: const [
        PortfolioAttachment(
          id: 'att-3',
          title: 'HIIT_Workout.mp4',
          url: 'https://cdn.creatorconnect.io/samples/hiit.mp4',
          type: 'video',
        ),
      ],
      status: ApplicationStatus.underReview,
      timeline: [
        StatusTimelineEvent(
          title: 'Proposal Submitted',
          subtitle: '₹20,000 quote',
          timestamp: 'May 14, 01:20 PM',
          isDone: true,
          isActive: true,
        ),
        StatusTimelineEvent(
          title: 'Under Review',
          subtitle: 'In review by Cult.Fit hiring managers',
          timestamp: 'In progress',
          isDone: false,
        ),
      ],
      createdAt: DateTime.now().subtract(const Duration(days: 1)),
      updatedAt: DateTime.now().subtract(const Duration(days: 1)),
    ),
    ApplicationModel(
      id: 'app-003',
      assignmentId: 'asg-103',
      assignmentTitle: 'Tech Podcast Audio Mastering',
      brandName: 'The Indian Startup Show',
      location: 'Remote',
      assignmentBudget: 8000,
      applicantId: 'usr-self',
      coverLetter: 'Certified sound engineer with Pro Tools & iZotope RX setup.',
      proposedRate: 8000,
      estimatedDays: 2,
      status: ApplicationStatus.accepted,
      timeline: [
        StatusTimelineEvent(
          title: 'Proposal Submitted',
          subtitle: '₹8,000 quote',
          timestamp: 'May 1, 11:00 AM',
          isDone: true,
        ),
        StatusTimelineEvent(
          title: 'Shortlisted',
          subtitle: 'Selected for test track',
          timestamp: 'May 2, 04:00 PM',
          isDone: true,
        ),
        StatusTimelineEvent(
          title: 'Accepted & Contract Created',
          subtitle: 'Moved to Project Workspace G10',
          timestamp: 'May 3, 10:00 AM',
          isDone: true,
          isActive: true,
        ),
      ],
      createdAt: DateTime.now().subtract(const Duration(days: 15)),
      updatedAt: DateTime.now().subtract(const Duration(days: 13)),
    ),
  ];

  final List<InvitationModel> _receivedInvites = [
    InvitationModel(
      id: 'inv-001',
      projectId: 'prj-501',
      projectTitle: 'Monsoon Trail Run Campaign',
      senderId: 'usr-nike',
      senderName: 'Nike India',
      senderRole: 'Brand Partner',
      recipientId: 'usr-self',
      recipientName: 'Priya Patel',
      recipientRole: 'Fashion Creator',
      inviteType: InviteType.paidHire,
      message:
          'We love your trail-running reels and would love to partner with you for our waterproof footwear campaign.',
      budgetOffered: 35000,
      currency: 'INR',
      deliverables: const [
        '1x 60-second 4K Instagram Reel featuring trail run footwear',
        '2x Instagram Stories linking directly to the product launch page',
        'Delivery deadline: Within 7 days of sample receipt'
      ],
      status: InvitationStatus.pending,
      expiresAt: DateTime.now().add(const Duration(days: 4)),
      createdAt: DateTime.now().subtract(const Duration(days: 3)),
    ),
    InvitationModel(
      id: 'inv-002',
      projectId: 'prj-502',
      projectTitle: 'Podcast Guest Episode #14',
      senderId: 'usr-rohan',
      senderName: 'Rohan Varma',
      senderRole: 'Creator & Host',
      recipientId: 'usr-self',
      recipientName: 'Priya Patel',
      recipientRole: 'Fashion Creator',
      inviteType: InviteType.peerCollab,
      message:
          'Hey Priya! Would love to host you on our Creator Journey podcast next Tuesday in Bandra to talk about creator monetization.',
      budgetOffered: 0,
      currency: 'INR',
      deliverables: const [
        '1x 45-minute studio in-person podcast recording',
        'Co-posted Instagram Collab Reel teaser'
      ],
      status: InvitationStatus.pending,
      expiresAt: DateTime.now().add(const Duration(days: 5)),
      createdAt: DateTime.now().subtract(const Duration(days: 2)),
    ),
  ];

  final List<InvitationModel> _sentInvites = [
    InvitationModel(
      id: 'inv-sent-001',
      projectId: 'prj-601',
      projectTitle: 'Monsoon Activewear Dedicated Reel',
      senderId: 'usr-self',
      senderName: 'Zara India',
      senderRole: 'Brand Partner',
      recipientId: 'usr-priya',
      recipientName: 'Priya Patel',
      recipientRole: 'Fashion Creator',
      inviteType: InviteType.paidHire,
      message:
          'We would love for you to style 2 looks from our monsoon activewear drop.',
      budgetOffered: 22000,
      currency: 'INR',
      deliverables: const ['1x Dedicated Reel', '2x Lookbook Stories'],
      status: InvitationStatus.pending,
      expiresAt: DateTime.now().add(const Duration(days: 5)),
      createdAt: DateTime.now().subtract(const Duration(days: 2)),
      viewedAt: DateTime.now().subtract(const Duration(hours: 8)),
    ),
    InvitationModel(
      id: 'inv-sent-002',
      projectId: 'prj-602',
      projectTitle: 'YouTube Video Editing Package',
      senderId: 'usr-self',
      senderName: 'Zara India',
      senderRole: 'Brand Partner',
      recipientId: 'usr-kabir',
      recipientName: 'Kabir Sen',
      recipientRole: 'Video Editor',
      inviteType: InviteType.paidHire,
      message: 'Editing 3 vlog episodes with motion graphics & sound design.',
      budgetOffered: 18000,
      currency: 'INR',
      deliverables: const ['3x 1080p 10-minute vlog edits', 'Thumbnails included'],
      status: InvitationStatus.accepted,
      expiresAt: DateTime.now().add(const Duration(days: 1)),
      createdAt: DateTime.now().subtract(const Duration(days: 6)),
      viewedAt: DateTime.now().subtract(const Duration(days: 5)),
    ),
  ];

  @override
  Future<MonthlyQuotaInfo> getMonthlyQuota() async {
    return _quota;
  }

  @override
  Future<bool> checkAlreadyApplied(String assignmentId) async {
    return _applications.any((app) =>
        app.assignmentId == assignmentId &&
        app.status != ApplicationStatus.withdrawn);
  }

  @override
  Future<ApplicationModel> submitApplication({
    required String assignmentId,
    required String assignmentTitle,
    required String brandName,
    required String location,
    required int assignmentBudget,
    required String coverLetter,
    required int proposedRate,
    required int estimatedDays,
    List<PortfolioAttachment> attachments = const [],
  }) async {
    if (_quota.isExhausted) {
      throw StateError('Monthly application quota reached');
    }

    final newApp = ApplicationModel(
      id: 'app-${DateTime.now().millisecondsSinceEpoch}',
      assignmentId: assignmentId,
      assignmentTitle: assignmentTitle,
      brandName: brandName,
      location: location,
      assignmentBudget: assignmentBudget,
      applicantId: 'usr-self',
      coverLetter: coverLetter,
      proposedRate: proposedRate,
      estimatedDays: estimatedDays,
      attachments: attachments,
      status: ApplicationStatus.submitted,
      timeline: [
        StatusTimelineEvent(
          title: 'Proposal Submitted',
          subtitle: '₹$proposedRate quote with ${attachments.length} attachments',
          timestamp: 'Just now',
          isDone: true,
          isActive: true,
        ),
        const StatusTimelineEvent(
          title: 'Under Review',
          subtitle: 'Pending brand evaluation',
          timestamp: 'Upcoming',
          isDone: false,
        ),
      ],
      createdAt: DateTime.now(),
      updatedAt: DateTime.now(),
    );

    _applications.insert(0, newApp);
    _quota = MonthlyQuotaInfo(
      remaining: _quota.remaining - 1,
      total: _quota.total,
      resetDate: _quota.resetDate,
      isPro: _quota.isPro,
    );

    return newApp;
  }

  @override
  Future<List<ApplicationModel>> getMyApplications() async {
    return List.unmodifiable(_applications);
  }

  @override
  Future<ApplicationModel?> getApplicationDetail(String id) async {
    try {
      return _applications.firstWhere((app) => app.id == id);
    } catch (_) {
      return null;
    }
  }

  @override
  Future<bool> withdrawApplication(String id) async {
    final idx = _applications.indexWhere((app) => app.id == id);
    if (idx != -1) {
      final old = _applications[idx];
      _applications[idx] = old.copyWith(
        status: ApplicationStatus.withdrawn,
        timeline: [
          ...old.timeline,
          const StatusTimelineEvent(
            title: 'Application Withdrawn',
            subtitle: 'Withdrawn by applicant',
            timestamp: 'Just now',
            isDone: true,
          ),
        ],
      );
      return true;
    }
    return false;
  }

  @override
  Future<InvitationModel> sendDirectInvite({
    required String recipientId,
    required String recipientName,
    required String recipientRole,
    String? recipientAvatarUrl,
    required String projectTitle,
    required InviteType inviteType,
    required int budgetOffered,
    required String message,
    List<String> deliverables = const [],
    int expiresInDays = 7,
  }) async {
    final newInvite = InvitationModel(
      id: 'inv-sent-${DateTime.now().millisecondsSinceEpoch}',
      projectId: 'prj-${DateTime.now().millisecondsSinceEpoch}',
      projectTitle: projectTitle,
      senderId: 'usr-self',
      senderName: 'You',
      senderRole: 'Creator',
      recipientId: recipientId,
      recipientName: recipientName,
      recipientRole: recipientRole,
      recipientAvatarUrl: recipientAvatarUrl,
      inviteType: inviteType,
      message: message,
      budgetOffered: budgetOffered,
      deliverables: deliverables,
      status: InvitationStatus.pending,
      expiresAt: DateTime.now().add(Duration(days: expiresInDays)),
      createdAt: DateTime.now(),
    );

    _sentInvites.insert(0, newInvite);
    return newInvite;
  }

  @override
  Future<List<InvitationModel>> getReceivedInvites() async {
    return List.unmodifiable(_receivedInvites);
  }

  @override
  Future<List<InvitationModel>> getSentInvites() async {
    return List.unmodifiable(_sentInvites);
  }

  @override
  Future<InvitationModel?> getInviteDetail(String id) async {
    try {
      return _receivedInvites.firstWhere((inv) => inv.id == id);
    } catch (_) {
      try {
        return _sentInvites.firstWhere((inv) => inv.id == id);
      } catch (_) {
        return null;
      }
    }
  }

  @override
  Future<bool> acceptInvite(String id) async {
    final idx = _receivedInvites.indexWhere((inv) => inv.id == id);
    if (idx != -1) {
      _receivedInvites[idx] = _receivedInvites[idx].copyWith(
        status: InvitationStatus.accepted,
      );
      return true;
    }
    return false;
  }

  @override
  Future<bool> declineInvite(String id, String? reason) async {
    final idx = _receivedInvites.indexWhere((inv) => inv.id == id);
    if (idx != -1) {
      _receivedInvites[idx] = _receivedInvites[idx].copyWith(
        status: InvitationStatus.declined,
        declineReason: reason,
      );
      return true;
    }
    return false;
  }

  @override
  Future<bool> cancelInvite(String id) async {
    final idx = _sentInvites.indexWhere((inv) => inv.id == id);
    if (idx != -1) {
      _sentInvites[idx] = _sentInvites[idx].copyWith(
        status: InvitationStatus.withdrawn,
      );
      return true;
    }
    return false;
  }
}
