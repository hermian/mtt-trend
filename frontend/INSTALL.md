# 테스트 환경 설정 가이드

## 설치가 필요한 패키지

다음 패키지들은 `package.json`의 `devDependencies`에 이미 추가되어 있습니다. npm이 설치되어 있다면 다음 명령어로 설치할 수 있습니다:

```bash
cd /Users/hosung/workspace/git/mtt-trend/frontend
npm install
```

## 필수 의존성

### 단위 테스트 (Unit Tests)
- `vitest`: 테스트 러너
- `@vitest/ui`: 테스트 UI
- `@testing-library/react`: React 컴포넌트 테스트
- `@testing-library/jest-dom`: Jest DOM 매처
- `@testing-library/user-event`: 사용자 인터랙션 시뮬레이션
- `@vitejs/plugin-react`: React용 Vite 플러그인
- `jsdom`: DOM 구현
- `@vitest/coverage-v8`: 커버리지 리포트

### E2E 테스트 (End-to-End Tests)
- `@playwright/test`: E2E 테스트 프레임워크

## npm이 없는 경우

현재 시스템에 npm이 설치되어 있지 않은 경우, 다음 방법으로 설치할 수 있습니다:

### macOS (Homebrew)
```bash
brew install node
```

### 다른 방법
1. Node.js 공식 웹사이트에서 설치: https://nodejs.org/
2. nvm (Node Version Manager) 사용:
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20
```

## 설치 확인

```bash
# Node.js 버전 확인
node --version  # v20 이상 권장

# npm 버전 확인
npm --version

# 패키지 설치
npm install

# 설치된 패키지 확인
npm list --depth=0
```

## 첫 테스트 실행

```bash
# 단위 테스트 실행
npm test

# E2E 테스트 실행 (Playwright)
npx playwright install
npm run test:e2e
```

## 문제 해결

### 권한 오류
```bash
sudo npm install
# 또는
npm install --unsafe-perm
```

### 네트워크 오류
```bash
# 미러 사용 (한국)
npm install --registry=https://registry.npmmirror.com
```

### Playwright 브라우저 설치 실패
```bash
npx playwright install --force
```
