class PhoneUtils {
  /// Extracts the standard 10-digit Indian mobile number from various input formats:
  /// Examples: '9876543210', '+91 98765 43210', '09876543210', '919876543210'.
  static String? extractTenDigitNumber(String input) {
    final digits = input.replaceAll(RegExp(r'\D'), '');
    if (digits.length == 10) {
      return digits;
    }
    if (digits.length == 11 && digits.startsWith('0')) {
      return digits.substring(1);
    }
    if (digits.length == 12 && digits.startsWith('91')) {
      return digits.substring(2);
    }
    return null;
  }

  /// Normalizes input to E.164 format (+91XXXXXXXXXX for Indian numbers).
  static String? toE164(String input) {
    final tenDigits = extractTenDigitNumber(input);
    if (tenDigits != null) {
      return '+91$tenDigits';
    }
    if (input.trim().startsWith('+')) {
      final clean = input.replaceAll(RegExp(r'[^\d+]'), '');
      if (clean.length >= 8 && clean.length <= 16) {
        return clean;
      }
    }
    return null;
  }

  /// Formats 10 digits as 'XXXXX XXXXX' for display.
  static String formatForDisplay(String tenDigits) {
    if (tenDigits.length == 10) {
      return '${tenDigits.substring(0, 5)} ${tenDigits.substring(5)}';
    }
    return tenDigits;
  }

  /// Validates whether the number represents a valid Indian mobile number (starts with 6, 7, 8, or 9).
  static bool isValidIndianMobile(String input) {
    final tenDigits = extractTenDigitNumber(input);
    if (tenDigits == null) return false;
    return RegExp(r'^[6-9]\d{9}$').hasMatch(tenDigits);
  }
}
