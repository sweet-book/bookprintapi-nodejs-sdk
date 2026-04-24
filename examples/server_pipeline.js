/**
 * BookPrintAPI SDK — Server Pipeline Example
 *
 * ⚠️  이 예제는 **백엔드(Node 서버) 프로세스에서 실행되는 것을 전제**합니다.
 *     SDK를 브라우저/프론트엔드 앱에 번들하지 마세요 — API Key가 노출됩니다.
 *     권장 구조:  브라우저 → 파트너 백엔드(이 파일) → BookPrint API
 *
 * 실제 서비스에서는 이 로직을 큐(BullMQ, Agenda 등)나 스케줄러에서 실행합니다.
 *
 * 사용법:
 *     node examples/server_pipeline.js
 *
 * 흐름 (시퀀스):
 *    파트너 백엔드                       BookPrint API
 *    ─────────                            ─────────────
 * [1] 충전금 확인        GET  /credits/balance
 * [2] 책 생성 (draft)    POST /books
 * [3] 표지 사진 업로드    POST /books/{uid}/photos
 *     표지 생성          POST /books/{uid}/cover
 * [4] 간지 + 내지 loop   POST /books/{uid}/contents  (반복)
 * [5] 최소 페이지 패딩    POST /books/{uid}/contents  (빈내지)
 * [6] 발행면 삽입         POST /books/{uid}/contents
 * [7] 책 확정             POST /books/{uid}/finalize  (부족 시 재시도)
 * [8] 가격 견적           POST /orders/estimate
 * [9] 주문 생성           POST /orders
 * [10] 주문 상태 확인     GET  /orders/{uid}
 *
 * 환경변수:
 *     SWEETBOOK_API_KEY   API Key (필수)
 *     SWEETBOOK_ENV       sandbox | live (기본: sandbox)
 */

require('dotenv/config');
const path = require('path');
const { SweetbookClient } = require('../index');

// ── 설정 ──
// 실제 서비스에서는 이 값들을 DB나 설정 파일에서 가져옵니다.
const BOOK_SPEC = 'SQUAREBOOK_HC';
const MIN_PAGES = 24;

// 일기장A 템플릿 UIDs (예시)
const TPL_COVER = '79yjMH3qRPly';
const TPL_GANJI = '5M3oo7GlWKGO';
const TPL_NAEJI = '5B4ds6i0Rywx';       // 텍스트 전용 내지
const TPL_PUBLISH = '5nhOVBjTnIVE';
const TPL_BLANK = '2mi1ao0Z4Vxl';

// 샘플 데이터 (실제로는 DB에서 조회)
const SAMPLE_ENTRIES = Array.from({ length: 15 }, (_, i) => ({
  month: '1',
  day: String(i + 1),
  text: `1월 ${i + 1}일의 일기입니다. 오늘도 좋은 하루였습니다.`,
}));

const SHIPPING = {
  recipientName: '홍길동',
  recipientPhone: '010-1234-5678',
  postalCode: '06100',
  address1: '서울특별시 강남구 테헤란로 123',
  address2: '4층',
  shippingMemo: '부재 시 경비실',
};

function log(step, msg) {
  console.log(`  [${step}] ${msg}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runPipeline() {
  const client = new SweetbookClient({
    apiKey: process.env.SWEETBOOK_API_KEY,
    environment: process.env.SWEETBOOK_ENV || 'sandbox',
  });

  console.log('='.repeat(60));
  console.log('  BookPrintAPI 서버 파이프라인');
  console.log('='.repeat(60));

  // 1. 충전금 확인
  log('1', '충전금 확인...');
  const credit = await client.credits.getBalance();
  const balance = credit.balance ?? credit.data?.balance ?? 0;
  log('1', `잔액: ${balance.toLocaleString()}원`);
  if (balance <= 0) {
    log('1', '충전금 부족! 파이프라인 중단.');
    return;
  }

  // 2. 책 생성
  log('2', '책 생성...');
  const book = await client.books.create({
    bookSpecUid: BOOK_SPEC,
    title: '서버 파이프라인 테스트',
    creationType: 'TEMPLATE',
    externalRef: 'PIPELINE-001',
  });
  const bookUid = book.bookUid || book.uid || book.data?.bookUid;
  log('2', `bookUid: ${bookUid}`);

  // 3. 표지
  // 3a. 표지 사진 업로드
  log('3', '표지 사진 업로드...');
  const samplePhoto = path.join(__dirname, 'sample_photo.jpg');
  const upload = await client.photos.upload(bookUid, samplePhoto);
  const photoName = upload.fileName || upload.data?.fileName;
  log('3', `업로드 완료: ${photoName}`);

  // 3b. 표지 생성
  log('3', '표지 생성...');
  await client.covers.create(bookUid, TPL_COVER, {
    title: '나의 일기장',
    dateRange: '2026.01 - 2026.01',
    coverPhoto: photoName,
  });
  log('3', '표지 완료');
  await sleep(500);

  // 4. 간지 + 내지
  log('4', '내지 삽입 시작...');

  // 간지
  await client.contents.insert(bookUid, TPL_GANJI, {
    year: '2026',
    monthTitle: '1월',
    chapterNum: '1',
    season_title: '겨울',
  });
  log('4', '간지 삽입');
  await sleep(500);

  // 내지 (텍스트)
  for (let i = 0; i < SAMPLE_ENTRIES.length; i++) {
    const entry = SAMPLE_ENTRIES[i];
    await client.contents.insert(bookUid, TPL_NAEJI, {
      monthNum: entry.month,
      dayNum: entry.day,
      diaryText: entry.text,
    });
    log('4', `내지 ${i + 1}/${SAMPLE_ENTRIES.length}`);
    await sleep(500);
  }

  // 5. 빈내지 패딩
  // 간지(2p) + 내지15개(15p) = 17p → 최소24p까지 빈내지 추가 + 발행면(1p) 여유
  const paddingNeeded = 6; // 24 - 17 - 1(발행면) = 6p
  log('5', `빈내지 ${paddingNeeded}장 추가...`);
  for (let i = 0; i < paddingNeeded; i++) {
    await client.contents.insert(bookUid, TPL_BLANK, {}, { breakBefore: 'page' });
    log('5', `빈내지 ${i + 1}/${paddingNeeded}`);
    await sleep(500);
  }

  // 6. 발행면
  log('6', '발행면 삽입...');
  await client.contents.insert(bookUid, TPL_PUBLISH, {
    title: '나의 일기장',
    publishDate: '2026.03.16',
    author: '홍길동',
  });
  log('6', '발행면 완료');
  await sleep(500);

  // 7. 확정 (페이지 부족 시 빈내지 추가 후 재시도)
  log('7', '책 확정...');
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const fin = await client.books.finalize(bookUid);
      const finalPages = fin.pageCount ?? fin.data?.pageCount ?? '?';
      log('7', `확정 완료! ${finalPages}p`);
      break;
    } catch (e) {
      const detail = JSON.stringify(e.details || '');
      if (detail.includes('최소 페이지 미달')) {
        log('7', `페이지 부족 — 빈내지 4장 추가 후 재시도 (${attempt + 1})`);
        for (let k = 0; k < 4; k++) {
          await client.contents.insert(bookUid, TPL_BLANK, {}, { breakBefore: 'page' });
          await sleep(500);
        }
      } else {
        throw e;
      }
    }
  }

  // 8. 견적
  log('8', '가격 견적...');
  const estimate = await client.orders.estimate({
    items: [{ bookUid, quantity: 1 }],
  });
  const est = estimate.data || estimate;
  const paid = est.paidCreditAmount || 0;
  log('8', `결제금액: ${paid.toLocaleString()}원 (VAT 포함)`);

  if (!est.creditSufficient) {
    log('8', '충전금 부족! 주문 불가.');
    return;
  }

  // 9. 주문
  log('9', '주문 생성...');
  const order = await client.orders.create({
    items: [{ bookUid, quantity: 1 }],
    shipping: SHIPPING,
    externalRef: 'PIPELINE-001',
  });
  const orderData = order.data || order;
  const orderUid = orderData.orderUid;
  log('9', `주문번호: ${orderUid}`);
  log('9', `결제: ${(orderData.paidCreditAmount || 0).toLocaleString()}원`);

  // 10. 주문 확인
  log('10', '주문 상태 확인...');
  const detail = await client.orders.get(orderUid);
  const d = detail.data || detail;
  log('10', `상태: ${d.orderStatusDisplay || d.status} (${d.orderStatus})`);
  log('10', `수령인: ${d.recipientName}`);

  console.log();
  console.log('='.repeat(60));
  console.log('  파이프라인 완료!');
  console.log(`  bookUid:  ${bookUid}`);
  console.log(`  orderUid: ${orderUid}`);
  console.log(`  결제금액: ${(d.paidCreditAmount || 0).toLocaleString()}원`);
  console.log('='.repeat(60));

  // 테스트이므로 취소
  console.log();
  log('cleanup', '테스트 주문 취소 중...');
  await client.orders.cancel(orderUid, '파이프라인 테스트 완료');
  const credit2 = await client.credits.getBalance();
  const balance2 = credit2.balance ?? credit2.data?.balance ?? 0;
  log('cleanup', `충전금 복원: ${balance2.toLocaleString()}원`);
}

runPipeline().catch((err) => {
  console.error('\n오류:', err.message);
  if (err.details) {
    for (const d of err.details) console.error(`  - ${JSON.stringify(d)}`);
  }
  process.exit(1);
});
