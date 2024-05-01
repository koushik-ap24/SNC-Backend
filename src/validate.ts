import HTTPError from 'http-errors';
import xmljs from 'xml-js';

export const INTERNAL_SERVER_ERROR = 500;

/**
  * Checks if the given e-invoice string is in a readable xml format.
  * Throws a 500 Internal Server error if the invoice is blank or has unreadable syntax.
  *
  * @param invoice - a string of raw XML invoice data
*/
export function validate(invoice: string) {
  if (invoice.length == 0) {
    throw HTTPError(INTERNAL_SERVER_ERROR, 'The provided file is empty');
  }
  try {
    xmljs.xml2js(invoice, { compact: true });
  } catch (error) {
    throw HTTPError(INTERNAL_SERVER_ERROR, 'Please check syntax of the xml file');
  }
}
