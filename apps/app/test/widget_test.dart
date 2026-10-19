import 'package:flutter_test/flutter_test.dart';
import 'package:creatorconnect/main.dart';

void main() {
  testWidgets('CreatorConnect app smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const CreatorConnectApp());
    await tester.pumpAndSettle();

    // Verify app title
    expect(find.text('CreatorConnect'), findsOneWidget);

    // Verify environment card
    expect(find.text('Environment & Connection'), findsOneWidget);
  });
}
