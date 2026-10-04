// integration_test/app_test.dart: a critical journey on a real device or emulator.
// Run: flutter test integration_test --dart-define=E2E_USER_EMAIL=… --dart-define=E2E_USER_PASSWORD=…
// Use test-only accounts; these values are for tests, never for release builds.
// Replace `your_app` with the package name from pubspec.yaml, and the labels with the app's real ones.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:your_app/main.dart' as app;

const email = String.fromEnvironment('E2E_USER_EMAIL');
const password = String.fromEnvironment('E2E_USER_PASSWORD');

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('a user signs in and reaches the home screen', (tester) async {
    app.main();
    await tester.pumpAndSettle();

    await tester.enterText(find.bySemanticsLabel('Email'), email);
    await tester.enterText(find.bySemanticsLabel('Password'), password);
    await tester.tap(find.widgetWithText(FilledButton, 'Sign in'));
    await tester.pumpAndSettle();

    expect(find.text('Home'), findsOneWidget);
  });

  testWidgets('a wrong password shows an error and keeps the email', (tester) async {
    app.main();
    await tester.pumpAndSettle();

    await tester.enterText(find.bySemanticsLabel('Email'), email);
    await tester.enterText(find.bySemanticsLabel('Password'), 'wrong-password');
    await tester.tap(find.widgetWithText(FilledButton, 'Sign in'));
    await tester.pumpAndSettle();

    expect(find.textContaining('incorrect'), findsOneWidget);
    expect(find.text(email), findsOneWidget);
  });
}
