import { requestValidate, getFileType } from '../testHelper';
import * as fs from 'fs';

const BAD_REQUEST = 400;

describe('Test invalid invoice format', () => {
  test('Test invoice in PDF format', async () => {
    const file = './files/pdf_invoice.pdf';
    const invalidInvoice = fs.readFileSync(require.resolve(file), 'utf-8');
    const report = await requestValidate(invalidInvoice, getFileType(file));
    expect(report).toStrictEqual(BAD_REQUEST);
  });

  test('Test invoice in CSV format', async () => {
    const file = './files/csv_invoice.csv';
    const invalidInvoice = fs.readFileSync(require.resolve(file), 'utf-8');
    const report = await requestValidate(invalidInvoice, getFileType(file));
    expect(report).toStrictEqual(BAD_REQUEST);
  });

  test('Test invoice in XLS format', async () => {
    const file = './files/xls_invoice.xls';
    const invalidInvoice = fs.readFileSync(require.resolve(file), 'utf-8');
    const report = await requestValidate(invalidInvoice, getFileType(file));
    expect(report).toStrictEqual(BAD_REQUEST);
  });

  test('Test invoice in JSON format', async () => {
    const file = './files/valid_invoice.json';
    const invalidInvoice = fs.readFileSync(require.resolve(file), 'utf-8');
    const report = await requestValidate(JSON.stringify(invalidInvoice), 'json');
    expect(report).toStrictEqual(BAD_REQUEST);
  });

  test('Test invoice with no file extension in its filename', async () => {
    const file = './files/noDot';
    const invalidInvoice = fs.readFileSync(require.resolve(file), 'utf-8');
    const report = await requestValidate(invalidInvoice, getFileType(file));
    expect(report).toStrictEqual(BAD_REQUEST);
  });
});
