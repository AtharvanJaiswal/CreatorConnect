import 'package:flutter_test/flutter_test.dart';
import 'package:creatorconnect/main.dart';

void main() {
  testWidgets('CreatorConnect app smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const CreatorConnectApp());
    await tester.pumpAndSettle();

    // Verify app title
    expect(find.text('CreatorConnect'), findsOneWidget);

    // Verify Supabase Connection status card
    expect(find.text('Supabase Connection'), findsOneWidget);
  });
}
