# bookprintapi-nodejs-sdk

Sweetbook API를 Node.js에서 사용하기 위한 SDK입니다.

## 설치

npm 레지스트리가 아니라 **GitHub 태그**에서 바로 설치합니다. 별도 계정/사내 레지스트리 불필요.

```bash
# 최신 안정 태그 기준
npm install github:sweet-book/bookprintapi-nodejs-sdk#v0.1.1
```

또는 `package.json`에 직접 선언:

```json
{
  "dependencies": {
    "bookprintapi": "github:sweet-book/bookprintapi-nodejs-sdk#v0.1.1"
  }
}
```

> 태그 목록: [Releases](https://github.com/sweet-book/bookprintapi-nodejs-sdk/tags)
> 버전 올리기: `package.json`의 `#v0.1.1` 부분만 바꾸고 `npm install`

## 빠른 시작

```bash
cp .env.example .env   # API Key 편집
```

```javascript
const { SweetbookClient } = require('bookprintapi');

const client = new SweetbookClient({
  apiKey: 'SB_YOUR_API_KEY',
  environment: 'sandbox',  // 'sandbox' | 'live'
});

// 책 생성 — creationType: 'TEMPLATE' | 'PDF_UPLOAD' | 'MIX_COVER_TEMPLATE'
const book = await client.books.create({
  bookSpecUid: 'SQUAREBOOK_HC',
  title: '내 포토북',
  creationType: 'TEMPLATE',
});
console.log('bookUid:', book.bookUid);
```

> Node.js 18 이상 필요 (내장 `fetch` 사용)

## SDK 구조

```
lib/
├── core.js      # 에러 클래스, ResponseParser, BaseClient (HTTP, 재시도, 타임아웃)
├── client.js    # SweetbookClient + 리소스별 클라이언트
└── webhook.js   # 웹훅 서명 검증 유틸
index.js         # 진입점
```

## 리소스

| 리소스 | 메서드 | 설명 |
|--------|--------|------|
| `client.books` | `list`, `create`, `get`, `finalize`, `delete` | 책 관리 |
| `client.photos` | `upload`, `list`, `delete` | 사진 업로드/관리 |
| `client.covers` | `create`, `get`, `delete` | 표지 |
| `client.contents` | `insert`, `clear` | 내지 페이지 |
| `client.orders` | `estimate`, `create`, `list`, `get`, `cancel`, `updateShipping` | 주문 |
| `client.credits` | `getBalance`, `transactions`, `sandboxCharge` | 충전금 |

## 예제

### 1. 책 생성 → 표지 → 내지 → 최종화

```bash
node examples/01_create_book.js
```

### 2. 충전금 확인 → 견적 → 주문

```bash
node examples/02_order.js
```

### 3. 웹훅 수신 서버

```bash
node examples/03_webhook_server.js
```

### 4. 책 생성 → 주문 E2E 파이프라인

```bash
node examples/server_pipeline.js
```

자세한 시퀀스 설명은 [`examples/README.md`](examples/README.md) 참고.

## 관련 예제 앱 (3-tier 레퍼런스)

SDK를 **파트너 백엔드에 두고** 브라우저에서는 직접 호출하지 않는 구조의 풀스택 demo:

- [`partner-order-demo`](../partner-order-demo) — 파트너 주문 프로그램 (프론트 → 백엔드(SDK 소유) → Sweetbook API)

> ⚠️ **SDK를 브라우저에 번들하지 마세요.** API Key가 클라이언트에 노출됩니다.
> 권장 구조: 브라우저 → 파트너 백엔드(이 SDK 사용) → Sweetbook API

## 환경 설정

`.env` 파일 또는 환경변수로 설정:

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `SWEETBOOK_API_KEY` | API 키 | (필수) |
| `SWEETBOOK_ENV` | `sandbox` 또는 `live` | `live` |
| `SWEETBOOK_WEBHOOK_SECRET` | 웹훅 시크릿 | (선택) |

## SDK 옵션

```javascript
const client = new SweetbookClient({
  apiKey: 'SB...',           // 필수
  environment: 'sandbox',    // 'sandbox' | 'live' (기본: 'live')
  baseUrl: 'https://...',    // 직접 지정 (environment 대신)
  timeout: 30000,            // 요청 타임아웃 ms (기본: 30초)
});
```

## 에러 처리

```javascript
const { SweetbookApiError, SweetbookNetworkError } = require('bookprintapi');

try {
  await client.books.get('invalid-uid');
} catch (err) {
  if (err instanceof SweetbookApiError) {
    console.log('API 에러:', err.statusCode, err.message);
    console.log('상세:', err.details);
  } else if (err instanceof SweetbookNetworkError) {
    console.log('네트워크 에러:', err.message);
  }
}
```

## 웹훅 서명 검증

```javascript
const { verifySignature } = require('bookprintapi');

// Express 예시
app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const payload = req.body.toString();
  const signature = req.headers['x-sweetbook-signature'];
  const timestamp = req.headers['x-sweetbook-timestamp'];

  if (!verifySignature(payload, signature, WEBHOOK_SECRET, timestamp)) {
    return res.status(401).send('Invalid signature');
  }

  const event = JSON.parse(payload);
  // 이벤트 처리...
  res.json({ received: true });
});
```

## 자동 재시도

429 (Rate Limit) 및 5xx 에러 시 지수 백오프로 최대 2회 재시도합니다.

| 시도 | 대기 시간 |
|------|----------|
| 1차 재시도 | 1초 |
| 2차 재시도 | 2초 |

## TypeScript

TypeScript 타입 정의(`index.d.ts`)가 번들되어 있어 별도 설치 없이 자동완성과 타입 체크를 지원합니다. 핵심 도메인(Books/Covers/Contents/Orders)의 요청·응답 타입을 제공하며, Photos/Credits 는 느슨한 타입(`Record<string, unknown>`)으로 노출됩니다.

```typescript
import {
  SweetbookClient,
  type BookCreateRequest,
  type CreateOrderRequest,
} from 'bookprintapi';

const client = new SweetbookClient({ apiKey: 'SB_...', environment: 'sandbox' });

const req: BookCreateRequest = {
  bookSpecUid: 'SQUAREBOOK_HC',
  title: '내 포토북',
  creationType: 'TEMPLATE',
};
const book = await client.books.create(req);
```

Node 전용 타입(`Buffer` 등)을 참조하므로 TypeScript 프로젝트에서는 `@types/node` 가 필요합니다.

```bash
npm install --save-dev @types/node
```

## 커스터마이징

| 파일 | 수정 내용 |
|------|----------|
| `lib/client.js` | 리소스 클라이언트 추가/수정 |
| `lib/core.js` | HTTP 클라이언트 동작 변경 (재시도, 타임아웃 등) |
| `lib/webhook.js` | 서명 검증 로직 수정 |
| `examples/` | 자신의 템플릿 UID와 데이터로 예제 수정 |

## 라이선스

MIT
