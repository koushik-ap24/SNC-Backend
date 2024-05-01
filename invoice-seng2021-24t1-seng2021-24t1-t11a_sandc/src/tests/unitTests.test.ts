import { validate } from '../validate';
import * as fs from 'fs';

describe('Test validate function', () => {
  test('Valid invoice is passed to the validate function', () => {
    const validInvoice = fs.readFileSync(require.resolve('./files/valid_invoice.xml'), 'utf-8');
    expect(validate(validInvoice)).toStrictEqual(undefined);
  });

  test('Invoice with syntax errors is passed to the validate function', () => {
    const validInvoice = fs.readFileSync(require.resolve('./files/invalid_invoice.xml'), 'utf-8');
    expect(() => {
      validate(validInvoice);
    }).toThrow();
  });

  test('Blank xml invoice is passed to the validate function', () => {
    const blankInvoice = fs.readFileSync(require.resolve('./files/blank.xml'), 'utf-8');
    expect(() => {
      validate(blankInvoice);
    }).toThrow();
  });
});
