import * as fs from 'fs';
import { requestValidate, getFileType } from '../testHelper';

const INTERNAL_SERVER_ERROR = 500;

describe('error cases', () => {
  test('mismatched tags syntax', async () => {
    const file = './files/invalid_invoice.xml';
    const validFilePath = fs.readFileSync(require.resolve(file), 'utf8');
    const report = await requestValidate(validFilePath, getFileType(file));
    expect(report).toStrictEqual(INTERNAL_SERVER_ERROR);
  });

  test('Invoice is a blank xml file', async () => {
    const file  = './files/blank.xml';
    const blankInvoice = fs.readFileSync(require.resolve(file), 'utf-8');
    const report = await requestValidate(blankInvoice, getFileType(file));
    expect(report).toStrictEqual(INTERNAL_SERVER_ERROR);
  });

  test('misnamed tags', async () => {
    const file = './files/bad_ubl_invoice.xml';
    const validFilePath = fs.readFileSync(require.resolve(file), 'utf8');
    const validOutput = fs.readFileSync(require.resolve('./files/bad_ubl_invoice.json'), 'utf8');
    const parsedString = validOutput.replace(/@\{(\w+)\}/g, function (match, group) {
      if (group === 'currentdate') {
        return new Date().toISOString().split('T')[0];
      }
    });
    const report = await requestValidate(validFilePath, getFileType(file));
    expect(report).toStrictEqual(JSON.parse(parsedString));
  });
});

describe('success cases', () => {
  test('successful validation of valid_invoice', async () => {
    const file = './files/valid_invoice.xml';
    const validFilePath = fs.readFileSync(require.resolve(file), 'utf8');
    const validOutput = fs.readFileSync(require.resolve('./files/valid_invoice.json'), 'utf8');
    const parsedString = validOutput.replace(/@\{(\w+)\}/g, function (match, group) {
      if (group === 'currentdate') {
        return new Date().toISOString().split('T')[0];
      }
    });
    const report = await requestValidate(validFilePath, getFileType(file));
    expect(report).toStrictEqual(JSON.parse(parsedString));
});

  test('successful validation of valid_energy_invoice', async () => {
    const file = './files/valid_energy_invoice.xml';
    const validFilePath = fs.readFileSync(require.resolve(file), 'utf8');
    const validOutput = fs.readFileSync(require.resolve('./files/valid_energy_invoice.json'), 'utf8');
    const parsedString = validOutput.replace(/@\{(\w+)\}/g, function (match, group) {
      if (group === 'currentdate') {
        return new Date().toISOString().split('T')[0];
      }
    });
    const report = await requestValidate(validFilePath, getFileType(file));
    expect(report).toStrictEqual(JSON.parse(parsedString));
  });
});
