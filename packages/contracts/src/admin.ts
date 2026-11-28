import { Type, type Static } from '@sinclair/typebox';
import { UuidSchema } from '@creatorconnect/validation';
import {
  TimestampUuidCursorSchema,
  type DecodedTimestampUuidCursor,
  encodeTimestampUuidCursor,
  decodeTimestampUuidCursor,
} from './cursor.js';
import { UserStatusSchema, RoleTypeSchema } from './auth.js';

export const OffsetPaginationQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
});
export type OffsetPaginationQuery = Static<typeof OffsetPaginationQuerySchema>;

// ==============================================================================
// Admin Permissions & Standard Roles
// ==============================================================================

export const AdminPermissionSchema = Type.Union([
  // User Management
  Type.Literal('users.read'),
  Type.Literal('users.update'),
  Type.Literal('users.suspend'),
  Type.Literal('users.reactivate'),
  Type.Literal('users.export'),
  Type.Literal('users.privacy'),

  // Project & Marketplace Management
  Type.Literal('projects.read'),
  Type.Literal('projects.moderate'),

  // Financial & Ledger Management
  Type.Literal('payments.read'),
  Type.Literal('payments.refund.request'),
  Type.Literal('payments.refund.approve'),
  Type.Literal('payments.reconcile'),

  // Trust, Safety & Moderation
  Type.Literal('reports.review'),
  Type.Literal('reports.resolve'),
  Type.Literal('reviews.moderate'),

  // Support & Customer Service
  Type.Literal('support.manage'),
  Type.Literal('support.reply'),
  Type.Literal('support.notes'),

  // Analytics & Observability
  Type.Literal('analytics.read'),

  // Platform & Administrator Management
  Type.Literal('admins.manage'),
  Type.Literal('admins.read'),
  Type.Literal('settings.read'),
  Type.Literal('settings.manage'),
  Type.Literal('audit.read'),

  // Wildcard super-permission
  Type.Literal('*'),
]);
export type AdminPermission = Static<typeof AdminPermissionSchema>;

export const StandardAdminRoleSchema = Type.Union([
  Type.Literal('SUPER_ADMIN'),
  Type.Literal('PLATFORM_ADMIN'),
  Type.Literal('USER_ADMIN'),
  Type.Literal('FINANCE_ADMIN'),
  Type.Literal('TRUST_SAFETY_ADMIN'),
  Type.Literal('SUPPORT_ADMIN'),
  Type.Literal('CONTENT_MODERATOR'),
  Type.Literal('ANALYTICS_VIEWER'),
]);
export type StandardAdminRole = Static<typeof StandardAdminRoleSchema>;

// ==============================================================================
// Admin RBAC & Identity DTOs
// ==============================================================================

export const AdminPermissionResponseSchema = Type.Object({
  id: UuidSchema,
  name: Type.String(),
  description: Type.Union([Type.String(), Type.Null()]),
  module: Type.String(),
  createdAt: Type.String({ format: 'date-time' }),
});
export type AdminPermissionResponse = Static<typeof AdminPermissionResponseSchema>;

export const AdminRoleResponseSchema = Type.Object({
  id: UuidSchema,
  name: Type.String(),
  description: Type.Union([Type.String(), Type.Null()]),
  isSystem: Type.Boolean(),
  permissions: Type.Array(Type.String()),
  userCount: Type.Optional(Type.Integer()),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
});
export type AdminRoleResponse = Static<typeof AdminRoleResponseSchema>;

export const CreateAdminRoleRequestSchema = Type.Object({
  name: Type.String({ minLength: 2, maxLength: 64 }),
  description: Type.Optional(Type.String({ maxLength: 255 })),
  permissions: Type.Array(Type.String(), { minItems: 1 }),
});
export type CreateAdminRoleRequest = Static<typeof CreateAdminRoleRequestSchema>;

export const UpdateAdminRoleRequestSchema = Type.Object({
  description: Type.Optional(Type.String({ maxLength: 255 })),
  permissions: Type.Optional(Type.Array(Type.String())),
});
export type UpdateAdminRoleRequest = Static<typeof UpdateAdminRoleRequestSchema>;

export const AdminUserRoleResponseSchema = Type.Object({
  id: UuidSchema,
  userId: UuidSchema,
  email: Type.String({ format: 'email' }),
  firstName: Type.Union([Type.String(), Type.Null()]),
  lastName: Type.Union([Type.String(), Type.Null()]),
  roles: Type.Array(Type.String()),
  permissions: Type.Array(Type.String()),
  assignedAt: Type.String({ format: 'date-time' }),
  assignedById: Type.Union([UuidSchema, Type.Null()]),
});
export type AdminUserRoleResponse = Static<typeof AdminUserRoleResponseSchema>;

export const AssignAdminRoleRequestSchema = Type.Object({
  userId: UuidSchema,
  roleName: Type.String({ minLength: 2, maxLength: 64 }),
});
export type AssignAdminRoleRequest = Static<typeof AssignAdminRoleRequestSchema>;

export const RevokeAdminRoleRequestSchema = Type.Object({
  userId: UuidSchema,
  roleName: Type.String({ minLength: 2, maxLength: 64 }),
});
export type RevokeAdminRoleRequest = Static<typeof RevokeAdminRoleRequestSchema>;

// ==============================================================================
// Admin Action Dual-Approval DTOs
// ==============================================================================

export const ActionApprovalStatusSchema = Type.Union([
  Type.Literal('PENDING'),
  Type.Literal('APPROVED'),
  Type.Literal('REJECTED'),
  Type.Literal('EXPIRED'),
]);
export type ActionApprovalStatus = Static<typeof ActionApprovalStatusSchema>;

export const AdminActionApprovalResponseSchema = Type.Object({
  id: UuidSchema,
  actionType: Type.String(),
  targetEntity: Type.String(),
  targetEntityId: Type.String(),
  requestedById: UuidSchema,
  requestedByEmail: Type.Optional(Type.String()),
  decidedById: Type.Union([UuidSchema, Type.Null()]),
  decidedByEmail: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  status: ActionApprovalStatusSchema,
  payload: Type.Optional(Type.Any()),
  requestedAmountMinor: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  notes: Type.Union([Type.String(), Type.Null()]),
  expiresAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
});
export type AdminActionApprovalResponse = Static<typeof AdminActionApprovalResponseSchema>;

export const DecideActionApprovalRequestSchema = Type.Object({
  decision: Type.Union([Type.Literal('APPROVE'), Type.Literal('REJECT')]),
  notes: Type.Optional(Type.String({ maxLength: 500 })),
});
export type DecideActionApprovalRequest = Static<typeof DecideActionApprovalRequestSchema>;

// ==============================================================================
// Platform Settings & Configuration DTOs
// ==============================================================================

export const PlatformSettingResponseSchema = Type.Object({
  id: UuidSchema,
  key: Type.String(),
  value: Type.Any(),
  schema: Type.Optional(Type.Any()),
  description: Type.Union([Type.String(), Type.Null()]),
  isEncrypted: Type.Boolean(),
  isSystem: Type.Boolean(),
  version: Type.Integer(),
  updatedAt: Type.String({ format: 'date-time' }),
});
export type PlatformSettingResponse = Static<typeof PlatformSettingResponseSchema>;

export const UpdatePlatformSettingRequestSchema = Type.Object({
  value: Type.Any(),
  reason: Type.String({ minLength: 3, maxLength: 255 }),
});
export type UpdatePlatformSettingRequest = Static<typeof UpdatePlatformSettingRequestSchema>;

export const PlatformSettingAuditResponseSchema = Type.Object({
  id: UuidSchema,
  key: Type.String(),
  previousValue: Type.Any(),
  newValue: Type.Any(),
  version: Type.Integer(),
  changedById: UuidSchema,
  reason: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String({ format: 'date-time' }),
});
export type PlatformSettingAuditResponse = Static<typeof PlatformSettingAuditResponseSchema>;

// ==============================================================================
// Notification Campaigns DTOs
// ==============================================================================

export const NotificationCampaignResponseSchema = Type.Object({
  id: UuidSchema,
  title: Type.String(),
  message: Type.String(),
  targetType: Type.String(),
  channels: Type.Array(Type.String()),
  status: Type.String(),
  scheduledAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  estimatedRecipients: Type.Integer(),
  sentCount: Type.Integer(),
  failedCount: Type.Integer(),
  createdById: UuidSchema,
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
});
export type NotificationCampaignResponse = Static<typeof NotificationCampaignResponseSchema>;

export const CreateNotificationCampaignRequestSchema = Type.Object({
  title: Type.String({ minLength: 3, maxLength: 255 }),
  message: Type.String({ minLength: 5, maxLength: 2000 }),
  targetType: Type.Union([
    Type.Literal('ALL_USERS'),
    Type.Literal('CREATORS_ONLY'),
    Type.Literal('BRANDS_ONLY'),
    Type.Literal('ACTIVE_USERS'),
  ]),
  channels: Type.Array(
    Type.Union([Type.Literal('IN_APP'), Type.Literal('PUSH'), Type.Literal('EMAIL')]),
    {
      minItems: 1,
    },
  ),
  scheduledAt: Type.Optional(Type.String({ format: 'date-time' })),
  idempotencyKey: Type.Optional(Type.String({ minLength: 10, maxLength: 64 })),
});
export type CreateNotificationCampaignRequest = Static<
  typeof CreateNotificationCampaignRequestSchema
>;

// ==============================================================================
// Dashboard & Analytics DTOs
// ==============================================================================

export const DashboardOverviewResponseSchema = Type.Object({
  period: Type.String(),
  metrics: Type.Object({
    totalUsers: Type.Integer(),
    activeUsers: Type.Integer(),
    newRegistrations: Type.Integer(),
    registrationGrowthPercent: Type.Number(),
    suspendedAccounts: Type.Integer(),
    activeCreators: Type.Integer(),
    activeClients: Type.Integer(),
    projectsCreated: Type.Integer(),
    projectsInProgress: Type.Integer(),
    projectsCompleted: Type.Integer(),
    projectsDisputed: Type.Integer(),
    projectCompletionRate: Type.Number(),
    totalTransactions: Type.Integer(),
    successfulPayments: Type.Integer(),
    failedPayments: Type.Integer(),
    paymentSuccessRate: Type.Number(),
    totalTransactionVolumeMinor: Type.String(),
    platformRevenueMinor: Type.String(),
    pendingRefundsCount: Type.Integer(),
    pendingRefundsVolumeMinor: Type.String(),
    openSupportTickets: Type.Integer(),
    pendingModerationReports: Type.Integer(),
    averageSupportResponseMinutes: Type.Number(),
  }),
  timestamp: Type.String({ format: 'date-time' }),
});
export type DashboardOverviewResponse = Static<typeof DashboardOverviewResponseSchema>;

export const DashboardDateRangeQuerySchema = Type.Object({
  period: Type.Optional(
    Type.Union([
      Type.Literal('today'),
      Type.Literal('yesterday'),
      Type.Literal('7d'),
      Type.Literal('30d'),
      Type.Literal('90d'),
      Type.Literal('custom'),
    ]),
  ),
  startDate: Type.Optional(Type.String({ format: 'date-time' })),
  endDate: Type.Optional(Type.String({ format: 'date-time' })),
});
export type DashboardDateRangeQuery = Static<typeof DashboardDateRangeQuerySchema>;

// ==============================================================================
// User Management DTOs
// ==============================================================================

export const AdminUserListItemSchema = Type.Object({
  id: UuidSchema,
  email: Type.String({ format: 'email' }),
  firstName: Type.Union([Type.String(), Type.Null()]),
  lastName: Type.Union([Type.String(), Type.Null()]),
  status: UserStatusSchema,
  roles: Type.Array(RoleTypeSchema),
  adminRoles: Type.Optional(Type.Array(Type.String())),
  isVerified: Type.Boolean(),
  profileCompleteness: Type.Integer(),
  totalProjects: Type.Integer(),
  hasActiveHold: Type.Boolean(),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
});
export type AdminUserListItem = Static<typeof AdminUserListItemSchema>;

export const AdminUserQuerySchema = Type.Intersect([
  OffsetPaginationQuerySchema,
  Type.Object({
    search: Type.Optional(Type.String()),
    status: Type.Optional(UserStatusSchema),
    role: Type.Optional(RoleTypeSchema),
    hasHold: Type.Optional(Type.Boolean()),
    sortBy: Type.Optional(
      Type.Union([Type.Literal('createdAt'), Type.Literal('email'), Type.Literal('status')]),
    ),
    sortOrder: Type.Optional(Type.Union([Type.Literal('asc'), Type.Literal('desc')])),
  }),
]);
export type AdminUserQuery = Static<typeof AdminUserQuerySchema>;

export const AdminUserListResponseSchema = Type.Object({
  items: Type.Array(AdminUserListItemSchema),
  total: Type.Integer(),
  page: Type.Integer(),
  limit: Type.Integer(),
  totalPages: Type.Integer(),
});
export type AdminUserListResponse = Static<typeof AdminUserListResponseSchema>;

export const AdminUserDetailsResponseSchema = Type.Object({
  user: AdminUserListItemSchema,
  profile: Type.Optional(Type.Any()),
  activityTimeline: Type.Array(
    Type.Object({
      action: Type.String(),
      entity: Type.String(),
      createdAt: Type.String({ format: 'date-time' }),
      metadata: Type.Optional(Type.Any()),
    }),
  ),
  stats: Type.Object({
    projectsCount: Type.Integer(),
    reviewsCount: Type.Integer(),
    averageRating: Type.Number(),
    lifetimeSpendOrEarningsMinor: Type.String(),
  }),
});
export type AdminUserDetailsResponse = Static<typeof AdminUserDetailsResponseSchema>;

export const SuspendUserRequestSchema = Type.Object({
  reason: Type.String({ minLength: 5, maxLength: 500 }),
});
export type SuspendUserRequest = Static<typeof SuspendUserRequestSchema>;

export const ReactivateUserRequestSchema = Type.Object({
  reason: Type.String({ minLength: 5, maxLength: 500 }),
});
export type ReactivateUserRequest = Static<typeof ReactivateUserRequestSchema>;

// ==============================================================================
// Audit Log Query DTOs
// ==============================================================================

export const AdminAuditLogItemSchema = Type.Object({
  id: UuidSchema,
  userId: Type.Union([UuidSchema, Type.Null()]),
  userEmail: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  actorEmail: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  actorName: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  action: Type.String(),
  entity: Type.String(),
  entityId: Type.Union([Type.String(), Type.Null()]),
  ipAddress: Type.Union([Type.String(), Type.Null()]),
  userAgent: Type.Union([Type.String(), Type.Null()]),
  metadata: Type.Union([Type.Record(Type.String(), Type.Unknown()), Type.Null()]),
  createdAt: Type.String({ format: 'date-time' }),
});
export type AdminAuditLogItem = Static<typeof AdminAuditLogItemSchema>;

export const AdminAuditLogQuerySchema = Type.Object({
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
  cursor: Type.Optional(TimestampUuidCursorSchema),
  userId: Type.Optional(UuidSchema),
  actorId: Type.Optional(UuidSchema),
  action: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
  entity: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
  entityId: Type.Optional(Type.String({ minLength: 1, maxLength: 64 })),
  startDate: Type.Optional(Type.String({ format: 'date-time' })),
  endDate: Type.Optional(Type.String({ format: 'date-time' })),
  search: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
});
export type AdminAuditLogQuery = Static<typeof AdminAuditLogQuerySchema>;

export const AdminAuditLogResponseSchema = Type.Object({
  items: Type.Array(AdminAuditLogItemSchema),
  nextCursor: Type.Union([Type.String(), Type.Null()]),
  hasMore: Type.Boolean(),
  pagination: Type.Object({
    nextCursor: Type.Union([Type.String(), Type.Null()]),
    hasMore: Type.Boolean(),
    limit: Type.Integer(),
  }),
});
export type AdminAuditLogResponse = Static<typeof AdminAuditLogResponseSchema>;

export type DecodedAuditCursor = DecodedTimestampUuidCursor;

export function encodeAuditCursor(
  createdAt: Date | string,
  id: string,
  filterHash?: string,
): string {
  return encodeTimestampUuidCursor(createdAt, id, 'audit', filterHash);
}

export function decodeAuditCursor(cursor: string): DecodedAuditCursor | null {
  return decodeTimestampUuidCursor(cursor);
}

// ==============================================================================
// Marketplace Administration: Creators & Clients DTOs
// ==============================================================================

export const AdminCreatorListItemSchema = Type.Object({
  id: UuidSchema,
  userId: UuidSchema,
  email: Type.String({ format: 'email' }),
  firstName: Type.Union([Type.String(), Type.Null()]),
  lastName: Type.Union([Type.String(), Type.Null()]),
  bio: Type.Union([Type.String(), Type.Null()]),
  isVerified: Type.Boolean(),
  visibility: Type.String(),
  portfolioCount: Type.Integer(),
  completedProjects: Type.Integer(),
  averageRating: Type.Number(),
  createdAt: Type.String({ format: 'date-time' }),
});
export type AdminCreatorListItem = Static<typeof AdminCreatorListItemSchema>;

export const AdminCreatorQuerySchema = Type.Intersect([
  OffsetPaginationQuerySchema,
  Type.Object({
    search: Type.Optional(Type.String()),
    isVerified: Type.Optional(Type.Boolean()),
    visibility: Type.Optional(Type.String()),
  }),
]);
export type AdminCreatorQuery = Static<typeof AdminCreatorQuerySchema>;

export const AdminCreatorListResponseSchema = Type.Object({
  items: Type.Array(AdminCreatorListItemSchema),
  total: Type.Integer(),
  page: Type.Integer(),
  limit: Type.Integer(),
  totalPages: Type.Integer(),
});
export type AdminCreatorListResponse = Static<typeof AdminCreatorListResponseSchema>;

export const VerifyCreatorRequestSchema = Type.Object({
  isVerified: Type.Boolean(),
  reason: Type.String({ minLength: 3, maxLength: 255 }),
});
export type VerifyCreatorRequest = Static<typeof VerifyCreatorRequestSchema>;

export const AdminClientListItemSchema = Type.Object({
  id: UuidSchema,
  userId: UuidSchema,
  email: Type.String({ format: 'email' }),
  companyName: Type.String(),
  industry: Type.Union([Type.String(), Type.Null()]),
  isVerified: Type.Boolean(),
  totalProjects: Type.Integer(),
  totalSpentMinor: Type.String(),
  createdAt: Type.String({ format: 'date-time' }),
});
export type AdminClientListItem = Static<typeof AdminClientListItemSchema>;

export const AdminClientQuerySchema = Type.Intersect([
  OffsetPaginationQuerySchema,
  Type.Object({
    search: Type.Optional(Type.String()),
    isVerified: Type.Optional(Type.Boolean()),
  }),
]);
export type AdminClientQuery = Static<typeof AdminClientQuerySchema>;

export const AdminClientListResponseSchema = Type.Object({
  items: Type.Array(AdminClientListItemSchema),
  total: Type.Integer(),
  page: Type.Integer(),
  limit: Type.Integer(),
  totalPages: Type.Integer(),
});
export type AdminClientListResponse = Static<typeof AdminClientListResponseSchema>;

export const VerifyClientRequestSchema = Type.Object({
  isVerified: Type.Boolean(),
  reason: Type.String({ minLength: 3, maxLength: 255 }),
});
export type VerifyClientRequest = Static<typeof VerifyClientRequestSchema>;

// ==============================================================================
// Marketplace Administration: Project Governance DTOs
// ==============================================================================

export const AdminProjectListItemSchema = Type.Object({
  id: UuidSchema,
  title: Type.String(),
  status: Type.String(),
  clientId: UuidSchema,
  clientEmail: Type.String(),
  talentId: UuidSchema,
  talentEmail: Type.String(),
  totalAmountMinor: Type.String(),
  deliverablesCount: Type.Integer(),
  hasDispute: Type.Boolean(),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
});
export type AdminProjectListItem = Static<typeof AdminProjectListItemSchema>;

export const AdminProjectQuerySchema = Type.Intersect([
  OffsetPaginationQuerySchema,
  Type.Object({
    search: Type.Optional(Type.String()),
    status: Type.Optional(Type.String()),
    clientId: Type.Optional(UuidSchema),
    talentId: Type.Optional(UuidSchema),
    hasDispute: Type.Optional(Type.Boolean()),
  }),
]);
export type AdminProjectQuery = Static<typeof AdminProjectQuerySchema>;

export const AdminProjectListResponseSchema = Type.Object({
  items: Type.Array(AdminProjectListItemSchema),
  total: Type.Integer(),
  page: Type.Integer(),
  limit: Type.Integer(),
  totalPages: Type.Integer(),
});
export type AdminProjectListResponse = Static<typeof AdminProjectListResponseSchema>;

export const ModerateProjectRequestSchema = Type.Object({
  action: Type.Union([
    Type.Literal('SUSPEND'),
    Type.Literal('RESTRICT'),
    Type.Literal('FLAG_UNDER_REVIEW'),
    Type.Literal('RESTORE'),
  ]),
  reason: Type.String({ minLength: 5, maxLength: 500 }),
});
export type ModerateProjectRequest = Static<typeof ModerateProjectRequestSchema>;

// ==============================================================================
// Finance & Escrow Administration DTOs (Milestone 4)
// ==============================================================================

export const AdminPaymentListItemSchema = Type.Object({
  id: UuidSchema,
  projectId: UuidSchema,
  projectTitle: Type.Optional(Type.String()),
  deliverableId: Type.Union([UuidSchema, Type.Null()]),
  clientId: UuidSchema,
  clientEmail: Type.String(),
  amountMinor: Type.String(),
  currency: Type.String(),
  platformFeeMinor: Type.String(),
  status: Type.String(),
  provider: Type.String(),
  providerOrderId: Type.Union([Type.String(), Type.Null()]),
  providerPaymentId: Type.Union([Type.String(), Type.Null()]),
  refundsCount: Type.Integer(),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
});
export type AdminPaymentListItem = Static<typeof AdminPaymentListItemSchema>;

export const AdminPaymentQuerySchema = Type.Intersect([
  OffsetPaginationQuerySchema,
  Type.Object({
    status: Type.Optional(Type.String()),
    provider: Type.Optional(Type.String()),
    clientId: Type.Optional(UuidSchema),
    projectId: Type.Optional(UuidSchema),
    startDate: Type.Optional(Type.String()),
    endDate: Type.Optional(Type.String()),
    minAmountMinor: Type.Optional(Type.Integer({ minimum: 0 })),
    maxAmountMinor: Type.Optional(Type.Integer({ minimum: 0 })),
  }),
]);
export type AdminPaymentQuery = Static<typeof AdminPaymentQuerySchema>;

export const AdminPaymentListResponseSchema = Type.Object({
  items: Type.Array(AdminPaymentListItemSchema),
  total: Type.Integer(),
  page: Type.Integer(),
  limit: Type.Integer(),
  totalPages: Type.Integer(),
  totalVolumeMinor: Type.String(),
});
export type AdminPaymentListResponse = Static<typeof AdminPaymentListResponseSchema>;

export const AdminRefundListItemSchema = Type.Object({
  id: UuidSchema,
  paymentIntentId: UuidSchema,
  projectId: UuidSchema,
  projectTitle: Type.Optional(Type.String()),
  disputeId: Type.Union([UuidSchema, Type.Null()]),
  cancellationId: Type.Union([UuidSchema, Type.Null()]),
  refundedById: UuidSchema,
  refundedByEmail: Type.String(),
  amountMinor: Type.String(),
  currency: Type.String(),
  reason: Type.String(),
  status: Type.String(),
  provider: Type.String(),
  providerRefundId: Type.Union([Type.String(), Type.Null()]),
  approvalId: Type.Union([UuidSchema, Type.Null()]),
  approvalStatus: Type.Union([Type.String(), Type.Null()]),
  requiresDualApproval: Type.Boolean(),
  notes: Type.Union([Type.String(), Type.Null()]),
  processedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
});
export type AdminRefundListItem = Static<typeof AdminRefundListItemSchema>;

export const AdminRefundQuerySchema = Type.Intersect([
  OffsetPaginationQuerySchema,
  Type.Object({
    status: Type.Optional(Type.String()),
    projectId: Type.Optional(UuidSchema),
    paymentIntentId: Type.Optional(UuidSchema),
  }),
]);
export type AdminRefundQuery = Static<typeof AdminRefundQuerySchema>;

export const AdminRefundListResponseSchema = Type.Object({
  items: Type.Array(AdminRefundListItemSchema),
  total: Type.Integer(),
  page: Type.Integer(),
  limit: Type.Integer(),
  totalPages: Type.Integer(),
});
export type AdminRefundListResponse = Static<typeof AdminRefundListResponseSchema>;

export const CreateRefundRequestSchema = Type.Object({
  paymentIntentId: UuidSchema,
  amountMinor: Type.Integer({ minimum: 1 }),
  reason: Type.Union([
    Type.Literal('PROJECT_CANCELLED'),
    Type.Literal('DISPUTE_RESOLUTION'),
    Type.Literal('CLIENT_REQUESTED'),
    Type.Literal('ADMIN_ADJUSTMENT'),
    Type.Literal('DUPLICATE_PAYMENT'),
  ]),
  notes: Type.String({ minLength: 5, maxLength: 500 }),
});
export type CreateRefundRequest = Static<typeof CreateRefundRequestSchema>;

export const DecideRefundApprovalRequestSchema = Type.Object({
  decision: Type.Union([Type.Literal('APPROVE'), Type.Literal('REJECT')]),
  reason: Type.String({ minLength: 5, maxLength: 500 }),
});
export type DecideRefundApprovalRequest = Static<typeof DecideRefundApprovalRequestSchema>;

export const AdminReconciliationReportSchema = Type.Object({
  status: Type.Union([Type.Literal('BALANCED'), Type.Literal('UNBALANCED')]),
  checkedAt: Type.String({ format: 'date-time' }),
  totalAccounts: Type.Integer(),
  totalDebitsMinor: Type.String(),
  totalCreditsMinor: Type.String(),
  netDifferenceMinor: Type.String(),
  unbalancedAccounts: Type.Array(
    Type.Object({
      id: UuidSchema,
      code: Type.String(),
      name: Type.String(),
      type: Type.String(),
      balanceMinor: Type.String(),
      entriesSumMinor: Type.String(),
      discrepancyMinor: Type.String(),
    }),
  ),
});
export type AdminReconciliationReport = Static<typeof AdminReconciliationReportSchema>;

// ==============================================================================
// Trust, Safety & Moderation DTOs (Milestone 5)
// ==============================================================================

export const AdminReportListItemSchema = Type.Object({
  id: UuidSchema,
  reporterId: UuidSchema,
  reporterEmail: Type.String(),
  targetType: Type.String(),
  targetId: UuidSchema,
  category: Type.String(),
  details: Type.String(),
  status: Type.String(),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
});
export type AdminReportListItem = Static<typeof AdminReportListItemSchema>;

export const AdminReportQuerySchema = Type.Intersect([
  OffsetPaginationQuerySchema,
  Type.Object({
    status: Type.Optional(Type.String()),
    category: Type.Optional(Type.String()),
    targetType: Type.Optional(Type.String()),
  }),
]);
export type AdminReportQuery = Static<typeof AdminReportQuerySchema>;

export const AdminReportListResponseSchema = Type.Object({
  items: Type.Array(AdminReportListItemSchema),
  total: Type.Integer(),
  page: Type.Integer(),
  limit: Type.Integer(),
  totalPages: Type.Integer(),
});
export type AdminReportListResponse = Static<typeof AdminReportListResponseSchema>;

export const ResolveReportRequestSchema = Type.Object({
  action: Type.Union([
    Type.Literal('WARN'),
    Type.Literal('MUTE'),
    Type.Literal('SUSPEND'),
    Type.Literal('BAN'),
    Type.Literal('CONTENT_REMOVED'),
    Type.Literal('NO_ACTION'),
  ]),
  notes: Type.String({ minLength: 5, maxLength: 500 }),
  targetUserId: Type.Optional(UuidSchema),
});
export type ResolveReportRequest = Static<typeof ResolveReportRequestSchema>;

export const DismissReportRequestSchema = Type.Object({
  reason: Type.String({ minLength: 5, maxLength: 500 }),
});
export type DismissReportRequest = Static<typeof DismissReportRequestSchema>;

export const AdminReviewListItemSchema = Type.Object({
  id: UuidSchema,
  projectId: UuidSchema,
  projectTitle: Type.Optional(Type.String()),
  reviewerId: UuidSchema,
  reviewerEmail: Type.String(),
  revieweeId: UuidSchema,
  revieweeEmail: Type.String(),
  rating: Type.Integer(),
  feedback: Type.String(),
  status: Type.String(),
  editCount: Type.Integer(),
  reportsCount: Type.Integer(),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
});
export type AdminReviewListItem = Static<typeof AdminReviewListItemSchema>;

export const AdminReviewQuerySchema = Type.Intersect([
  OffsetPaginationQuerySchema,
  Type.Object({
    status: Type.Optional(Type.String()),
    minRating: Type.Optional(Type.Integer({ minimum: 1, maximum: 5 })),
    maxRating: Type.Optional(Type.Integer({ minimum: 1, maximum: 5 })),
    reviewerId: Type.Optional(UuidSchema),
    revieweeId: Type.Optional(UuidSchema),
  }),
]);
export type AdminReviewQuery = Static<typeof AdminReviewQuerySchema>;

export const AdminReviewListResponseSchema = Type.Object({
  items: Type.Array(AdminReviewListItemSchema),
  total: Type.Integer(),
  page: Type.Integer(),
  limit: Type.Integer(),
  totalPages: Type.Integer(),
});
export type AdminReviewListResponse = Static<typeof AdminReviewListResponseSchema>;

export const ModerateReviewRequestSchema = Type.Object({
  action: Type.Union([
    Type.Literal('FLAG'),
    Type.Literal('HIDE'),
    Type.Literal('REMOVE'),
    Type.Literal('RESTORE'),
  ]),
  reason: Type.String({ minLength: 5, maxLength: 500 }),
  internalNotes: Type.Optional(Type.String({ maxLength: 500 })),
});
export type ModerateReviewRequest = Static<typeof ModerateReviewRequestSchema>;

// ==============================================================================
// Platform Settings, Notifications & Job Monitoring DTOs (Milestone 6)
// ==============================================================================

export const RollbackPlatformSettingRequestSchema = Type.Object({
  targetVersion: Type.Integer({ minimum: 1 }),
  reason: Type.String({ minLength: 3, maxLength: 255 }),
});
export type RollbackPlatformSettingRequest = Static<typeof RollbackPlatformSettingRequestSchema>;

export const EstimateCampaignRequestSchema = Type.Object({
  targetType: Type.Union([
    Type.Literal('ALL_USERS'),
    Type.Literal('CREATORS'),
    Type.Literal('BRANDS'),
    Type.Literal('ACTIVE_USERS'),
  ]),
});
export type EstimateCampaignRequest = Static<typeof EstimateCampaignRequestSchema>;

export const EstimateCampaignResponseSchema = Type.Object({
  targetType: Type.String(),
  estimatedCount: Type.Integer(),
});
export type EstimateCampaignResponse = Static<typeof EstimateCampaignResponseSchema>;

export const CampaignListQuerySchema = Type.Intersect([
  OffsetPaginationQuerySchema,
  Type.Object({
    status: Type.Optional(Type.String()),
  }),
]);
export type CampaignListQuery = Static<typeof CampaignListQuerySchema>;

export const CampaignListResponseSchema = Type.Object({
  items: Type.Array(NotificationCampaignResponseSchema),
  total: Type.Integer(),
  page: Type.Integer(),
  limit: Type.Integer(),
  totalPages: Type.Integer(),
});
export type CampaignListResponse = Static<typeof CampaignListResponseSchema>;

export const QueueMetricsResponseSchema = Type.Object({
  queueName: Type.String(),
  waiting: Type.Integer(),
  active: Type.Integer(),
  completed: Type.Integer(),
  failed: Type.Integer(),
  delayed: Type.Integer(),
  paused: Type.Boolean(),
});
export type QueueMetricsResponse = Static<typeof QueueMetricsResponseSchema>;
