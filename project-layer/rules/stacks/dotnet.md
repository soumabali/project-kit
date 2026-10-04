---
paths:
  - "{{APP}}/**/*.{cs,cshtml,razor,csproj,props}"
  - "{{APP}}/**/appsettings*.json"
kit: {"name": "C# / .NET (ASP.NET Core)", "commands": {"setup": "dotnet restore", "dev": "dotnet watch run", "test": "dotnet test", "testOne": "dotnet test --filter \"FullyQualifiedName~<Name>\"", "lint": "dotnet format --verify-no-changes", "types": "dotnet build -warnaserror", "build": "dotnet publish -c Release", "audit": "dotnet list package --vulnerable --include-transitive"}}
---

# Stack: C# and .NET (ASP.NET Core)

- Check `<TargetFramework>` in the .csproj and use APIs for that version; new apps target the current LTS.
- Projects enable `<Nullable>enable</Nullable>`, `<TreatWarningsAsErrors>true</TreatWarningsAsErrors>`, and
  `<AnalysisLevel>latest-recommended</AnalysisLevel>`. Use central package management for multi-project solutions.

## Structure
- Minimal APIs or controllers, whichever the app uses. Request DTOs (records) are validated at the edge
  (FluentValidation or DataAnnotations); never bind EF entities to requests or responses. Minimal APIs check
  DataAnnotations only after `builder.Services.AddValidation()` (.NET 10+).
- Authorization: a fallback policy that requires an authenticated user; `RequireAuthorization()` or
  `[Authorize(Policy = …)]` per endpoint; resource-based checks through `IAuthorizationService`.
- Errors as ProblemDetails (`AddProblemDetails` plus an exception handler); no stack traces outside Development.
- Options with `ValidateDataAnnotations().ValidateOnStart()`. Secrets come from user-secrets locally and a secret
  store in production, never from appsettings*.json.
- EF Core: migrations committed; `AsNoTracking()` and DTO projections for reads; `Include` or projections to avoid N+1.
- `HttpClient` through `IHttpClientFactory` with timeouts and resilience handlers. Pass `CancellationToken`
  everywhere; never block on `.Result` or `.Wait()`.

## Security specifics
- `UseHttpsRedirection()`, `UseHsts()` outside Development, antiforgery for cookie-authenticated forms, the built-in
  rate limiter (`AddRateLimiter`), and a named CORS policy with explicit origins.
- Persist and protect Data Protection keys when running more than one instance.
- Razor encodes output; `Html.Raw` never with user data.

## Testing
- xUnit or NUnit, whichever exists. Integration tests over HTTP with `WebApplicationFactory<Program>` and a real
  database through Testcontainers, including 401, 403, 404, and 400.
- Browser flows with Playwright for .NET or the e2e app.

## Quality gates
- `dotnet format --verify-no-changes`, analyzers as errors, coverage with `--collect:"XPlat Code Coverage"`,
  `dotnet list package --vulnerable --include-transitive`.
