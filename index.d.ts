/// <reference types="node" />
/**
 * Sweetbook Node.js SDK — TypeScript 타입 정의
 *
 * 핵심 도메인: Books / Covers / Contents / Orders
 * (Photos / Credits / Webhook 타입은 향후 번들에서 추가 예정)
 *
 * v0.2.0 — 99번 v1 마이그레이션 반영:
 *  - 6필드 응답 shape (errorCode / fieldErrors)
 *  - 주문 상태 string enum (orderStatus: OrderStatus, orderStatusCode? 분리)
 *  - 목록 응답 평탄화 (data: T[] + 최상위 pagination)
 *  - PageMeta (책 생성·내지·표지·finalize·PDF 응답)
 *  - GET /templates/{uid}/schema
 *  - errorCode 카탈로그 24종 (ErrorCodes)
 */

// ============================================================
// 공통 타입
// ============================================================

export interface ClientOptions {
  /** API 키 (SB...) — 필수 */
  apiKey: string;
  /** 베이스 URL 직접 지정 (environment 와 baseUrl 둘 다 없으면 live 기본) */
  baseUrl?: string;
  /** 'sandbox' 또는 'live' (기본: 'live') */
  environment?: "sandbox" | "live";
  /** 요청 타임아웃 (ms, 기본: 30000) */
  timeout?: number;
}

export interface Pagination {
  total: number;
  limit: number;
  offset: number;
  hasNext: boolean;
}

/** 페이지 제약 메타 — master_대비_변경사항.md § 8 */
export interface PageMeta {
  /** 현재 누적 내지 페이지 수 (표지 제외, 0 이상) */
  currentPageCount: number;
  /** 최소 페이지 수 (BookSpec 기준) */
  pageMin: number;
  /** 최대 페이지 수 (BookSpec 기준) */
  pageMax: number;
  /** 페이지 증분 단위 */
  pageIncrement: number;
  /** 제약 만족 여부: pageMin ≤ current ≤ pageMax && (current - pageMin) % pageIncrement == 0 */
  isValid: boolean;
}

/** 템플릿 파라미터. 서버에서 Dictionary<string, object> 로 받음. */
export type TemplateParameters = Record<string, unknown>;

/** 템플릿에 첨부하는 파일. Blob / Buffer / ReadStream 등 FormData 가 받을 수 있는 값. */
export type TemplateFile = unknown;

// ============================================================
// errorCode / FieldError 카탈로그 (master_대비_변경사항.md § 1, § 2)
// ============================================================

/** fieldErrors[].constraint 열거값 */
export type ConstraintType =
  | "min"
  | "max"
  | "increment"
  | "enum"
  | "pattern"
  | "required";

export interface FieldErrorObject {
  field: string;
  message: string;
  currentValue?: unknown;
  requiredValue?: unknown;
  constraint?: ConstraintType | string;
}

export class FieldError implements FieldErrorObject {
  constructor(obj?: Partial<FieldErrorObject>);
  field: string;
  message: string;
  currentValue: unknown;
  requiredValue: unknown;
  constraint: ConstraintType | string | null;
  static from(obj: unknown): FieldError | null;
}

/** 24종 errorCode 식별자 카탈로그 */
export const ErrorCodes: {
  readonly VALIDATION_FAILED: "ERR_VALIDATION_FAILED";
  readonly MALFORMED_REQUEST: "ERR_MALFORMED_REQUEST";
  readonly UNAUTHORIZED: "ERR_UNAUTHORIZED";
  readonly FORBIDDEN: "ERR_FORBIDDEN";
  readonly NOT_FOUND: "ERR_NOT_FOUND";
  readonly CONFLICT: "ERR_CONFLICT";
  readonly TOO_MANY_REQUESTS: "ERR_TOO_MANY_REQUESTS";
  readonly INTERNAL_ERROR: "ERR_INTERNAL_ERROR";
  readonly INSUFFICIENT_PAGES: "ERR_INSUFFICIENT_PAGES";
  readonly PAGECOUNT_INVALID: "ERR_PAGECOUNT_INVALID";
  readonly FINALIZE_PREREQ_UNMET: "ERR_FINALIZE_PREREQ_UNMET";
  readonly CREATION_TYPE_UNSUPPORTED: "ERR_CREATION_TYPE_UNSUPPORTED";
  readonly TEMPLATE_BINDING_MISSING: "ERR_TEMPLATE_BINDING_MISSING";
  readonly TEMPLATE_PARAM_REQUIRED: "ERR_TEMPLATE_PARAM_REQUIRED";
  readonly ORDER_TRANSITION_INVALID: "ERR_ORDER_TRANSITION_INVALID";
  readonly INSUFFICIENT_CREDIT: "ERR_INSUFFICIENT_CREDIT";
  readonly ENV_MISMATCH: "ERR_ENV_MISMATCH";
  readonly SANDBOX_UNSUPPORTED: "ERR_SANDBOX_UNSUPPORTED";
  readonly IDEMPOTENCY_KEY_MISMATCH: "ERR_IDEMPOTENCY_KEY_MISMATCH";
  readonly PDF_NOT_UPLOADED: "ERR_PDF_NOT_UPLOADED";
  readonly PDF_NOT_GENERATED: "ERR_PDF_NOT_GENERATED";
  readonly PDF_PENDING: "ERR_PDF_PENDING";
  readonly PDF_GENERATION_FAILED: "ERR_PDF_GENERATION_FAILED";
  readonly PDF_FILE_MISSING: "ERR_PDF_FILE_MISSING";
};

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export const ConstraintTypes: {
  readonly MIN: "min";
  readonly MAX: "max";
  readonly INCREMENT: "increment";
  readonly ENUM: "enum";
  readonly PATTERN: "pattern";
  readonly REQUIRED: "required";
};

// ============================================================
// Order 상태 enum (master_대비_변경사항.md § 7)
// ============================================================

export const OrderStatus: {
  readonly PAID_AWAITING_CONTENT: "PAID_AWAITING_CONTENT";
  readonly PAID: "PAID";
  readonly PDF_READY: "PDF_READY";
  readonly CONFIRMED: "CONFIRMED";
  readonly IN_PRODUCTION: "IN_PRODUCTION";
  readonly COMPLETED: "COMPLETED";
  readonly PRODUCTION_COMPLETE: "PRODUCTION_COMPLETE";
  readonly SHIPPED: "SHIPPED";
  readonly DELIVERED: "DELIVERED";
  readonly CANCELLED: "CANCELLED";
  readonly CANCELLED_REFUND: "CANCELLED_REFUND";
  readonly ERROR: "ERROR";
};

export type OrderStatusValue = (typeof OrderStatus)[keyof typeof OrderStatus];

export const ORDER_STATUS_CODE: Readonly<Record<OrderStatusValue, number>>;
export const ORDER_STATUS_FROM_CODE: Readonly<Record<number, OrderStatusValue>>;

// ============================================================
// Books
// ============================================================

export type CreationType = "TEMPLATE" | "PDF_UPLOAD" | "MIX_COVER_TEMPLATE";

export interface BookCreateRequest {
  /** 상품 스펙 UID (필수) */
  bookSpecUid: string;
  /** 책 제목 (1-255자) */
  title?: string;
  /** 생성 방식 (기본: TEMPLATE) */
  creationType?: CreationType;
  /** 상품 프로필 UID (선택) */
  specProfileUid?: string;
  /** 파트너 외부 참조 식별자 (최대 100자) */
  externalRef?: string;
  /** PDF_UPLOAD / MIX_COVER_TEMPLATE 일 때 필수 */
  pageCount?: number;
  /** 관리자 전용: 대상 사용자 UID */
  AccountUid?: string;
  [extra: string]: unknown;
}

export interface BookCreateResponse {
  bookUid: string;
  /** 생성 직후 currentPageCount=0, isValid=false */
  pageMeta: PageMeta;
  [extra: string]: unknown;
}

export interface BookDetail {
  bookUid: string;
  accountUid?: string | null;
  title: string;
  bookSpecUid?: string | null;
  bookSpecName?: string | null;
  specProfileUid?: string | null;
  creationType?: CreationType | string | null;
  /** 1=DRAFT, 2=FINALIZED, 9=DELETED */
  status: number;
  coverTemplateUid?: string | null;
  externalRef?: string | null;
  isTest: boolean;
  pageMeta: PageMeta;
  createdAt: string;
  updatedAt: string;
  [extra: string]: unknown;
}

export interface BookListItem {
  bookUid: string;
  accountUid?: string | null;
  title: string;
  author?: string | null;
  /** 목록 응답에서는 문자열 enum */
  status: "draft" | "finalized" | string;
  pageCount: number;
  bookSpecUid?: string | null;
  specProfileUid?: string | null;
  creationType?: string | null;
  createdAt: string;
  updatedAt: string;
  externalRef?: string | null;
  isTest: boolean;
  pdfStatus?: number | null;
  pdfCreatedAt?: string | null;
  pdfRequestedAt?: string | null;
  thumbnailStatus?: number | null;
  [extra: string]: unknown;
}

/**
 * BooksClient.list() 반환값.
 * 서버 응답이 평탄화되었지만 SDK는 `{ books, pagination }` 형태로 보존 (호환).
 */
export interface BooksListResult {
  books: BookListItem[];
  pagination: Pagination;
  [extra: string]: unknown;
}

export interface BookListParams {
  status?: string;
  limit?: number;
  offset?: number;
}

export interface BookFinalizationResponse {
  result: string;
  pageMeta: PageMeta;
  finalizedAt?: string;
  [extra: string]: unknown;
}

export class BooksClient {
  list(params?: BookListParams): Promise<BooksListResult>;
  create(data: BookCreateRequest): Promise<BookCreateResponse>;
  /** RESTful 단건 조회 — pageMeta 포함 */
  get(bookUid: string): Promise<BookDetail>;
  finalize(bookUid: string): Promise<BookFinalizationResponse>;
  delete(bookUid: string): Promise<unknown>;
}

// ============================================================
// Covers
// ============================================================

export interface CoverData {
  bookUid: string;
  templateUid?: string;
  pageNum?: number;
  /** 표지는 카운트 영향 없음, 현재 내지 상태 보고용 */
  pageMeta?: PageMeta;
  createdAt?: string;
  updatedAt?: string;
  [extra: string]: unknown;
}

export class CoversClient {
  create(
    bookUid: string,
    templateUid: string,
    parameters: TemplateParameters,
    files?: TemplateFile[] | Record<string, TemplateFile>,
  ): Promise<CoverData>;
  get(bookUid: string): Promise<CoverData>;
  delete(bookUid: string): Promise<unknown>;
}

// ============================================================
// Contents
// ============================================================

export type BreakBefore = "page" | "spread" | string;

export interface ContentInsertOptions {
  /** 템플릿에 첨부할 이미지 파일 (선택) */
  files?: TemplateFile[] | Record<string, TemplateFile>;
  /** 페이지/스프레드 단위 페이지 나눔 (선택) */
  breakBefore?: BreakBefore;
}

export interface ContentInsertResult {
  /** 삽입된 페이지 번호 (서버 cursor.pageNum) */
  pageNum?: number;
  /** 페이지 사이드 (서버 cursor.pageSide) */
  pageSide?: string;
  /** 누적 페이지 메타 */
  pageMeta?: PageMeta;
  [extra: string]: unknown;
}

export class ContentsClient {
  insert(
    bookUid: string,
    templateUid: string,
    parameters: TemplateParameters,
    options?: ContentInsertOptions,
  ): Promise<ContentInsertResult>;
  clear(bookUid: string): Promise<unknown>;
}

// ============================================================
// Orders
// ============================================================

export interface OrderItemRequest {
  bookUid: string;
  /** 수량 (1-100) */
  quantity?: number;
}

export interface ShippingRequest {
  recipientName: string;
  recipientPhone: string;
  postalCode: string;
  address1: string;
  address2?: string;
  memo?: string;
}

export interface CreateOrderRequest {
  items: OrderItemRequest[];
  shipping: ShippingRequest;
  externalRef?: string;
  externalUserId?: string;
}

export interface EstimateItemRequest {
  bookUid: string;
  /** 수량 (1-100) */
  quantity?: number;
}

export interface EstimateRequest {
  items: EstimateItemRequest[];
}

export interface EstimateItemResponse {
  bookUid: string;
  bookSpecUid: string;
  pageCount: number;
  quantity: number;
  unitPrice: number;
  itemAmount: number;
  packagingFee: number;
}

export interface EstimateResponse {
  items: EstimateItemResponse[];
  productAmount: number;
  shippingFee: number;
  packagingFee: number;
  totalAmount: number;
  paidCreditAmount: number;
  creditBalance: number;
  creditSufficient: boolean;
  currency: string;
}

export interface OrderListItem {
  orderUid: string;
  accountUid: string;
  orderType: string;
  externalRef?: string | null;
  /** 문자열 enum (PAID, PDF_READY, ...) — v0.2.0 부터 string */
  orderStatus: OrderStatusValue | string;
  /** 관리자 응답에만 노출되는 숫자 코드 */
  orderStatusCode?: number;
  /** 한글 표시 문자열 ("결제완료" 등) */
  orderStatusDisplay: string;
  totalAmount: number;
  paidCreditAmount: number;
  paymentMethod: string;
  itemCount: number;
  recipientName: string;
  isTest: boolean;
  orderedAt: string;
  createdAt: string;
  [extra: string]: unknown;
}

/**
 * OrdersClient.list() 반환값.
 * 서버 응답은 평탄화 (data: [...], pagination 최상위) 되었지만,
 * SDK 는 `{ orders, pagination }` 형태로 호환 유지 (구버전 호환 래퍼).
 */
export interface OrderListResponse {
  orders: OrderListItem[];
  pagination: Pagination;
  [extra: string]: unknown;
}

export interface OrderListParams {
  limit?: number;
  offset?: number;
  /** 문자열 enum 권장 (OrderStatus.*) 또는 숫자 코드 */
  status?: OrderStatusValue | string | number;
  from?: string;
  to?: string;
}

export interface OrderItemDetail {
  itemUid: string;
  bookUid: string;
  bookTitle?: string | null;
  bookSpecUid: string;
  bookSpecName?: string | null;
  quantity: number;
  pageCount: number;
  unitPrice: number;
  itemAmount: number;
  /** 문자열 enum (PAID, PDF_READY, ...) */
  itemStatus: OrderStatusValue | string;
  /** 관리자 응답에만 노출 */
  itemStatusCode?: number;
  itemStatusDisplay: string;
  trackingNumber?: string | null;
  trackingCarrier?: string | null;
  shippedAt?: string | null;
  createdAt: string;
  [extra: string]: unknown;
}

export interface OrderDetailResponse {
  orderUid: string;
  accountUid: string;
  orderType: string;
  externalRef?: string | null;
  orderStatus: OrderStatusValue | string;
  orderStatusCode?: number;
  orderStatusDisplay: string;
  isTest: boolean;
  totalProductAmount: number;
  totalShippingFee: number;
  totalPackagingFee: number;
  totalAmount: number;
  paidCreditAmount: number;
  paymentMethod: string;
  creditBalanceAfter?: number | null;
  recipientName: string;
  recipientPhone: string;
  postalCode: string;
  address1: string;
  address2?: string | null;
  shippingMemo?: string | null;
  trackingNumber?: string | null;
  trackingCarrier?: string | null;
  cancelReason?: string | null;
  refundAmount?: number | null;
  orderedAt: string;
  paidAt?: string | null;
  cancelledAt?: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  createdAt: string;
  items: OrderItemDetail[];
  [extra: string]: unknown;
}

export interface UpdateShippingRequest {
  recipientName?: string;
  recipientPhone?: string;
  postalCode?: string;
  address1?: string;
  address2?: string;
  shippingMemo?: string;
}

export class OrdersClient {
  estimate(data: EstimateRequest): Promise<EstimateResponse>;
  create(data: CreateOrderRequest): Promise<OrderDetailResponse>;
  list(params?: OrderListParams): Promise<OrderListResponse>;
  get(orderUid: string): Promise<OrderDetailResponse>;
  cancel(orderUid: string, cancelReason: string): Promise<OrderDetailResponse>;
  updateShipping(
    orderUid: string,
    shippingData: UpdateShippingRequest,
  ): Promise<OrderDetailResponse>;
}

// ============================================================
// BookSpecs — 상품 스펙 조회 (읽기 전용)
// ============================================================

export interface BookSpecDto {
  bookSpecUid: string;
  name?: string | null;
  innerTrimWidthMm?: number | null;
  innerTrimHeightMm?: number | null;
  pageMin?: number | null;
  pageMax?: number | null;
  pageDefault?: number | null;
  pageIncrement?: number | null;
  coverType?: string | null;
  bindingType?: string | null;
  bindingEdge?: string | null;
  priceCurrency?: string | null;
  priceBase?: number | null;
  pricePerIncrement?: number | null;
  sandboxPriceBase?: number | null;
  sandboxPricePerIncrement?: number | null;
  paper?: Record<string, unknown> | null;
  /** 관리자 전용 필드 (일반 사용자에게는 null 반환) */
  bookSpecId?: number | null;
  ebookProductId?: number | null;
  production?: Record<string, unknown> | null;
  bleed?: Record<string, unknown> | null;
  pdfSize?: Record<string, unknown> | null;
  layoutSize?: Record<string, unknown> | null;
  spineRules?: Record<string, unknown> | null;
  visibility?: string | null;
  ownerAccountUid?: string | null;
  [extra: string]: unknown;
}

export class BookSpecsClient {
  list(options?: { accountUid?: string }): Promise<BookSpecDto[]>;
  get(bookSpecUid: string, options?: { accountUid?: string }): Promise<BookSpecDto>;
}

// ============================================================
// Templates — 목록/상세/스키마 조회 (읽기 전용)
// ============================================================

export type TemplateScope = "public" | "private" | "all";
export type TemplateKind = "cover" | "content" | "divider" | "publish";

export interface TemplateListParams {
  scope?: TemplateScope;
  bookSpecUid?: string;
  specProfileUid?: string;
  templateKind?: TemplateKind;
  category?: string;
  templateName?: string;
  theme?: string;
  sort?: string;
  limit?: number;
  offset?: number;
}

export interface TemplateListItem {
  templateUid: string;
  templateName: string;
  templateKind?: string;
  bookSpecUid?: string | null;
  thumbnailUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
  [extra: string]: unknown;
}

export interface TemplatesListResult {
  templates: TemplateListItem[];
  pagination: Pagination;
  [extra: string]: unknown;
}

export interface TemplateDetail {
  templateUid: string;
  templateName: string;
  templateKind?: string;
  bookSpecUid?: string | null;
  /** 플레이스홀더 바인딩 스펙 */
  parameters?: Record<string, unknown> | null;
  /** 레이아웃 JSON */
  layout?: Record<string, unknown> | null;
  /** 배치 규칙 JSON */
  layoutRules?: Record<string, unknown> | null;
  [extra: string]: unknown;
}

/**
 * GET /templates/{uid}/schema — JSON Schema draft-07 응답.
 * AI 에이전트 / 페이로드 검증 / codegen 용도.
 */
export interface TemplateSchema {
  $schema: string;
  $id: string;
  title: string;
  description?: string;
  type: "object";
  properties: Record<
    string,
    {
      type: string;
      description?: string;
      format?: string;
      items?: { type: string; format?: string };
      "x-binding"?: "text" | "file" | "gallery" | "collageGallery" | "rowGallery" | string;
      [extra: string]: unknown;
    }
  >;
  required: string[];
  "x-templateKind"?: string;
  [extra: string]: unknown;
}

export class TemplatesClient {
  list(params?: TemplateListParams): Promise<TemplatesListResult>;
  get(templateUid: string, options?: { accountUid?: string }): Promise<TemplateDetail>;
  /** 템플릿 파라미터 스키마 (JSON Schema draft-07) — v0.2.0 신규 */
  getSchema(templateUid: string): Promise<TemplateSchema>;
}

// ============================================================
// PDFs — PDF_UPLOAD / MIX_COVER_TEMPLATE 모드용
// ============================================================

/** 업로드할 PDF 파일. File / Blob / Buffer / ReadStream 등 FormData 가 받을 수 있는 값. */
export type PdfFile = unknown;

export interface PdfUploadResult {
  /** 검증 결과 */
  valid?: boolean;
  /** 페이지 수 (내지 PDF) */
  pageCount?: number;
  /** 누적 페이지 메타 */
  pageMeta?: PageMeta;
  /** 검증 메시지 */
  messages?: string[];
  [extra: string]: unknown;
}

export class PdfsClient {
  /** 표지 PDF 신규 등록 (이미 있으면 409) */
  uploadCover(bookUid: string, file: PdfFile): Promise<PdfUploadResult>;
  /** 표지 PDF 교체 (없으면 404) */
  replaceCover(bookUid: string, file: PdfFile): Promise<PdfUploadResult>;
  /** 표지 PDF 바이너리 다운로드 */
  downloadCover(bookUid: string): Promise<Buffer | ArrayBuffer>;
  /** 내지 PDF 신규 등록 (이미 있으면 409) */
  uploadContents(bookUid: string, file: PdfFile): Promise<PdfUploadResult>;
  /** 내지 PDF 교체 (없으면 404) */
  replaceContents(bookUid: string, file: PdfFile): Promise<PdfUploadResult>;
  /** 내지 PDF 바이너리 다운로드 */
  downloadContents(bookUid: string): Promise<Buffer | ArrayBuffer>;
}

// ============================================================
// Photos / Credits — 향후 번들 대상, 현재는 느슨한 타입으로만 노출
// ============================================================

export interface PhotosClient {
  upload(
    bookUid: string,
    file: TemplateFile,
    options?: { preserveExif?: boolean },
  ): Promise<Record<string, unknown>>;
  list(bookUid: string): Promise<Record<string, unknown>>;
  delete(bookUid: string, fileName: string): Promise<unknown>;
}

export interface CreditsClient {
  getBalance(): Promise<Record<string, unknown>>;
  transactions(params?: {
    limit?: number;
    offset?: number;
    from?: string;
    to?: string;
  }): Promise<Record<string, unknown>>;
  sandboxCharge(amount: number, memo?: string): Promise<Record<string, unknown>>;
}

// ============================================================
// 메인 클라이언트 / 에러
// ============================================================

export class SweetbookClient {
  constructor(options: ClientOptions);
  readonly books: BooksClient;
  readonly covers: CoversClient;
  readonly contents: ContentsClient;
  readonly orders: OrdersClient;
  readonly photos: PhotosClient;
  readonly credits: CreditsClient;
  readonly pdfs: PdfsClient;
  readonly templates: TemplatesClient;
  readonly bookSpecs: BookSpecsClient;
}

export class SweetbookApiError extends Error {
  /** HTTP 상태 코드 */
  statusCode?: number;
  /** errorCode 식별자 (ERR_*) — 항상 존재 */
  errorCode?: ErrorCode | string | null;
  /** errors[] — 사용자 표시용 한글 메시지 배열 */
  details?: string[] | null;
  /** fieldErrors[] — 필드 단위 구조화 에러 */
  fieldErrors: FieldError[];
  /** data 필드 — 일반적으로 null, 일부 errorCode (INSUFFICIENT_CREDIT 등) 에서 진단 객체 */
  data?: unknown;
  /** 원본 Response 객체 */
  response?: Response;

  /** field 이름으로 FieldError 찾기 */
  fieldError(name: string): FieldError | null;
  /** errors[0] 또는 message fallback */
  userMessage(): string;
}

export class SweetbookNetworkError extends Error {
  cause?: unknown;
}

export class SweetbookValidationError extends Error {
  field?: string;
  constructor(message: string, field?: string);
}

export class ResponseParser {
  constructor(body: unknown);
  readonly success: boolean;
  getData(): unknown;
  getList(): unknown[];
  getDict(): Record<string, unknown>;
  getMeta(): Record<string, unknown>;
  getPagination(): Pagination | Record<string, unknown>;
  getErrorCode(): ErrorCode | string | null;
  getErrors(): string[];
  getFieldErrors(): FieldError[];
  getFieldError(field: string): FieldError | null;
  getPageMeta(): PageMeta | Record<string, never>;
}

// ============================================================
// 웹훅
// ============================================================

/**
 * 웹훅 서명 검증 (HMAC-SHA256).
 * @returns 유효하면 true, 아니면 false
 */
export function verifySignature(
  body: string | Buffer,
  signatureHeader: string,
  secret: string,
): boolean;
