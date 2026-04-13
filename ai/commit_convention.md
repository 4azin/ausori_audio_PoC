# Commit Convention

## 커밋 메시지 구조

```
<type>(<scope>): <subject>

<body>

<footer>
```

## Type

| Type | 설명 |
|------|------|
| `feat` | 새로운 기능 추가 |
| `fix` | 버그 수정 |
| `docs` | 문서 수정 (README 등) |
| `style` | 코드 포맷팅, 세미콜론 누락 등 (코드 변경 없음) |
| `refactor` | 코드 리팩토링 (기능 변경 없음) |
| `test` | 테스트 코드 추가/수정 |
| `chore` | 빌드 설정, 패키지 매니저 수정 등 |
| `perf` | 성능 개선 |
| `ci` | CI/CD 설정 변경 |
| `build` | 빌드 시스템 또는 외부 의존성 변경 |
| `revert` | 이전 커밋 되돌리기 |

## 규칙

- `subject`는 50자 이내로 작성
- 첫 글자는 소문자로 시작
- 끝에 마침표(`.`) 붙이지 않기
- 명령문(imperative mood)으로 작성 (예: "add" O, "added" X)
- `body`는 선택사항이며, **무엇을** 그리고 **왜** 변경했는지 작성
- `footer`는 Breaking Change나 이슈 번호 참조 시 사용

## 예시

```
feat(auth): add JWT token authentication

- Access token, Refresh token 발급 로직 구현
- 토큰 만료 시 자동 갱신 처리

Closes #123
```

```
fix(user): resolve password validation error

비밀번호 특수문자 포함 검증 로직이 누락되어 추가

Fixes #456
```

```
docs(readme): add commit convention guide
```
