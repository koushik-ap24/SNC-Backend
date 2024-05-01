import axios from 'axios';
import config from '../config.json';

const port = config.port;
const url = config.url;
const BAD_REQUEST = 400;

/**
  * Makes a request to the server to validate an e-invoice.
  *
  * @param invoice - a string of raw XML invoice data
  * @param type - a string denoting the file extension type of the given invoice
  *
  * @returns request response data, or the error status code if there is an exception
*/
export async function requestValidate(invoice: string, type: string) {
  try {
    if (type == '') {
      return BAD_REQUEST;
    }

    // Define Axios request configuration
    const axiosConfig = {
      method: 'post',
      url: `${url}:${port}/validate`,
      headers: {
        'Content-Type': 'application/' + type,
      },
      data: invoice,
      timeout: 5000
    };

    const res = await axios(axiosConfig);
    return res.data;
  } catch (error) {
    // If an Axios error is caught
    return error.response.status;
  }
}

/**
  * Makes a request to the server to validate an e-invoice.
  *
  * @param invoice - a string of raw XML invoice data
  * @param type - a string denoting the file extension type of the given invoice
  * @param rule - a string denoting the rule chosen by the user to validate the invoice against
  *
  * @returns request response data, or the error status code if there is an exception
*/
export async function requestValidateSpecific(invoice: string, type: string, rule: string) {
  try {
    if (type == '') {
      return BAD_REQUEST;
    }

    // Define Axios request configuration
    const axiosConfig = {
      method: 'post',
      url: `${url}:${port}/validate/specific`,
      headers: {
        'Content-Type': 'application/' + type,
        'rule': rule,
      },
      data: invoice,
    };

    const res = await axios(axiosConfig);
    return res.data;
  } catch (error) {
    // If an Axios error is caught
    
    return error.response.status;
  }
}


/**
  * A helper function that returns the file format of the given file.
  * Returns an empty string if no file extension is found in the filename. 
  *
  * @param filename - the filename of the e-invoice
  *
  * @returns a string denoting the file format of the given file
*/
export function getFileType(filename: string) {
  // Get the index of the last dot in the filename
  const dotIndex = filename.lastIndexOf('.');
  const slashIndex = filename.lastIndexOf('/');

  // Check if a dot was found and it's not the last character
  if (dotIndex !== -1 && slashIndex < dotIndex && dotIndex < filename.length - 1) {
      // Extract the substring after the last dot
      return filename.substring(dotIndex + 1);
  } else {
      // If no dot was found or it's the last character, return an empty string
      return '';
  }
}
