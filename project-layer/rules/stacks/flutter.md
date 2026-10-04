---
paths:
  - "{{APP}}/**/*.dart"
  - "{{APP}}/pubspec.yaml"
  - "{{APP}}/.maestro/**/*"
  - "{{APP}}/android/app/src/main/AndroidManifest.xml"
  - "{{APP}}/ios/Runner/Info.plist"
kit: {"name": "Flutter (Dart)", "commands": {"setup": "flutter pub get", "dev": "flutter run", "test": "flutter test", "testOne": "flutter test <file>_test.dart --plain-name \"<name>\"", "lint": "dart format --output=none --set-exit-if-changed .", "types": "flutter analyze", "build": "flutter build appbundle --release --obfuscate --split-debug-info=build/symbols", "audit": "osv-scanner scan source -r ."}}
---

# Stack: Flutter (Dart)

- Check `flutter --version` and pubspec.lock. Follow the state management and routing the app already uses
  (Riverpod, Bloc, Provider; go_router).

## Structure
- Feature-first folders; small widgets; business logic outside widgets (notifiers, blocs, or services); the
  dependency injection the app already uses.
- Theme from DESIGN.md: `ThemeData` with `ColorScheme`, `TextTheme`, and a `ThemeExtension` for custom tokens.
  Widgets never hard-code colors, font sizes, or spacing.
- Responsive with `LayoutBuilder` or `MediaQuery` at the DESIGN.md breakpoints; test small phones and tablets;
  survive large text scaling.
- One HTTP client (dio or http) with timeouts, retries only for idempotent calls, and typed models
  (json_serializable or freezed).

## Security specifics
- The app binary is public: no secrets, no private API keys, no `--dart-define` secrets. The server enforces all authorization.
- Tokens in `flutter_secure_storage` (Keychain and Keystore), never SharedPreferences; clear them on logout.
- Release builds use `--obfuscate --split-debug-info=build/symbols`, and the symbols are archived per release (crash
  reports can't be read without them); no debug logging in release; validate deep links.
- TLS only. Certificate pinning only with a pin rotation plan.

## Testing
- Unit tests for logic; widget tests for every UI state (loading, empty, error, success); golden tests for designed
  components with bundled fonts and fixed sizes.
- `integration_test` on a real device or emulator for critical flows; Patrol or Maestro when native dialogs,
  permissions, or system UI are involved.
- Mock HTTP at the client boundary in widget tests; integration tests talk to a real local or staging backend.

## Quality gates
- `dart format --output=none --set-exit-if-changed .`, `flutter analyze` (flutter_lints or very_good_analysis),
  `flutter test --coverage`, and `osv-scanner` over pubspec.lock.
