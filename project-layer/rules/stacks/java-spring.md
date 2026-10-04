---
paths:
  - "{{APP}}/**/*.{java,kt,kts}"
  - "{{APP}}/pom.xml"
  - "{{APP}}/**/*.gradle"
  - "{{APP}}/src/main/resources/templates/**/*"
  - "{{APP}}/**/application*.{yml,yaml,properties}"
kit: {"name": "Java / Kotlin (Spring Boot)", "commands": {"setup": "./mvnw -q -DskipTests install", "dev": "./mvnw spring-boot:run", "test": "./mvnw verify", "testOne": "./mvnw test -Dtest=<Class>#<method>", "lint": "./mvnw spotless:check", "types": "./mvnw compile", "build": "./mvnw package", "audit": "./mvnw org.owasp:dependency-check-maven:check"}}
---

# Stack: Java or Kotlin with Spring Boot

- Check the Spring Boot and Java versions in the build file. Always use the wrapper (`./mvnw` or `./gradlew`);
  with Gradle, swap the Profile commands for their Gradle equivalents.

## Structure
- Controller → service → repository. DTOs are records with Bean Validation (`@Valid`); entities never appear in
  requests or responses. Constructor injection only.
- Errors as `ProblemDetail` from a `@RestControllerAdvice`; no stack traces in responses.
- `@Transactional` on service methods that write, read-only transactions for queries. Avoid N+1 with fetch joins,
  entity graphs, or projections.
- Migrations with Flyway or Liquibase; `spring.jpa.hibernate.ddl-auto=validate` (never update or create outside tests).
- Configuration through `@ConfigurationProperties` with `@Validated`; secrets from env or a vault, never committed.

## Security specifics
- Spring Security denies by default (`anyRequest().authenticated()`); method security (`@PreAuthorize`) for
  roles and ownership; CSRF on for cookie sessions; explicit CORS origins.
- Actuator exposes only `health` (and `info`) publicly; everything else needs auth.
- Jackson: no default typing or polymorphic deserialization of untrusted input; fail on unknown properties for strict inputs.
- Parameters only in JPA, JPQL, and JdbcTemplate; never build queries from strings.

## Testing
- JUnit Jupiter and AssertJ. Slice tests (`@WebMvcTest`, `@DataJpaTest`) plus `@SpringBootTest` with Testcontainers
  (`@ServiceConnection`) on a real database.
- Spring Boot 4: `@MockitoBean` and `@MockitoSpyBean` replace the removed `@MockBean` and `@SpyBean`; test starters
  are `spring-boot-starter-<technology>-test` (for slices, `spring-boot-starter-webmvc-test`, `-data-jpa-test`);
  Jackson 3 lives under `tools.jackson`, customized through `JsonMapperBuilderCustomizer`. Check the Boot version first.
- MockMvc or WebTestClient tests include 401, 403, 404, and 400. Browser flows through Playwright for Java or the e2e app.

## Quality gates
- Spotless, Checkstyle or PMD, Error Prone or SpotBugs, JaCoCo coverage, and OWASP Dependency-Check (or the
  build's own vulnerability scan). Cache Dependency-Check's data directory in CI; its first run can take 20 minutes.
