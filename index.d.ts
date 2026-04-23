/// <reference types="node" />
/**
 * Sweetbook Node.js SDK — TypeScript 타입 정의
 *
 * 핵심 도메인: Books / Covers / Contents / Orders
 * (Photos / Credits / Webhook 타입은 향후 번들에서 추가 예정)
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

/** 템플릿 파라미터. 서버에서 Dictionary<string, object> 로 받음. */
export type TemplateParameters = Record<string, unknown>;

/** 템플릿에 첨부하는 파일. Blob / Buffer / ReadStream 등 FormData 가 받을 수 있는 값. */
export type TemplateFile = unknown;

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

/**
 * C04 이후 책 관련 응답에 동봉되는 페이지 메타. `isValid` 가 true 면
 * 페이지 규칙상 finalize 가능 (그 외 전제조건(DRAFT·PDF 업로드 등)은 별도).
 */
export interface PageMeta {
  /** 현재 누적 내지 페이지 수 (표지 제외, 음수 방어 적용) */
  currentPageCount: number;
  /** BookSpec 기준 최소 페이지 수 */
  pageMin: number;
  /** BookSpec 기준 최대 페이지 수 */
  pageMax: number;
  /** 페이지 증분 단위 */
  pageIncrement: number;
  /** `pageMin ≤ current ≤ pageMax && (current - pageMin) % pageIncrement === 0` */
  isValid: boolean;
}

export interface BookCreateResponse {
  bookUid: string;
  /** C04: POST /books 응답에 동봉. 생성 직후엔 BookSpec 미조회로 모든 값 0 가능 */
  pageMeta?: PageMeta;
}

/** C04 신규 엔드포인트 `GET /books/{uid}` 응답 (단건 조회 풀셋) */
export interface BookDetailResponse {
  bookUid: string;
  accountUid?: string | null;
  title: string;
  bookSpecUid: string;
  bookSpecName?: string | null;
  specProfileUid?: string | null;
  creationType: CreationType | string;
  /** 숫자 상태 코드 (1=draft, 2=finalized 등) */
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

export interface BooksListResult {
  books: BookListItem[];
  pagination: Pagination;
}

export interface BookListParams {
  status?: string;
  limit?: number;
  offset?: number;
}

export interface BookFinalizationResponse {
  result: string;
  /** C04: 기존 `pageCount` 대체 */
  pageMeta: PageMeta;
  finalizedAt: string;
}

export class BooksClient {
  list(params?: BookListParams): Promise<BooksListResult>;
  create(data: BookCreateRequest): Promise<BookCreateResponse>;
  /** C04 이후 신규 `GET /books/{uid}` 엔드포인트 호출 — 단건 풀셋 응답 */
  get(bookUid: string): Promise<BookDetailResponse>;
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

/** 주문 상태 문자열 enum (C19 이후 서버 응답) */
export type OrderStatus =
  | "PAID_AWAITING_CONTENT"
  | "PAID"
  | "PDF_READY"
  | "CONFIRMED"
  | "IN_PRODUCTION"
  | "COMPLETED"
  | "PRODUCTION_COMPLETE"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "CANCELLED_REFUND"
  | "ERROR";

/** 항목 상태 문자열 enum — Order 와 겹치는 값 집합 */
export type OrderItemStatus = OrderStatus;

export interface OrderListItem {
  orderUid: string;
  accountUid: string;
  orderType: string;
  externalRef?: string | null;
  orderStatus: OrderStatus;
  /** 관리자 응답에만 포함되는 숫자 코드 (20, 25, 30, ...) */
  orderStatusCode?: number;
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
 * C19 평탄화 이후 `GET /orders` 응답 매핑.
 * SDK 는 편의를 위해 `data` 배열을 `orders` 키로 감싸서 반환.
 */
export interface OrderListResponse {
  orders: OrderListItem[];
  pagination: Pagination;
}

export interface OrderListParams {
  limit?: number;
  offset?: number;
  /** C19 이후 문자열 enum. 숫자도 서버가 허용하면 통과하지만 권장은 enum */
  status?: OrderStatus | string;
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
  itemStatus: OrderItemStatus;
  /** 관리자 응답에만 포함 */
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
  orderStatus: OrderStatus;
  /** 관리자 응답에만 포함 */
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
// Templates — 목록/상세 조회 (읽기 전용)
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

export class TemplatesClient {
  list(params?: TemplateListParams): Promise<TemplatesListResult>;
  get(templateUid: string, options?: { accountUid?: string }): Promise<TemplateDetail>;
}

// ============================================================
// PDFs — PDF_UPLOAD / MIX_COVER_TEMPLATE 모드용
// ============================================================

/** 업로드할 PDF 파일. File / Blob / Buffer / ReadStream 등 FormData 가 받을 수 있는 값. */
export type PdfFile = unknown;

export interface PdfUploadResult {
  /** 검증 결과 */
  valid?: boolean;
  /** C04: 기존 `pageCount` 대체. 업로드 후 반영된 책 페이지 메타 */
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
  /** 서버 error_code (있는 경우) */
  errorCode?: string | null;
  /** ApiResponse.Fail 의 errors 배열 (또는 legacy error.details) */
  details?: string[] | unknown | null;
  /** 원본 Response 객체 */
  response?: Response;
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
  getData(): unknown;
  getDict(): Record<string, unknown>;
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
