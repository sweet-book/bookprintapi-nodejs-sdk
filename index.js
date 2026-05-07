/**
 * Sweetbook Node.js SDK
 *
 * Usage:
 *   const { SweetbookClient, verifySignature } = require('bookprintapi-nodejs-sdk');
 *
 *   const client = new SweetbookClient({ apiKey: 'SB...' });
 *   const book = await client.books.create({ bookSpecUid: 'SQUAREBOOK_HC', title: 'My Book' });
 */

const { SweetbookClient, HelpersClient } = require('./lib/client');
const {
  FieldError,
  SweetbookApiError,
  SweetbookNetworkError,
  SweetbookValidationError,
  SweetbookHelperError,
  HelperStage,
  HelperErrorCodes,
  ResponseParser,
} = require('./lib/core');
const { ErrorCodes, ConstraintTypes } = require('./lib/errorcodes');
const { OrderStatus, ORDER_STATUS_CODE, ORDER_STATUS_FROM_CODE } = require('./lib/order_status');
const { verifySignature } = require('./lib/webhook');

module.exports = {
  SweetbookClient,
  HelpersClient,
  FieldError,
  SweetbookApiError,
  SweetbookNetworkError,
  SweetbookValidationError,
  SweetbookHelperError,
  HelperStage,
  HelperErrorCodes,
  ResponseParser,
  ErrorCodes,
  ConstraintTypes,
  OrderStatus,
  ORDER_STATUS_CODE,
  ORDER_STATUS_FROM_CODE,
  verifySignature,
};
