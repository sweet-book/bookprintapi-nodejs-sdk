# Changelog

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
