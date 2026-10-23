import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../../domain/entities/chat_entities.dart';

class ChatLocalDataSource {
  static const String _messagesPrefix = 'cc_chat_msgs_';
  static const String _readPrefix = 'cc_chat_read_';

  final SharedPreferences? _prefs;

  ChatLocalDataSource({SharedPreferences? prefs}) : _prefs = prefs;

  Future<SharedPreferences> _getPrefs() async {
    return _prefs ?? await SharedPreferences.getInstance();
  }

  Future<void> saveCachedMessages(String conversationId, List<ChatMessage> messages) async {
    try {
      final prefs = await _getPrefs();
      final list = messages.map((m) => m.toJson()).toList();
      await prefs.setString('$_messagesPrefix$conversationId', jsonEncode(list));
    } catch (_) {}
  }

  Future<List<ChatMessage>?> getCachedMessages(String conversationId) async {
    try {
      final prefs = await _getPrefs();
      final raw = prefs.getString('$_messagesPrefix$conversationId');
      if (raw != null && raw.isNotEmpty) {
        final list = jsonDecode(raw) as List<dynamic>;
        return list.map((e) => ChatMessage.fromJson(e as Map<String, dynamic>)).toList();
      }
    } catch (_) {}
    return null;
  }

  Future<void> markConversationRead(String conversationId) async {
    try {
      final prefs = await _getPrefs();
      await prefs.setBool('$_readPrefix$conversationId', true);
    } catch (_) {}
  }
}
