# Changelog

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
