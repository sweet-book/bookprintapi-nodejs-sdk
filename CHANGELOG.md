# Changelog

## 0.4.1 (2026-05-12)

### Fixed — `books.create()` 의 `pageCount` 명시 처리

`creationType=PDF_UPLOAD` / `MIX_COVER_TEMPLATE` 시 서버가 `pageCount` 필수로 요구하나, 기존 SDK 는 `...extraData` 로 흡수만 하고 명시적 검증/타입 힌트가 없어 누락 시 서버 400 으로 발견되던 갭 보정.

- **`books.create({ ..., pageCount })`** — 시그니처에서 명시적으로 분리·검증
- `creationType=PDF_UPLOAD` / `MIX_COVER_TEMPLATE` 인데 `pageCount` 가 `number` 가 아니거나 `<=0` 이면 즉시 `SweetbookValidationError` (field: `pageCount`)
- `creationType=TEMPLATE` 에서 `pageCount` 를 보내도 payload 에 포함만 함 (서버가 무시)
- TypeScript `BookCreateRequest.pageCount?: number` 는 이전부터 선언돼 있었으므로 타입 변경 없음

### Backward compatibility

기존 `creationType=TEMPLATE` 호출자는 영향 없음. `extraData` 로 `pageCount` 보내던 호출자도 그대로 동작.

## 0.4.0 (2026-05-11)

### Added — list 응답 envelope 통일 호환 강화

photobook-api commit `6fbf346` (2026-05-11) 의 list 응답 envelope 평탄화에 대응. v0.2.1 부터 `ResponseParser.toListResult` 가 신·구 envelope 양쪽 분기를 지원하던 토대 위에 다음을 보강.

- **`ResponseParser.getList`**: 인식 키 19개로 확장 — `orders` / `items` / `books` / `templates` / `photos` / `keys` / `accounts` / `memos` / `configs` / `deliveries` / `notifications` / `categories` / `transactions` / `targetTypes` / `daily` / `referrers` / `events` / `logs` / `bookSpecs`. 마지막 fallback 으로 `data` 객체의 첫 번째 배열 자동 채택
- **`ResponseParser.getPagination`**: 구 photos 응답의 `data.totalCount` 를 `pagination.total` 로 자동 흡수
- **`ResponseParser.toListResult`**: 빈 pagination 일 때 응답에 포함하지 않음 (`template-categories` 등 pagination 없는 list 응답이 깔끔)
- **`client.bookSpecs.list`** / **`client.credits.transactions`**: 기존 `getData()` / `getDict()` → `toListResult` 사용으로 통일 (신 envelope 의 배열 data 대응)

### 변경된 envelope 명세

**Before** (구):
```json
{ "success": true, "data": { "books": [...], "pagination": {...} } }
```

**After** (신, commit 6fbf346 이후):
```json
{
  "success": true,
  "data": [...],
  "pagination": { "total": 120, "limit": 20, "offset": 0, "hasNext": true }
}
```

SDK 사용자는 두 envelope 모두에서 `result.books` (또는 `result.orders` 등 toListResult 의 key) 가 항상 배열, `result.pagination` 이 항상 최상위 — 동일한 코드로 두 시점 모두 호환.

### Tests
- `tests/response_envelope.test.js` 8건 추가 (신·구 envelope, totalCount 흡수, 확장 키, 엣지 케이스)
- `npm test` 24/24 통과 (helpers 16 + envelope 8)

### Migration
v0.3.x → v0.4.0: 추가 호환 only. 기존 list 메서드 시그니처/리턴 shape 그대로.

이슈: https://github.com/sweet-book/bookprintapi-nodejs-sdk/issues/3

## 0.3.0 (2026-05-07)

### Added — SDK 헬퍼 (다단계 플로우 한 호출)

설계 문서 `11_sdk_helpers_design.md` v0.1 구현. R011-S01 (16p 책에 35+ API 호출) / C08 (다단계 실패 컨텍스트) 대응.

- **`client.helpers.createBookFromTemplate(input)`** — TEMPLATE 모드 책 + 표지 + 내지 N + finalize 한 호출. 반환 `BookBuildResult` (bookUid / coverPageNum / contentPages / finalized / pageCount)
- **`client.helpers.uploadPdfAndOrder(input)`** — PDF_UPLOAD 모드 책 + PDF 2종 + finalize + 견적 + 주문 한 호출. 반환 `PdfOrderBuildResult` (bookUid / orderUid / finalized / estimate / order). `options.failOnInsufficientCredit` (기본 true) 로 estimate `creditSufficient=false` 시 주문 전 차단

### 새 예외: `SweetbookHelperError`
- `stage`: `HelperStage` 상수 — `BOOK_CREATE` / `COVER_CREATE` / `CONTENT_INSERT` / `BOOK_FINALIZE` / `PDF_UPLOAD_COVER` / `PDF_UPLOAD_CONTENTS` / `ORDER_ESTIMATE` / `ORDER_CREATE` / `VALIDATION`
- `code`: `HelperErrorCodes.SDK_HLPR_*` 임시 코드 (C03 확정 시 표준 errorCode 로 매핑)
- `bookUid`: `BOOK_CREATE` 성공 후부터. `client.books.delete(e.bookUid)` 명시적 cleanup 가능
- `partial`: 단계별 부분 성공 정보 (`bookCreated` / `coverCreated` / `contentsInserted[]` / `finalized` 등)
- `cause`: 원 `SweetbookApiError` 예외 보존
- `contentIndex`: `CONTENT_INSERT` 실패 시 0-based 페이지 index
- `userMessage()`: cause 가 `SweetbookApiError` 면 그쪽으로 위임

### Tests
- `tests/helpers.test.js` 16건 (Node 내장 `node:test` 사용, 외부 의존성 0)
- `npm test` 추가 — 16/16 통과

### TypeScript
- `index.d.ts` 에 `HelpersClient` / `CreateBookFromTemplateInput` / `UploadPdfAndOrderInput` / `BookBuildResult` / `PdfOrderBuildResult` / `SweetbookHelperError` / `HelperStage` / `HelperErrorCodes` 타입 추가
- `Photos` / `Credits` / `Webhook` 도 strong-typed 인터페이스로 강화 (PhotoUploadResponse / CreditsBalance / CreditsTransaction 등)

### 정책 (설계 §4)
- 자동 재시도 안 함 (트랜스포트 레이어 재시도만)
- 자동 롤백 안 함 — 파트너가 `partial` / `bookUid` 보고 명시적 결정
- 호출 전 클라이언트측 검증 (`bookSpec.uid` / `contents ≥ 1` / `order.shipping.recipientName` 등)

### Migration
v0.2.x → v0.3.0 은 추가 only. 기존 `client.books.create` 등 동작 그대로. 헬퍼는 옵트인.

```js
const { SweetbookClient, SweetbookHelperError, HelperStage } = require('bookprintapi-nodejs-sdk');
const c = new SweetbookClient({ apiKey: '...' });

try {
  const result = await c.helpers.createBookFromTemplate({
    bookSpec: { uid: 'PHOTOBOOK_A4_SC' },
    cover: { templateUid: 'cv_xxx', params: { title: 'My Book' } },
    contents: [
      { templateUid: 'p_xxx', params: { ... }, bindingFiles: { mainPhoto: file1 } },
    ],
    options: { externalRef: 'ORDER-123' },
  });
} catch (e) {
  if (e instanceof SweetbookHelperError) {
    if (e.stage === HelperStage.CONTENT_INSERT && e.bookUid) {
      // 책은 남기고 사용자에게 재입력
    } else if (e.bookUid) {
      await c.books.delete(e.bookUid);
    }
  }
  throw e;
}
```

## 0.2.2 (2026-05-06)

### Fixed
- `covers.create` / `contents.insert` 의 multipart 파일 part 이름 회귀 정정.
  서버는 **템플릿이 정의한 binding 이름**(예: `coverPhoto`, `mainPhoto`) 을 multipart part name 으로
  요구합니다. 0.2.1 까지의 SDK 는 모든 파일을 `files` (Covers) / `rowPhotos` (Contents) 단일
  필드명으로 보내 서버가 `필수 이미지 파라미터 'X' 가 제공되지 않았습니다` 로 거부했습니다.

### Added
- `covers.create(bookUid, templateUid, parameters, { bindingFiles: { coverPhoto: file } })` — binding 매핑 (권장)
- `contents.insert(bookUid, templateUid, parameters, { bindingFiles: { mainPhoto: f1, subPhoto: f2 } })` — 동일 패턴
- `_buildTemplateFormData(templateUid, parameters, { bindingFiles, files, fileFieldName })` — 새 옵션 객체 시그니처

### Deprecated
- `covers.create(..., Array<File>)` — Array 형태로 4번째 인자를 받던 구 시그니처. 호환 보존하나 `process.emitWarning` 출력
- `contents.insert(..., { files: [...] })` — `bindingFiles` 로 대체. 호환 보존
- 새 메이저 버전에서 제거 예정

### Migration

```js
// Before (v0.2.1, 깨짐)
await client.covers.create(bookUid, templateUid, parameters, [file]);

// After (v0.2.2)
await client.covers.create(bookUid, templateUid, parameters, {
  bindingFiles: { coverPhoto: file },  // binding 이름은 template 정의에 맞춰
});
```

### Notes
- Java SDK / Python SDK 0.2.2 도 같은 회귀 정정. 모두 v0.2.2 동일 동작.
- 발견 경위: Java SDK 통합 테스트가 sandbox 99 에서 3시나리오 검증 → 서버는 binding 이름이 정답.

## 0.2.1 (2026-04-29)

마이그레이션 회귀테스트 후 list 엔드포인트 SDK 본체 회귀 수정 + examples 핫픽스.

### Fixed
- `BooksClient.list` / `OrdersClient.list` / `PhotosClient.list` / `TemplatesClient.list` — v1 평탄화 응답(`data: [...]` + 최상위 `pagination`)에서 `getDict()`로 끝나 빈 객체를 반환하던 본체 회귀. 신규 헬퍼 `ResponseParser.toListResult(key)` 도입하여 `{ [key]: [...], pagination: {...} }` 정규화 형태로 반환. 신/구 응답 shape 모두 호환
- `examples/02_order.js` — 책 목록 접근을 `booksResp.books || booksResp.data` 폴백 패턴으로 수정 (v0.2.1 본체 수정과 정합, v0.2.0 SDK 본체에서도 안전하게 동작하도록)

### Added
- `ResponseParser.toListResult(key)` — 리스트 엔드포인트 응답을 평탄화 후에도 일관된 shape으로 정규화하는 신규 헬퍼. `index.d.ts` 타입 동반 갱신
- `PhotosClient.list` 반환 타입을 `Record<string, unknown>` → `{ photos: [...]; pagination: Pagination }` 로 구체화

### Migration Notes (v0.2.0 → v0.2.1)
- 0.2.0에서 `await client.books.list(...)` 결과가 빈 객체로 보이던 사용자는 0.2.1 업그레이드 시 `result.books` / `result.pagination` 으로 접근 가능
- `BookSpecsClient.list`는 변경 없음 (서버 응답이 원래 배열 형태로 와서 `getData()` 그대로 반환)

## 0.2.0 (2026-04-28)

서버 master 대비 develop 브랜치 변경사항(99번 v1 적용분) 반영.

### Added
- `lib/errorcodes.js` — `ErrorCodes` 24종 카탈로그 + `ConstraintTypes` 6종
- `lib/order_status.js` — `OrderStatus` 12종 + `ORDER_STATUS_CODE` / `ORDER_STATUS_FROM_CODE` 매핑
- `FieldError` 클래스 (core.js) — `field` / `message` / `currentValue` / `requiredValue` / `constraint`
- `SweetbookApiError.fieldErrors` (FieldError[])
- `SweetbookApiError.data` (일부 errorCode 진단 객체 — INSUFFICIENT_CREDIT 등)
- `SweetbookApiError#fieldError(name)` / `userMessage()` 헬퍼
- `ResponseParser#success` / `getErrorCode()` / `getErrors()` / `getFieldErrors()` / `getFieldError()` / `getPageMeta()` 신규
- `TemplatesClient#getSchema(uid)` — `GET /templates/{uid}/schema` (JSON Schema draft-07)
- TS 타입: `PageMeta` / `FieldError` / `ErrorCodes` / `ConstraintTypes` / `OrderStatus` / `BookDetail` / `TemplateSchema`

### Changed
- `SweetbookApiError.fromResponse()` — `errorCode` (camelCase) 우선 파싱, snake_case fallback
- `ResponseParser#getList()` — 평탄화 응답(`data: [...]`) 우선, 구버전 `data: {orders|items|...}` 자동 흡수
- `ResponseParser#getPagination()` — 평탄화 응답에서 최상위 `pagination` 우선
- TS: `OrderListItem.orderStatus` / `OrderItemDetail.itemStatus` `number` → `OrderStatusValue | string` (Breaking 타입)
- TS: `OrderListItem.orderStatusCode` / `OrderItemDetail.itemStatusCode` 신규 (관리자 전용 옵셔널)
- TS: `BookListItem.status` `string` 유지, 신규 `BookDetail` (단건 응답) 분리
- TS: 응답 객체 다수에 `pageMeta?: PageMeta` 추가

### Migration Notes (v0.1 → v0.2)
- `err.error_code` → `err.errorCode` (기존 표기도 호환되지만 문서/TS는 camelCase 통일)
- 분기는 `ErrorCodes.*` 상수 사용. 메시지 문자열 파싱 금지
- 주문 상태 분기는 `order.orderStatus === OrderStatus.PAID` (TS 에서 `=== 20` 비교는 컴파일 에러)
- 사용자 표시 메시지는 `err.userMessage()` 또는 `err.details[0]`
- `err.fieldErrors` 로 폼 UI 하이라이트 자동화 가능

### Compatibility
- 응답 shape 6필드 고정(`success` / `errorCode` / `message` / `data` / `errors[]` / `fieldErrors[]`)
- 성공 응답은 변경 없음
- 구버전 `error_code` snake_case 응답도 fallback 처리
