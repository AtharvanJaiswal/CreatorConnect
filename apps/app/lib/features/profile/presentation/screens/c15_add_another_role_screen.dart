import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../auth/domain/entities/user_role.dart';
import '../../domain/repositories/profile_repository.dart';
import '../../data/repositories/profile_repository_impl.dart';
import '../dialogs/add_role_dialog.dart';

class C15AddAnotherRoleScreen extends StatefulWidget {
  final ProfileRepository? repository;
  final UserRole currentRole;

  const C15AddAnotherRoleScreen({
    super.key,
    this.repository,
    this.currentRole = UserRole.creator,
  });

  @override
  State<C15AddAnotherRoleScreen> createState() => _C15AddAnotherRoleScreenState();
}

class _C15AddAnotherRoleScreenState extends State<C15AddAnotherRoleScreen> {
  late final ProfileRepository _repo;
  UserRole? _selectedRole;
  bool _isAdding = false;

  @override
  void initState() {
    super.initState();
    _repo = widget.repository ?? ProfileRepositoryImpl();
  }

  Future<void> _handleAddRole() async {
    if (_selectedRole == null) return;

    final confirmed = await AddRoleDialog.show(context, role: _selectedRole!);
    if (confirmed && mounted) {
      setState(() => _isAdding = true);
      await _repo.addSecondaryRole(_selectedRole!);
      if (mounted) {
        setState(() => _isAdding = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('${_selectedRole!.title} role added to your account!'),
            backgroundColor: const Color(0xFF2E7D32),
            duration: const Duration(seconds: 2),
          ),
        );
        Navigator.pop(context, true);
      }
    }
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
          'Add Another Role',
          style: TextStyle(
            fontFamily: 'Archivo',
            fontSize: 18,
            fontWeight: FontWeight.w800,
            color: AppColors.textPrimary,
          ),
        ),
        centerTitle: false,
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                children: [
                  const Text(
                    'Multi-Role Account',
                    style: TextStyle(
                      fontFamily: 'Archivo',
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Operate as both a Creator and a Video Editor, or post campaigns as a Brand. Switch between modes instantly.',
                    style: TextStyle(fontSize: 14, color: AppColors.textSecondary, height: 1.4),
                  ),
                  const SizedBox(height: 24),
                  ...UserRole.values.map(_buildRoleTile),
                  const SizedBox(height: 24),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
              decoration: const BoxDecoration(
                color: AppColors.surfacePure,
                border: Border(top: BorderSide(color: AppColors.borderLight)),
              ),
              child: SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _selectedRole != null ? AppColors.primary : AppColors.borderLight,
                    elevation: 0,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                  ),
                  onPressed: _isAdding || _selectedRole == null ? null : _handleAddRole,
                  child: _isAdding
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(strokeWidth: 2.5, color: AppColors.textPrimary),
                        )
                      : Text(
                          _selectedRole != null ? 'Add ${_selectedRole!.title}' : 'Select a role to add',
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textPrimary,
                          ),
                        ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRoleTile(UserRole role) {
    final isCurrent = role == widget.currentRole;
    final isSelected = _selectedRole == role;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: isSelected
            ? const Color(0xFFFFF9E6)
            : (isCurrent ? const Color(0xFFF9F7F2) : AppColors.surfacePure),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isSelected
              ? AppColors.primary
              : (isCurrent ? AppColors.borderLight.withValues(alpha: 0.5) : AppColors.borderLight),
          width: isSelected ? 2.0 : 1.2,
        ),
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        leading: Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: role.accentColor.withValues(alpha: 0.25),
            shape: BoxShape.circle,
          ),
          child: Icon(role.icon, color: AppColors.textPrimary, size: 22),
        ),
        title: Wrap(
          spacing: 8,
          runSpacing: 4,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            Text(
              role.title,
              style: const TextStyle(
                fontFamily: 'Archivo',
                fontSize: 15,
                fontWeight: FontWeight.w800,
                color: AppColors.textPrimary,
              ),
            ),
            if (isCurrent)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: AppColors.surfaceWarm,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: const Text(
                  'Current role',
                  style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.textSecondary),
                ),
              ),
          ],
        ),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 2),
          child: Text(
            role.description,
            style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
          ),
        ),
        trailing: isCurrent
            ? const Icon(Icons.check_circle_rounded, color: Color(0xFF2E7D32), size: 22)
            : Container(
                width: 22,
                height: 22,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: isSelected ? AppColors.primary : Colors.transparent,
                  border: Border.all(
                    color: isSelected ? AppColors.primary : AppColors.borderLight,
                    width: 2,
                  ),
                ),
                child: isSelected ? const Icon(Icons.check, size: 14, color: AppColors.textPrimary) : null,
              ),
        onTap: isCurrent
            ? null
            : () {
                setState(() => _selectedRole = role);
              },
      ),
    );
  }
}
