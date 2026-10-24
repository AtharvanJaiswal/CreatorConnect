import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:file_picker/file_picker.dart';
import '../../../../core/theme/app_colors.dart';
import '../../domain/entities/profile_entities.dart';
import '../../domain/repositories/profile_repository.dart';
import '../../data/repositories/profile_repository_impl.dart';
import '../bottom_sheets/upload_in_progress_sheet.dart';
import '../dialogs/confirm_verification_dialog.dart';

class C13VerificationRequestScreen extends StatefulWidget {
  final ProfileRepository? repository;
  final bool isBrand;

  const C13VerificationRequestScreen({
    super.key,
    this.repository,
    this.isBrand = false,
  });

  @override
  State<C13VerificationRequestScreen> createState() => _C13VerificationRequestScreenState();
}

class _C13VerificationRequestScreenState extends State<C13VerificationRequestScreen> {
  late final ProfileRepository _repo;

  // Creator state
  String _verificationCode = '';
  String _targetAccount = '';
  String _creatorPlatform = 'Instagram';
  String _creatorHandle = '';

  // Brand state
  final _brandFormKey = GlobalKey<FormState>();
  late final TextEditingController _companyCtrl;
  late final TextEditingController _regCtrl;
  late final TextEditingController _personCtrl;
  final List<String> _attachedDocs = [];

  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _repo = widget.repository ?? ProfileRepositoryImpl();
    _companyCtrl = TextEditingController();
    _regCtrl = TextEditingController();
    _personCtrl = TextEditingController();
    _loadInitialData();
  }

  Future<void> _loadInitialData() async {
    final ver = await _repo.getVerificationData();
    final accounts = await _repo.getSocialAccounts();
    final basicInfo = await _repo.getBasicInfo();
    final company = await _repo.getCompanyDetails();

    if (!mounted) return;
    setState(() {
      if (ver.oneTimeCode.isNotEmpty) {
        _verificationCode = ver.oneTimeCode;
      } else {
        final codeNum = 10000 + (DateTime.now().millisecondsSinceEpoch % 90000);
        _verificationCode = 'CC-$codeNum';
      }

      final connected = accounts.where(
        (a) => a.status == SocialPlatformStatus.connected || a.status == SocialPlatformStatus.verified,
      );
      if (connected.isNotEmpty) {
        final first = connected.first;
        _creatorPlatform = first.platform;
        _creatorHandle = first.handle ?? basicInfo.displayName;
        _targetAccount = '${first.platform} @$_creatorHandle';
      } else {
        _creatorPlatform = 'Profile';
        _creatorHandle = basicInfo.displayName.isNotEmpty ? basicInfo.displayName : 'creator';
        _targetAccount = '@$_creatorHandle';
      }

      if (company.companyName.isNotEmpty) {
        _companyCtrl.text = company.companyName;
      }
      if (company.gstNumber != null && company.gstNumber!.isNotEmpty) {
        _regCtrl.text = company.gstNumber!;
      }
      if (basicInfo.displayName.isNotEmpty) {
        _personCtrl.text = basicInfo.displayName;
      }
    });
  }

  void _copyCode() {
    Clipboard.setData(ClipboardData(text: _verificationCode));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Verification code copied to clipboard!'),
        backgroundColor: AppColors.textPrimary,
        duration: Duration(seconds: 2),
      ),
    );
  }

  Future<void> _handleAttachDocument() async {
    try {
      final result = await FilePicker.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['pdf', 'png', 'jpg', 'jpeg'],
      );
      if (result != null && result.files.isNotEmpty && mounted) {
        final picked = result.files.first;
        final fileName = picked.name;
        final sizeBytes = picked.size;
        final sizeFormatted = sizeBytes > 1024 * 1024
            ? '${(sizeBytes / (1024 * 1024)).toStringAsFixed(1)} MB'
            : '${(sizeBytes / 1024).toStringAsFixed(1)} KB';

        final uploaded = await UploadInProgressSheet.show(
          context,
          fileName: fileName,
          fileSize: sizeFormatted,
        );
        if (uploaded && mounted) {
          setState(() {
            _attachedDocs.add(fileName);
          });
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Could not attach document: $e'),
            backgroundColor: const Color(0xFFD32F2F),
          ),
        );
      }
    }
  }

  Future<void> _submitCreator() async {
    final confirm = await ConfirmVerificationDialog.show(
      context,
      isBrand: false,
      code: _verificationCode,
    );

    if (confirm && mounted) {
      setState(() => _isSubmitting = true);
      await _repo.submitCreatorVerification(_creatorPlatform, _creatorHandle, _verificationCode);
      if (mounted) {
        setState(() => _isSubmitting = false);
        final data = await _repo.getVerificationData();
        if (!mounted) return;
        Navigator.pushReplacementNamed(
          context,
          '/profile/verification-result',
          arguments: data,
        );
      }
    }
  }

  Future<void> _submitBrand() async {
    if (!_brandFormKey.currentState!.validate()) return;
    if (_attachedDocs.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please attach at least one proof of business registration'),
          backgroundColor: Color(0xFFD32F2F),
        ),
      );
      return;
    }

    final confirm = await ConfirmVerificationDialog.show(context, isBrand: true);
    if (confirm && mounted) {
      setState(() => _isSubmitting = true);
      await _repo.submitBrandVerification(
        businessName: _companyCtrl.text.trim(),
        regNumber: _regCtrl.text.trim(),
        person: _personCtrl.text.trim(),
        documents: _attachedDocs,
      );
      if (mounted) {
        setState(() => _isSubmitting = false);
        final data = await _repo.getVerificationData();
        if (!mounted) return;
        Navigator.pushReplacementNamed(
          context,
          '/profile/verification-result',
          arguments: data,
        );
      }
    }
  }

  @override
  void dispose() {
    _companyCtrl.dispose();
    _regCtrl.dispose();
    _personCtrl.dispose();
    super.dispose();
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
        title: Text(
          widget.isBrand ? 'Business Verification' : 'Creator Verification',
          style: const TextStyle(
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
                children: widget.isBrand ? _buildBrandFlow() : _buildCreatorFlow(),
              ),
            ),
            // Sticky Action Button
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
                    backgroundColor: AppColors.primary,
                    elevation: 0,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                  ),
                  onPressed: _isSubmitting ? null : (widget.isBrand ? _submitBrand : _submitCreator),
                  child: _isSubmitting
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(strokeWidth: 2.5, color: AppColors.textPrimary),
                        )
                      : Text(
                          widget.isBrand ? 'Submit documents for review' : "I've added the code, verify now",
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

  List<Widget> _buildCreatorFlow() {
    return [
      Text(
        'Verify via $_creatorPlatform Bio',
        style: const TextStyle(
          fontFamily: 'Archivo',
          fontSize: 22,
          fontWeight: FontWeight.w800,
          color: AppColors.textPrimary,
        ),
      ),
      const SizedBox(height: 6),
      Text(
        'Prove ownership of $_targetAccount by placing this temporary code in your bio.',
        style: const TextStyle(fontSize: 14, color: AppColors.textSecondary, height: 1.4),
      ),
      const SizedBox(height: 24),
      // Code Box
      Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: AppColors.surfacePure,
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: AppColors.primary, width: 2),
        ),
        child: Column(
          children: [
            const Text(
              'YOUR UNIQUE VERIFICATION CODE',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.8,
                color: AppColors.textTertiary,
              ),
            ),
            const SizedBox(height: 10),
            Text(
              _verificationCode,
              style: const TextStyle(
                fontFamily: 'Archivo',
                fontSize: 32,
                fontWeight: FontWeight.w900,
                letterSpacing: 3.0,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 14),
            SizedBox(
              height: 44,
              child: ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFFFF3CD),
                  foregroundColor: AppColors.textPrimary,
                  elevation: 0,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                ),
                onPressed: _copyCode,
                icon: const Icon(Icons.copy_rounded, size: 16),
                label: const Text(
                  'Copy verification code',
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
                ),
              ),
            ),
          ],
        ),
      ),
      const SizedBox(height: 28),
      const Text(
        '3 SIMPLE STEPS',
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.8,
          color: AppColors.textTertiary,
        ),
      ),
      const SizedBox(height: 14),
      _StepCard(
        number: '1',
        title: 'Open Instagram & Edit Profile',
        description: 'Navigate to your Instagram profile and tap "Edit profile".',
      ),
      const SizedBox(height: 10),
      _StepCard(
        number: '2',
        title: 'Paste the code in your bio',
        description: 'Paste "$_verificationCode" anywhere in your Bio and save changes.',
      ),
      const SizedBox(height: 10),
      _StepCard(
        number: '3',
        title: 'Tap Verify below',
        description: 'Our automated crawler checks your bio immediately. You can remove the code right after.',
      ),
      const SizedBox(height: 24),
    ];
  }

  List<Widget> _buildBrandFlow() {
    return [
      const Text(
        'Business Verification Details',
        style: TextStyle(
          fontFamily: 'Archivo',
          fontSize: 22,
          fontWeight: FontWeight.w800,
          color: AppColors.textPrimary,
        ),
      ),
      const SizedBox(height: 6),
      const Text(
        'Upload official registration documents to verify your brand account and activate campaign publishing.',
        style: TextStyle(fontSize: 14, color: AppColors.textSecondary, height: 1.4),
      ),
      const SizedBox(height: 24),
      Form(
        key: _brandFormKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Legal Entity Name', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            TextFormField(
              controller: _companyCtrl,
              decoration: _inputDecoration('e.g. Studio Frame Private Limited'),
              validator: (v) => (v == null || v.trim().isEmpty) ? 'Required' : null,
            ),
            const SizedBox(height: 16),
            const Text('GSTIN / Business Registration Number', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            TextFormField(
              controller: _regCtrl,
              decoration: _inputDecoration('Enter 15-digit GSTIN or Registration No.'),
              validator: (v) => (v == null || v.trim().isEmpty) ? 'Required' : null,
            ),
            const SizedBox(height: 16),
            const Text('Authorized Person / Title', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            TextFormField(
              controller: _personCtrl,
              decoration: _inputDecoration('Enter full name and designation'),
              validator: (v) => (v == null || v.trim().isEmpty) ? 'Required' : null,
            ),
          ],
        ),
      ),
      const SizedBox(height: 28),
      const Text(
        'ATTACHED DOCUMENTS',
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.8,
          color: AppColors.textTertiary,
        ),
      ),
      const SizedBox(height: 12),
      if (_attachedDocs.isEmpty)
        Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.surfacePure,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.borderLight),
          ),
          child: const Center(
            child: Text(
              'No documents attached yet. Please upload GST or registration certificate.',
              style: TextStyle(fontSize: 13, color: AppColors.textTertiary),
            ),
          ),
        ),
      ..._attachedDocs.map(
        (doc) => Container(
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: AppColors.surfacePure,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.borderLight),
          ),
          child: Row(
            children: [
              const Icon(Icons.picture_as_pdf_outlined, color: Color(0xFFD32F2F), size: 22),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  doc,
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              IconButton(
                icon: const Icon(Icons.close, size: 18, color: AppColors.textTertiary),
                onPressed: () {
                  setState(() => _attachedDocs.remove(doc));
                },
              ),
            ],
          ),
        ),
      ),
      const SizedBox(height: 8),
      SizedBox(
        width: double.infinity,
        height: 48,
        child: OutlinedButton.icon(
          style: OutlinedButton.styleFrom(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            side: const BorderSide(color: AppColors.borderLight, width: 1.5),
          ),
          onPressed: _handleAttachDocument,
          icon: const Icon(Icons.attach_file, size: 18, color: AppColors.textPrimary),
          label: const Text(
            'Upload document (PDF / JPG up to 10MB)',
            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
          ),
        ),
      ),
      const SizedBox(height: 24),
    ];
  }

  InputDecoration _inputDecoration(String hint) {
    return InputDecoration(
      hintText: hint,
      hintStyle: const TextStyle(color: AppColors.textTertiary, fontSize: 13),
      filled: true,
      fillColor: AppColors.surfacePure,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: AppColors.borderLight),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: AppColors.borderLight),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: AppColors.primary, width: 2),
      ),
    );
  }
}

class _StepCard extends StatelessWidget {
  final String number;
  final String title;
  final String description;

  const _StepCard({
    required this.number,
    required this.title,
    required this.description,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surfacePure,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.borderLight),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 28,
            height: 28,
            decoration: const BoxDecoration(
              color: Color(0xFFFFF3CD),
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Text(
                number,
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF8A6D00),
                ),
              ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  description,
                  style: const TextStyle(fontSize: 13, color: AppColors.textSecondary, height: 1.3),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
