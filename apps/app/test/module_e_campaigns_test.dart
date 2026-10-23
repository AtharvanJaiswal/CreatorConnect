import 'package:flutter_test/flutter_test.dart';
import 'package:creatorconnect/features/campaigns/domain/entities/campaign_entities.dart';

void main() {
  group('Module E: Campaign Entities & Serialization Tests', () {
    test('CampaignBrief.fromJson parses both camelCase and legacy keys safely', () {
      final json = {
        'id': 'brief-test-1',
        'title': 'Summer Campaign',
        'description': 'Description here',
        'category': 'Fashion',
        'status': 'PUBLISHED',
        'budget': 45000,
        'deliverables': ['Reel', 'Story'],
        'deadlineText': 'In 3 days',
        'appliedCount': 12,
        'maxApplicants': 40,
      };

      final brief = CampaignBrief.fromJson(json);
      expect(brief.id, 'brief-test-1');
      expect(brief.title, 'Summer Campaign');
      expect(brief.status, CampaignStatus.published);
      expect(brief.budgetMin, 45000);
      expect(brief.deliverableTypes, contains('Reel'));
      expect(brief.deadline, 'In 3 days');
      expect(brief.applicantsCount, 12);
      expect(brief.targetApplicants, 40);
    });

    test('ApplicationItem.fromJson parses proposed rate and status', () {
      final json = {
        'id': 'app-1',
        'assignmentId': 'brief-test-1',
        'briefTitle': 'Summer Campaign',
        'brandName': 'Urban Vogue',
        'applicantName': 'Priya Patel',
        'proposedRate': 35000,
        'coverLetter': 'Ready to shoot!',
        'status': 'SHORTLISTED',
        'matchScore': 95,
      };

      final app = ApplicationItem.fromJson(json);
      expect(app.id, 'app-1');
      expect(app.proposedRate, 35000);
      expect(app.status, ApplicationStatus.shortlisted);
      expect(app.matchScore, 95);
      expect(app.proposedRateFormatted, '₹35000');
    });
  });
}
