import * as fs from 'fs';
import { getFileType, requestValidateSpecific } from '../testHelper';

// describe('test rulset "all" with various formats', () => {
//     test('valid and PDF', async () => {
//     });
//     test('valid and HTML', async () => {
//     });
//     test('valid and JSON', async () => {
//     });
//     test('valid and blank (JSON)', async () => {
//     });
// });

describe('EN16931 (business) rules', () => {
    test('valid_invoice successful', async () => {
        const file = './files/valid_invoice.xml';
        const validFilePath = fs.readFileSync(require.resolve(file), 'utf8');
        const validOutput = fs.readFileSync(require.resolve('./files/valid_invoice_business.json'), 'utf8');
        const parsedString = validOutput.replace(/@\{(\w+)\}/g, function (match, group) {
          if (group === 'currentdate') {
            return new Date().toISOString().split('T')[0];
          }
        });
        const report = await requestValidateSpecific(validFilePath, getFileType(file), 'AUNZ_UBL_1_0_10');
        expect(report).toStrictEqual(JSON.parse(parsedString));
    });

    test('bad_peppol_good_ubl successful', async () => {
        const file = './files/bad_peppol_good_ubl.xml';
        const validFilePath = fs.readFileSync(require.resolve(file), 'utf8');
        const validOutput = fs.readFileSync(require.resolve('./files/ubl_bad_peppol_good_ubl.json'), 'utf8');
        const parsedString = validOutput.replace(/@\{(\w+)\}/g, function (match, group) {
          if (group === 'currentdate') {
            return new Date().toISOString().split('T')[0];
          }
        });
        const report = await requestValidateSpecific(validFilePath, getFileType(file), 'AUNZ_UBL_1_0_10');
        expect(report).toStrictEqual(JSON.parse(parsedString));
    });

    test('bad_ubl_invoice unsuccessful', async () => {
        const file = './files/bad_ubl_invoice.xml';
        const validFilePath = fs.readFileSync(require.resolve(file), 'utf8');
        const validOutput = fs.readFileSync(require.resolve('./files/ubl_bad_ubl_invoice.json'), 'utf8');
        const parsedString = validOutput.replace(/@\{(\w+)\}/g, function (match, group) {
          if (group === 'currentdate') {
            return new Date().toISOString().split('T')[0];
          }
        });
        const report = await requestValidateSpecific(validFilePath, getFileType(file), 'AUNZ_UBL_1_0_10');
        expect(report).toStrictEqual(JSON.parse(parsedString));
    });
});

describe('PEPPOL rules', () => {
    test('valid_invoice successful', async () => {
        const file = './files/valid_invoice.xml';
        const validFilePath = fs.readFileSync(require.resolve(file), 'utf8');
        const validOutput = fs.readFileSync(require.resolve('./files/valid_invoice_peppol.json'), 'utf8');
        const parsedString = validOutput.replace(/@\{(\w+)\}/g, function (match, group) {
          if (group === 'currentdate') {
            return new Date().toISOString().split('T')[0];
          }
        });
        const report = await requestValidateSpecific(validFilePath, getFileType(file), 'AUNZ_PEPPOL_1_0_10');
        expect(report).toStrictEqual(JSON.parse(parsedString));
    });

    test('bad_peppol_good_ubl unsuccessful', async () => {
        const file = './files/bad_peppol_good_ubl.xml';
        const validFilePath = fs.readFileSync(require.resolve(file), 'utf8');
        const validOutput = fs.readFileSync(require.resolve('./files/peppol_bad_peppol_good_ubl.json'), 'utf8');
        const parsedString = validOutput.replace(/@\{(\w+)\}/g, function (match, group) {
          if (group === 'currentdate') {
            return new Date().toISOString().split('T')[0];
          }
        });
        const report = await requestValidateSpecific(validFilePath, getFileType(file), 'AUNZ_PEPPOL_1_0_10');
        expect(report).toStrictEqual(JSON.parse(parsedString));
    });

    test('bad_ubl_invoice successful', async () => {
        const file = './files/bad_ubl_invoice.xml';
        const validFilePath = fs.readFileSync(require.resolve(file), 'utf8');
        const validOutput = fs.readFileSync(require.resolve('./files/peppol_bad_ubl_invoice.json'), 'utf8');
        const parsedString = validOutput.replace(/@\{(\w+)\}/g, function (match, group) {
          if (group === 'currentdate') {
            return new Date().toISOString().split('T')[0];
          }
        });
        const report = await requestValidateSpecific(validFilePath, getFileType(file), 'AUNZ_PEPPOL_1_0_10');
        expect(report).toStrictEqual(JSON.parse(parsedString));
    });
});