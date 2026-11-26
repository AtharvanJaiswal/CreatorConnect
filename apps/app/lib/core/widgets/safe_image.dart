import 'package:flutter/material.dart';

/// Returns a valid [NetworkImage] only if the URL is non-empty and has a valid HTTP/HTTPS scheme.
/// Avoids CanvasKit/Web runtime crashes when empty strings or invalid schemas are supplied.
ImageProvider? safeNetworkImage(String? url) {
  if (url == null || url.trim().isEmpty) return null;
  final clean = url.trim();
  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    return NetworkImage(clean);
  }
  return null;
}

/// Returns a [DecorationImage] only if [safeNetworkImage] resolves to a valid provider.
DecorationImage? safeDecorationImage(String? url, {BoxFit fit = BoxFit.cover}) {
  final provider = safeNetworkImage(url);
  if (provider == null) return null;
  return DecorationImage(image: provider, fit: fit);
}
