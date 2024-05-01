import axios from 'axios';
import config from '../config.json';
import * as fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import { INTERNAL_SERVER_ERROR, validate } from './validate';
import HTTPError from 'http-errors';
import { BAD_REQUEST, JWT_SECRET } from './server';
import * as crypto from 'crypto';
import officegen from 'officegen';
import jwt from 'jsonwebtoken';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
  * Generates an authentication token.
  * Throws an error if unsuccessful in obtaining the token.
  *
  * @returns a token
*/
export async function getToken() {
  try {
    // Define the authentication data
    const authPostData = {
      grant_type: 'client_credentials',
      client_id: '7d30bi87iptegbrf2bp37p42gg',
      client_secret: '880tema3rvh3h63j4nquvgoh0lgts11n09bq8597fgrkvvd62su',
      scope: 'eat/read'
    };

    // Make the POST request to obtain the token
    const authResponse = await axios.post(config.authURL, authPostData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    // Return the token from the response
    return authResponse.data.access_token;
  } catch (error) {
    // Handle errors
    console.error('Error obtaining token:', error);
    throw error;
  }
}

/**
  * Generates a validation report based on ESS Validator API data.
  *
  * @param essReport - the raw response data returned from an ESS Validator request
  *
  * @returns the report as a JSON object
*/
export function createReport(essReport, rules: string | string[]) {
  const report = {
    'issueDate (YYYY-MM-DD)': new Date().toISOString().split('T')[0],
    successful: essReport.successful,
    summary: essReport.message,
    totalErrorCount: essReport.report.firedAssertionErrorsCount,
    results: {} // Initialize an empty results object
  };

  let rulesets;
  if (typeof rules == 'string') {
    rulesets = rules.split(',');
  } else {
    rulesets = rules;
  }
  
  // Loop through each ruleset and construct the results object dynamically
  for (const ruleset of rulesets) {
    let resultVal;
    if (ruleset == 'AUNZ_UBL_1_0_10') {
      resultVal = 'EN16931_Syntax';
    } else {
      resultVal = 'AUNZ_PEPPOL';
    }

    report.results[resultVal] = {
      successful: essReport.report.reports[ruleset].successful,
      summary: essReport.report.reports[ruleset].summary,
      errorCodes: essReport.report.reports[ruleset].firedAssertionErrorCodes,
      errors: [] as { id: string; breached_rule: string; location: string }[]
    };

    // Loop through the fired assertion errors for the current ruleset
    for (const element of essReport.report.reports[ruleset].firedAssertionErrors) {
      const newError = {
        id: element.id,
        breached_rule: element.text,
        location: element.location
      };
      report.results[resultVal].errors.push(newError);
    }
  }

  return report;
}

/**
  * Deletes all received invoices.
  * @returns nothing
*/
export function clearFolder() {
  // Read the contents of the folder
  const folderPath = '/tmp';
  fs.readdir(folderPath, (err, files) => {
      if (err) {
          console.error('Error reading folder:', err);
          return;
      }

      // Iterate over each file in the folder
      files.forEach(file => {
          // Construct the full path to the file
          const filePath = path.join(folderPath, file);

          // Delete the file
          fs.unlink(filePath, err => {
              if (err) {
                  console.error('Error deleting file:', filePath, err);
              }
          });
      });
  });
}

export async function reportFormatController(res, report, format, fileName) {
  let fileContent;
  const path = "/tmp/output." + format; 

  switch(format) {
    case 'pdf':
      fileContent = await generatePDF(report, path);
      res.setHeader('Content-Type', 'application/pdf');
      break;
    case 'html':
      fileContent = generateHTML(report, fileName);
      res.setHeader('Content-Type', 'text/html');
      break;
    case 'docx':
      fileContent = await generateDocx(report, path);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      break;
    case 'json':
      fileContent = report;
      res.setHeader('Content-Type', 'application/json');
      break;
    default:
      throw HTTPError(INTERNAL_SERVER_ERROR, 'Invalid output type');
  }

  res.setHeader('Content-Disposition', 'attachment; filename=report.' + format);

  return fileContent;
}

async function generatePDF(report, outputPath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    // outputPath = path.join(__dirname,outputPath);
    const outputStream = fs.createWriteStream(outputPath);

    doc.pipe(outputStream);

    // Add content to the PDF document
    doc.fontSize(15).text(JSON.stringify(report, null, 2));

    // Finalize the PDF document
    doc.end();

    outputStream.on('finish', () => {
      resolve(outputPath); // Resolve with the file path once writing is complete
    });

    outputStream.on('error', (error) => {
      reject(error); // Reject with the error if file writing fails
    });
  });
  
}

function generateHTML(report, fileName) {
  return `
      <!DOCTYPE html>
      <html>
      <head>
          <title>Validation Report for ${fileName}</title>
      </head>
      <body>
          <p>${JSON.stringify(report, null, 2)}</p>
      </body>
      </html>
  `;
}

async function generateDocx(report, outputPath) {
  return new Promise((resolve, reject) => {
    // Create a new OfficeGen docx object
    const docx = officegen('docx');

    // Create a new paragraph
    const pObj = docx.createP();

    // Loop through the object properties and add them to the document
    Object.entries(report).forEach(([key, value]) => {
        // Add key-value pairs to the paragraph
        pObj.addText(`${key}: ${JSON.stringify(value, null, 2)}`);
        // Add a line break
        pObj.addLineBreak();
    });

    // Finish creating the document
    pObj.addText('Generated by S&C Ltd');

    // Create a writable stream to save the document
    // outputPath = path.join(__dirname,outputPath);
    const outputStream = fs.createWriteStream(outputPath);

    // Pipe the docx object to the output stream
    docx.generate(outputStream);

    outputStream.on('finish', () => {
      resolve(outputPath); // Resolve with the file path once writing is complete
    });

    outputStream.on('error', (error) => {
      reject(error); // Reject with the error if file writing fails
    });
  });
}


export async function requestHelper(req, res, rules) {
  if (req.file == null) {
    throw HTTPError(BAD_REQUEST, 'Please upload an xml file.');
  }
  if (req.file.mimetype !== 'application/xml' && req.file.mimetype !== 'text/xml') {
    throw HTTPError(BAD_REQUEST, 'Please input a xml file. Other file types are not accepted!');
  }
  
  const format = req.headers['format'];

  const folderPath = '/tmp';
  const fullPath = path.join(folderPath, req.file.originalname);
  const rawXmlData = fs.readFileSync(require.resolve(fullPath), 'utf8');
  const encodedData = Buffer.from(rawXmlData).toString('base64');
  const checksum = crypto.createHash('md5').update(encodedData).digest('hex');

  const apiPostData = {
    filename: req.file.originalname,
    content: encodedData,
    checksum: checksum
  };

  // Next iteration: add customerName by extracting it from the invoice.
  const apiQueryData = {
    rules: rules,
  };

  // Conduct Welformedness check on the invoice
  validate(rawXmlData);

  // Send Request to ESS Validator to validate given invoice
  const token = await getToken();
  const apiResponse = await axios.post('https://services.ebusiness-cloud.com/ess-schematron/v1/api/validate', apiPostData, {
    params: apiQueryData,
    headers: {
      'Authorization': 'Bearer ' + token,
      'Accept-Language': 'en'
    }
  });

  return reportFormatController(res, createReport(apiResponse.data, rules), format, req.file.filename);

}

// Function to generate JWT token
export function generateUserToken(username) {
    const payload = {
        username: username,
    };

    // Sign the token with a secret key and set expiration (optional)
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '3d' });
    
    return token;
}

// Authentication middleware
export function authenticateToken(req) {
  const token = req.header('Authorization');
  if (!token) throw HTTPError(400, 'Access token must be included in request!');

  try {
      const decoded = jwt.verify(token, JWT_SECRET);
      return decoded.username;
  } catch (error) {
    throw HTTPError(403, 'Access denied. Please sign in or register an account');
  }
}

export async function apiAuthHelper(requestType, username, password, firstName, lastName) {
  const renderApiRegisterRoute = 'http://rendering.ap-southeast-2.elasticbeanstalk.com/user/register';
  const renderApiLoginRoute = 'http://rendering.ap-southeast-2.elasticbeanstalk.com/user/login';

  const tokens = {
    'renderAPI': ''
  }
  let renderApiRoute;
  if (requestType == 'register') {
    renderApiRoute = renderApiRegisterRoute;
  } else {
    renderApiRoute = renderApiLoginRoute;
  }

  const renderFormData = {
    'email': username + '@example.com',
    'password': password,
    'nameFirst': firstName,
    'nameLast': lastName
  };

  const urlEncodedFormData = Object.keys(renderFormData)
  .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(renderFormData[key]))
  .join('&');

  try {
    const response = await axios.post(renderApiRoute, urlEncodedFormData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    // Extract the token attribute from the JSON response
    tokens.renderAPI = response.data.token;

  } catch (error) {
    if (error.response && error.response.status === 400 && renderApiRoute == renderApiRegisterRoute) {
      const response = await axios.post(renderApiLoginRoute, urlEncodedFormData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
  
      // Extract the token attribute from the JSON response
      tokens.renderAPI = response.data.token;
    } else {
      // Something happened in setting up the request that triggered an error
      console.error('Error:', error);
    }
  }

  return tokens;

}

export async function routeAuthFlow(req, UserModel) {
  // Get the user's username from the request body
  const username = authenticateToken(req);

  // Find the user by username
  const user = await UserModel.findOne({ username });

  if (!user) {
    throw HTTPError(401, 'User not found');
  }

  return user;
}

export async function generateDownloadLink(user, fileName, s3) {
  const fileObj = user.uploadedFiles.find(file => file.fileName === fileName);
  if (!fileObj) {
    throw HTTPError(400, 'File not found');
  }

  const fileKey = fileObj.fileKey;

  // Define parameters for the getObject command
  const getObjectParams = {
    Bucket: 'seng2021-sandc',
    Key: fileKey,
    ResponseContentDisposition: `attachment; filename="${fileName}"`
  };

  const command = new GetObjectCommand(getObjectParams);
  const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
  return url;
}


