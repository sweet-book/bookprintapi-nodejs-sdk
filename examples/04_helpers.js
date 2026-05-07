/**
 * 예제 4: SDK 헬퍼 (v0.3.0+) — createBookFromTemplate / uploadPdfAndOrder
 *
 * ⚠️  백엔드 실행 전제. SDK 를 브라우저/프론트엔드에 번들하지 마세요.
 *
 * 다단계 플로우(books → cover → contents → finalize) 를 한 호출로 처리.
 *
 * 실행:
 *   node examples/04_helpers.js template <coverTplUid> <contentTplUid> <photoPath>
 *   node examples/04_helpers.js pdf <coverPdfPath> <contentsPdfPath>
 */

require('dotenv/config');
const fs = require('node:fs');
const path = require('node:path');

const {
  SweetbookClient,
  SweetbookApiError,
  SweetbookHelperError,
  HelperStage,
  HelperErrorCodes,
  ErrorCodes,
} = require('../index');

const client = new SweetbookClient({
  apiKey: process.env.SWEETBOOK_API_KEY,
  environment: process.env.SWEETBOOK_ENV || 'sandbox',
});

async function cmdTemplate(args) {
  const [coverTpl, contentTpl, photoPath] = args;
  if (!coverTpl || !contentTpl || !photoPath) {
    console.log('사용법: node 04_helpers.js template <coverTplUid> <contentTplUid> <photoPath>');
    return;
  }
  if (!fs.existsSync(photoPath)) {
    console.error(`파일 없음: ${photoPath}`);
    process.exit(1);
  }

  // Node 18+ 의 File 타입 (또는 Blob/Buffer 도 가능)
  const photoBuf = fs.readFileSync(photoPath);
  const photoBlob = new Blob([photoBuf], { type: 'image/jpeg' });
  // SDK 는 File-like 객체에 name 속성을 사용하므로 Blob 에 name 부여 (Node 20+ File 객체 대안)
  Object.defineProperty(photoBlob, 'name', { value: path.basename(photoPath) });

  try {
    const result = await client.helpers.createBookFromTemplate({
      bookSpec: { uid: 'PHOTOBOOK_A4_SC' },
      cover: {
        templateUid: coverTpl,
        params: { title: 'Helpers 데모 책' },
        bindingFiles: { coverPhoto: photoBlob },
      },
      contents: [
        {
          templateUid: contentTpl,
          params: { text: '헬퍼 페이지 1' },
          bindingFiles: { mainPhoto: photoBlob },
        },
        {
          templateUid: contentTpl,
          params: { text: '헬퍼 페이지 2' },
          bindingFiles: { mainPhoto: photoBlob },
          breakBefore: 'page',
        },
      ],
      options: { title: 'Helpers 데모 책' },
    });

    console.log('='.repeat(50));
    console.log('  책 생성 완료');
    console.log('='.repeat(50));
    console.log(`  bookUid     : ${result.bookUid}`);
    console.log(`  cover page  : ${result.coverPageNum}`);
    console.log(`  내지 페이지 : ${result.contentPages.length}`);
    result.contentPages.forEach((p, i) => {
      console.log(`    [${i}] pageNum=${p.pageNum}, side=${p.pageSide}`);
    });
    console.log(`  finalized   : ${result.finalized}`);
    console.log(`  pageCount   : ${result.pageCount}`);
  } catch (e) {
    await handleHelperError(e);
  }
}

async function cmdPdf(args) {
  const [coverPdf, contentsPdf] = args;
  if (!coverPdf || !contentsPdf) {
    console.log('사용법: node 04_helpers.js pdf <coverPdfPath> <contentsPdfPath>');
    return;
  }
  for (const p of [coverPdf, contentsPdf]) {
    if (!fs.existsSync(p)) {
      console.error(`파일 없음: ${p}`);
      process.exit(1);
    }
  }

  const coverBuf = fs.readFileSync(coverPdf);
  const contentsBuf = fs.readFileSync(contentsPdf);
  const coverBlob = new Blob([coverBuf], { type: 'application/pdf' });
  const contentsBlob = new Blob([contentsBuf], { type: 'application/pdf' });
  Object.defineProperty(coverBlob, 'name', { value: path.basename(coverPdf) });
  Object.defineProperty(contentsBlob, 'name', { value: path.basename(contentsPdf) });

  try {
    const result = await client.helpers.uploadPdfAndOrder({
      bookSpec: { uid: 'PHOTOBOOK_A4_SC', pageCount: 24 },
      pdfs: { cover: coverBlob, contents: contentsBlob },
      order: {
        shipping: {
          recipientName: '홍길동',
          recipientPhone: '010-1234-5678',
          postalCode: '06100',
          address1: '서울특별시 강남구 테헤란로 123',
          address2: '4층',
        },
        quantity: 1,
        externalRef: 'HELPERS-DEMO-001',
      },
      options: { failOnInsufficientCredit: true },
    });

    console.log('='.repeat(50));
    console.log('  PDF 업로드 + 주문 완료');
    console.log('='.repeat(50));
    console.log(`  bookUid  : ${result.bookUid}`);
    console.log(`  orderUid : ${result.orderUid}`);
    console.log(`  finalized: ${result.finalized}`);
    if (result.estimate) {
      const ed = result.estimate.data ?? result.estimate;
      console.log(`  결제금액 : ${(ed.paidCreditAmount || 0).toLocaleString()}원`);
    }
  } catch (e) {
    await handleHelperError(e);
  }
}

async function handleHelperError(e) {
  if (!(e instanceof SweetbookHelperError)) {
    console.error('알 수 없는 오류:', e);
    process.exit(1);
  }

  console.log('='.repeat(50));
  console.log(`  헬퍼 실패 — stage=${e.stage}`);
  console.log('='.repeat(50));
  console.log(`  code      : ${e.code}`);
  console.log(`  bookUid   : ${e.bookUid}`);
  if (e.contentIndex !== null) {
    console.log(`  contentIdx: ${e.contentIndex}`);
  }
  console.log(`  message   : ${e.userMessage()}`);
  console.log(`  partial   : ${JSON.stringify(e.partial, null, 2)}`);
  if (e.cause) {
    console.log(`  cause     : ${e.cause.message}`);
    if (e.cause instanceof SweetbookApiError && e.cause.errorCode) {
      console.log(`  cause.code: ${e.cause.errorCode}`);
    }
  }

  // stage 기반 분기 — 11_sdk_helpers_design.md § 4.1 (자동 롤백 안 함) 정책
  if (e.stage === HelperStage.VALIDATION) {
    console.log('\n  → 클라이언트측 검증 실패. 입력 값 확인 후 재시도.');

  } else if (e.stage === HelperStage.CONTENT_INSERT) {
    console.log(`\n  → 페이지 #${e.contentIndex} 삽입 실패. 책(${e.bookUid})은 유지됨.`);
    console.log('     사용자에게 해당 페이지 재입력 후 contents.insert 직접 호출 권장.');

  } else if (e.stage === HelperStage.BOOK_FINALIZE) {
    const causeCode = e.cause instanceof SweetbookApiError ? e.cause.errorCode : null;
    if (causeCode === ErrorCodes.INSUFFICIENT_PAGES
        || causeCode === ErrorCodes.FINALIZE_PREREQ_UNMET) {
      console.log(`\n  → finalize 전제조건 미달. 책(${e.bookUid}) 유지. 페이지 추가 후 재시도.`);
    } else {
      console.log(`\n  → finalize 실패. 책(${e.bookUid}) 점검 후 재시도 또는 삭제.`);
    }

  } else if (e.stage === HelperStage.ORDER_ESTIMATE) {
    if (e.code === HelperErrorCodes.CREDIT_INSUFFICIENT) {
      console.log(`\n  → 충전금 부족. 주문 차단됨. 책(${e.bookUid})은 finalize 까지 완료.`);
      console.log('     충전 후 직접 orders.create 호출 가능 (책 재생성 불필요).');
    } else {
      console.log(`\n  → 견적 조회 실패. 책(${e.bookUid}) 유지.`);
    }

  } else if (e.stage === HelperStage.PDF_UPLOAD_COVER || e.stage === HelperStage.PDF_UPLOAD_CONTENTS) {
    console.log('\n  → PDF 업로드 실패. 파일 규격(456×303mm 등) 확인 후 재시도.');

  } else {
    // BOOK_CREATE / COVER_CREATE / ORDER_CREATE 등 — 책 폐기 권장
    if (e.bookUid) {
      console.log(`\n  → 책 폐기 (books.delete(${e.bookUid}))...`);
      try {
        await client.books.delete(e.bookUid);
        console.log('     OK — 정리 완료.');
      } catch (cleanupErr) {
        console.log(`     cleanup 실패 (수동 처리 필요): ${cleanupErr.message}`);
      }
    }
  }

  process.exit(1);
}

const COMMANDS = { template: cmdTemplate, pdf: cmdPdf };

async function main() {
  const cmd = process.argv[2];
  if (!cmd || cmd === '-h' || cmd === '--help') {
    console.log(`Commands: ${Object.keys(COMMANDS).join(', ')}`);
    console.log('  template <coverTplUid> <contentTplUid> <photoPath>');
    console.log('  pdf <coverPdfPath> <contentsPdfPath>');
    return;
  }
  const fn = COMMANDS[cmd];
  if (!fn) {
    console.error(`알 수 없는 명령: ${cmd}`);
    process.exit(1);
  }
  await fn(process.argv.slice(3));
}

main().catch(err => {
  console.error('알 수 없는 오류:', err);
  process.exit(1);
});
