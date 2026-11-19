import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/safe_image.dart';
import '../../domain/entities/discovery_entities.dart';
import '../../data/datasources/module_d_remote_datasource.dart';

class RequestDetailsScreen extends StatefulWidget {
  final String requestId;
  final CollaborationRequestModel? initialData;

  const RequestDetailsScreen({
    super.key,
    required this.requestId,
    this.initialData,
  });

  @override
  State<RequestDetailsScreen> createState() => _RequestDetailsScreenState();
}

class _RequestDetailsScreenState extends State<RequestDetailsScreen> {
  late final ModuleDRemoteDataSource _dataSource;
  late CollaborationRequestModel _request;
  bool _isLoading = false;
  bool _isActionLoading = false;

  @override
  void initState() {
    super.initState();
    _dataSource = ModuleDRemoteDataSource();
    _request = widget.initialData ??
        CollaborationRequestModel(
          id: widget.requestId,
          senderId: '',
          senderName: 'Creator Peer',
          senderHandle: '@creator',
          senderRole: 'CREATOR',
          senderCity: 'Delhi NCR',
          title: 'Collaboration Invitation',
          description: 'Hey! I came across your portfolio and would love to collaborate on a co-produced creator episode and photoshoot.',
          proposedBudget: 15000,
          currency: 'INR',
          deadline: 'Dec 15, 2026',
          status: 'PENDING',
          createdAt: DateTime.now().toIso8601String(),
        );

    if (widget.initialData == null && widget.requestId.isNotEmpty) {
      _loadRequestDetails();
    }
  }

  Future<void> _loadRequestDetails() async {
    setState(() => _isLoading = true);
    final fetched = await _dataSource.getInvitation(widget.requestId);
    if (mounted) {
      setState(() {
        if (fetched != null) {
          _request = fetched;
        }
        _isLoading = false;
      });
    }
  }

  Future<void> _handleAccept() async {
    setState(() => _isActionLoading = true);
    final success = await _dataSource.acceptInvitation(_request.id);
    if (!mounted) return;
    setState(() {
      _isActionLoading = false;
      if (success || _request.status == 'PENDING') {
        _request = _request.copyWith(status: 'ACCEPTED');
      }
    });

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: const Text('Collaboration request accepted! You can now chat directly.'),
        backgroundColor: AppColors.success,
        action: SnackBarAction(
          label: 'Chat Now',
          textColor: Colors.white,
          onPressed: () {
            Navigator.pushNamed(context, '/conversations');
          },
        ),
      ),
    );
  }

  Future<void> _handleDecline() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Decline Request?'),
        content: const Text('Are you sure you want to decline this collaboration invitation?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel', style: TextStyle(color: AppColors.textSecondary)),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.error,
              foregroundColor: Colors.white,
              elevation: 0,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
            ),
            child: const Text('Decline'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    setState(() => _isActionLoading = true);
    final success = await _dataSource.declineInvitation(_request.id);
    if (!mounted) return;
    setState(() {
      _isActionLoading = false;
      if (success || _request.status == 'PENDING') {
        _request = _request.copyWith(status: 'DECLINED');
      }
    });

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Request declined.'),
        backgroundColor: AppColors.textSecondary,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.backgroundWarm,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: AppColors.textPrimary),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Request Details',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontWeight: FontWeight.w900,
            fontSize: 18,
          ),
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : RefreshIndicator(
              color: AppColors.primary,
              onRefresh: _loadRequestDetails,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // 1. Status Banner
                    _buildStatusBanner(),
                    const SizedBox(height: 16),

                    // 2. Sender Profile Card
                    _buildSenderCard(),
                    const SizedBox(height: 16),

                    // 3. Request Details Card
                    _buildDetailsCard(),
                    const SizedBox(height: 16),

                    // 4. Commercials & Timeline Card
                    _buildCommercialsCard(),
                    const SizedBox(height: 28),

                    // 5. Action Buttons (When PENDING)
                    if (_request.status == 'PENDING')
                      _buildActionButtons()
                    else if (_request.status == 'ACCEPTED')
                      _buildAcceptedChatButton()
                    else
                      _buildDeclinedBanner(),

                    const SizedBox(height: 40),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildStatusBanner() {
    Color bg;
    Color border;
    Color textColor;
    IconData icon;
    String label;

    switch (_request.status) {
      case 'ACCEPTED':
        bg = const Color(0xFFE8F5E9);
        border = AppColors.success.withValues(alpha: 0.5);
        textColor = const Color(0xFF1B5E20);
        icon = Icons.check_circle_rounded;
        label = 'Request Accepted • In Collaboration';
        break;
      case 'DECLINED':
        bg = const Color(0xFFFFEBEE);
        border = AppColors.error.withValues(alpha: 0.5);
        textColor = const Color(0xFFB71C1C);
        icon = Icons.cancel_rounded;
        label = 'Request Declined';
        break;
      default:
        bg = const Color(0xFFFFF9E6);
        border = const Color(0xFFF0CF65);
        textColor = const Color(0xFF8A5D07);
        icon = Icons.hourglass_top_rounded;
        label = 'Pending Creator Review';
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: border, width: 1.2),
      ),
      child: Row(
        children: [
          Icon(icon, color: textColor, size: 20),
          const SizedBox(width: 10),
          Text(
            label,
            style: TextStyle(
              fontWeight: FontWeight.w800,
              fontSize: 13,
              color: textColor,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSenderCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.border, width: 1),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 27,
            backgroundColor: AppColors.primary,
            backgroundImage: safeNetworkImage(_request.senderAvatarUrl),
            child: safeNetworkImage(_request.senderAvatarUrl) == null
                ? Text(
                    _request.senderName.isNotEmpty ? _request.senderName[0].toUpperCase() : 'C',
                    style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 20, color: AppColors.textPrimary),
                  )
                : null,
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        _request.senderName,
                        style: AppTypography.headingMedium().copyWith(fontSize: 16),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    if (_request.isSenderVerified) ...[
                      const SizedBox(width: 4),
                      const Icon(Icons.verified_rounded, size: 16, color: Color(0xFF1DA1F2)),
                    ],
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  '${_request.senderHandle} • ${_request.senderRole} · ${_request.senderCity}',
                  style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                ),
              ],
            ),
          ),
          OutlinedButton(
            onPressed: () {
              if (_request.senderId.isNotEmpty) {
                Navigator.pushNamed(context, '/profile/detail', arguments: _request.senderId);
              }
            },
            style: OutlinedButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
              side: const BorderSide(color: AppColors.border),
            ),
            child: const Text('View Profile', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
          ),
        ],
      ),
    );
  }

  Widget _buildDetailsCard() {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.border, width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            _request.title,
            style: AppTypography.headingLarge().copyWith(fontSize: 17),
          ),
          const SizedBox(height: 10),
          const Divider(height: 1, color: AppColors.borderLight),
          const SizedBox(height: 12),
          Text(
            'Message / Proposal',
            style: AppTypography.caption(color: AppColors.textTertiary).copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 6),
          Text(
            _request.description,
            style: const TextStyle(
              fontSize: 13.5,
              height: 1.5,
              color: AppColors.textPrimary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCommercialsCard() {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.border, width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'PROPOSED BUDGET',
                      style: AppTypography.caption(color: AppColors.textTertiary).copyWith(fontWeight: FontWeight.w800, fontSize: 10.5),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _request.proposedBudget != null
                          ? '₹${_request.proposedBudget}'
                          : 'Barter / Revenue Share',
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'TARGET DEADLINE',
                      style: AppTypography.caption(color: AppColors.textTertiary).copyWith(fontWeight: FontWeight.w800, fontSize: 10.5),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _request.deadline ?? 'Flexible',
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildActionButtons() {
    if (_isActionLoading) {
      return const Center(child: CircularProgressIndicator(color: AppColors.primary));
    }

    return Column(
      children: [
        SizedBox(
          width: double.infinity,
          height: 52,
          child: ElevatedButton(
            onPressed: _handleAccept,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: AppColors.textPrimary,
              elevation: 0,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
            ),
            child: const Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.check_rounded, size: 20),
                SizedBox(width: 8),
                Text('Accept Request', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 15)),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        SizedBox(
          width: double.infinity,
          height: 50,
          child: OutlinedButton(
            onPressed: _handleDecline,
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.textSecondary,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
              side: const BorderSide(color: AppColors.border, width: 1.5),
            ),
            child: const Text('Decline Request', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
          ),
        ),
      ],
    );
  }

  Widget _buildAcceptedChatButton() {
    return SizedBox(
      width: double.infinity,
      height: 52,
      child: ElevatedButton(
        onPressed: () {
          Navigator.pushNamed(context, '/conversations');
        },
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.textPrimary,
          foregroundColor: Colors.white,
          elevation: 0,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
        ),
        child: const Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.chat_bubble_rounded, size: 18),
            SizedBox(width: 8),
            Text('Message Collaborator', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
          ],
        ),
      ),
    );
  }

  Widget _buildDeclinedBanner() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.borderLight),
      ),
      child: const Center(
        child: Text(
          'This collaboration request was declined.',
          style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
        ),
      ),
    );
  }
}
