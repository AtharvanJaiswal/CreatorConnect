/// Centralized feature gating configuration for CreatorConnect.
/// Governs phased release capabilities across Modules A through R.
///
/// Phase 1: Creator-First Launch (Creator & Podcaster personas, P2P collaboration, discovery, real-time chat)
/// Phase 2: Production Professionals & Communities
/// Phase 3: Corporate Brands, Paid Briefs & Escrow
class FeatureFlags {
  // ===========================================================================
  // Persona Registration Gating (A03 / C15)
  // ===========================================================================
  static bool enableCreatorRegistration = true;
  static bool enablePodcasterRegistration = true;
  static bool enableProfessionalRegistration = false; // Gated for Phase 2
  static bool enableBrandRegistration = false;        // Gated for Phase 3

  // ===========================================================================
  // Corporate Campaigns & Paid Marketplace Gating (Module G & H)
  // ===========================================================================
  static bool enableCorporateCampaigns = false;     // Module G (Assignments)
  static bool enableCorporateApplications = false;  // Module H (Applications)
  static bool enableBrandDashboard = false;         // Screen D02
  static bool enableEscrowPayments = false;         // Module Q

  // ===========================================================================
  // Core Creator Capabilities (Always Active in Phase 1)
  // ===========================================================================
  static bool enableCreatorMessaging = true;       // Module E (Chat & Requests)
  static bool enableCreatorDiscovery = true;       // Module D (FTS & Filters)
  static bool enablePortfolioShowcase = true;      // Module F (Lookbooks & Reels)
  static bool enableBioVerification = true;        // Module C (Bio code verification)
  static bool enablePeerReviews = true;            // Module K (Peer feedback)

  /// Returns true when the given backend role key is unlocked in the active phase.
  static bool isRoleEnabled(String roleKey) {
    switch (roleKey.trim().toUpperCase()) {
      case 'CREATOR':
        return enableCreatorRegistration;
      case 'PODCASTER':
        return enablePodcasterRegistration;
      case 'PROFESSIONAL':
        return enableProfessionalRegistration;
      case 'BRAND':
        return enableBrandRegistration;
      default:
        return false;
    }
  }

  /// Reset to standard production Phase 1 defaults
  static void resetToPhase1Defaults() {
    enableCreatorRegistration = true;
    enablePodcasterRegistration = true;
    enableProfessionalRegistration = false;
    enableBrandRegistration = false;
    enableCorporateCampaigns = false;
    enableCorporateApplications = false;
    enableBrandDashboard = false;
    enableEscrowPayments = false;
    enableCreatorMessaging = true;
    enableCreatorDiscovery = true;
    enablePortfolioShowcase = true;
    enableBioVerification = true;
    enablePeerReviews = true;
  }
}
