---
paths:
  - "{{APP}}/**/*.{ts,tsx,js,jsx}"
  - "{{APP}}/package.json"
  - "{{APP}}/{app.json,app.config.ts,app.config.js,eas.json,metro.config.js,babel.config.js}"
  - "{{APP}}/.maestro/**/*"
kit: {"name": "React Native (Expo)", "commands": {"setup": "npm ci", "dev": "npx expo start", "test": "npx jest", "testOne": "npx jest -t \"<name>\"", "lint": "npx expo lint", "types": "npx tsc --noEmit", "build": "npx eas-cli build --profile preview --platform all", "audit": "npm audit --audit-level high"}, "check": {"ext": "ts,tsx,js,jsx", "cmd": "npx --no-install eslint --no-warn-ignored {file}", "requires": "node_modules/.bin/eslint"}}
---

# Stack: React Native (Expo)

- Check the Expo SDK and React Native versions in package.json; install native packages with `npx expo install`
  so they match the SDK. Run `npx expo-doctor` after dependency changes. Bare React Native apps keep their
  `ios/` and `android/` folders; Expo apps generate them (Continuous Native Generation), so never edit those by hand.
- Use the package manager the lockfile shows; CI installs frozen.

## Structure
- Expo Router (`app/`) for navigation; screens stay thin and call feature modules in `src/features/<feature>/`.
- Server state through TanStack Query; the API client and its types are generated from
  `06-technical-docs/api/openapi.yaml`, never hand-written.
- Styling from the DESIGN.md tokens in one theme module; no inline colors or magic numbers in components.
- Every screen handles loading, empty, error, and offline states, safe areas, the keyboard (inputs stay visible),
  and both light and dark mode if DESIGN.md defines them.

## Security specifics
- Tokens in `expo-secure-store` (Keychain and Keystore), never AsyncStorage. Only `EXPO_PUBLIC_` values reach
  the bundle, and everything in it is public: no secrets in app config or code.
- Deep links and push payloads are untrusted input: validate parameters before navigating or fetching.
- HTTPS only; no cleartext traffic exceptions in release builds.

## Testing
- Jest with `jest-expo` and React Native Testing Library, querying by role and label (which also checks
  accessibility labels); mock the API at the network boundary with MSW.
- Critical journeys in Maestro flows (`.maestro/`) on an emulator or a development build, using test-only accounts.

## Accessibility and polish
- `accessibilityLabel` and `accessibilityRole` on custom controls; targets at least 44 pt; layouts survive the
  largest font scale; respect reduce-motion for animations (Reanimated `useReducedMotion`).
- 60 fps scrolling: `FlatList` or FlashList for long lists with stable keys; images through `expo-image`.

## Quality gates
- `npx expo lint`, `tsc --noEmit`, Jest, `npx expo-doctor`, and an EAS preview build before a release.
