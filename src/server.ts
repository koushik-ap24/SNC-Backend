import express, { json } from 'express';
import { Request, Response } from 'express';
import errorHandler from 'middleware-http-errors';
import morgan from 'morgan';
import config from '../config.json';
import cors from 'cors';
import axios from 'axios';
import { getToken, createReport, clearFolder, requestHelper, generateUserToken, authenticateToken, apiAuthHelper, routeAuthFlow, generateDownloadLink } from './serverHelpers';
import { validate } from './validate';
import * as crypto from 'crypto';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import UserModel from './models/User';
import { Upload } from '@aws-sdk/lib-storage';
import { S3 } from '@aws-sdk/client-s3';
import { config as dotenvConfig } from 'dotenv';
dotenvConfig();
// const UserModel = require('./models/User');
// const AWS = require('aws-sdk');
// require('dotenv').config();

export const BAD_REQUEST = 400;
const INTERNAL_SERVER_ERROR = 500;
const UNAUTHORIZED = 401;
const FORBIDDEN = 403;
const DEFAULT_RULESET = 'AUNZ_PEPPOL_1_0_10,AUNZ_UBL_1_0_10';
const dbURL = process.env.DB_URL;

// Set up web app
const app = express();
// Use middleware that allows us to access the JSON body of requests
app.use(json());
// Use middleware that allows for access from other domains

app.use(cors({
  exposedHeaders: ['X-Error-Message'],
  credentials: true
}));

// For logging errors (print to terminal)
app.use(morgan('dev'));

// Clear the temp invoices folder after each response as there is no persistence in this system.
app.use((req: Request, res: Response, next) => {
  res.on('finish', () => {
    clearFolder();
  });
  next();
});

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Headers', 'X-Error-Message');
  next();
});


const storage = multer.diskStorage({
  destination: function(req, file, callback) {
    callback(null,'/tmp');
  },
  filename: function(req, file, callback) {
    callback(null, file.originalname);
  }
});

const uploads = multer({storage: storage});

const dbStorage = multer.memoryStorage();
const dbUpload = multer({ storage: dbStorage});

// AWS S3 configuration
const s3 = new S3({
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },

  region: process.env.AWS_REGION,
});



// Middleware to handle raw XML request body (only for /validate)
const handleRawXmlBody = (req, res, next) => {
  let data = '';
  req.setEncoding('utf8');

  req.on('data', chunk => {
    data += chunk;
  });

  req.on('end', () => {
    req.body = data;
    next();
  });
};

// Secret key for JWT
export const JWT_SECRET = process.env.JWT_SECRET;

const PORT: number = parseInt(process.env.PORT || config.port);
const HOST: string = process.env.IP || 'localhost';

// Request to check the health/status of the service
app.get('/', (req: Request, res: Response) => {
  return res.json("Service is online :)");
});

//////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Pre-authentication implementation

//////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Pre file format implementation
app.post('/validate', handleRawXmlBody, async (req: Request, res: Response) => {
  try {
    if (req.headers['content-type'] !== 'application/xml' && req.headers['content-type'] !== 'text/plain') {
      return res.status(BAD_REQUEST).send('Please input a xml file. Other file types are not accepted!');
    }

    const rawXmlData = req.body;
    const encodedData = Buffer.from(rawXmlData).toString('base64');
    const checksum = crypto.createHash('md5').update(encodedData).digest('hex');

    // Next iteration: add fileName by extracting it from the invoice.
    const apiPostData = {
      filename: "invoice.xml",
      content: encodedData,
      checksum: checksum
    };

    // Next iteration: add customerName by extracting it from the invoice.
    const rules = 'AUNZ_PEPPOL_1_0_10,AUNZ_UBL_1_0_10';
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
    return res.json(createReport(apiResponse.data, rules));

  } catch (error) {
    // If a HTTP error is thrown, propagate it to the user
    if (error.status && error.status >= 400 && error.status < 600) {
      return res.status(error.status).send(error.message);
    }
    console.log(error);
    res.status(INTERNAL_SERVER_ERROR).send('Internal Server Error');
  }
});

app.post('/validate/specific', handleRawXmlBody, async (req: Request, res: Response) => {
  try {
    if (req.headers['content-type'] !== 'application/xml' && req.headers['content-type'] !== 'text/plain') {
      return res.status(BAD_REQUEST).send('Please input a xml file. Other file types are not accepted!');
    }

    const ruleSet = req.headers['rule'];
    if (ruleSet.length == 0) {
      return res.status(BAD_REQUEST).send('Please input a ruleset');
    }

    const rawXmlData = req.body;
    const encodedData = Buffer.from(rawXmlData).toString('base64');
    const checksum = crypto.createHash('md5').update(encodedData).digest('hex');

    // Next iteration: add fileName by extracting it from the invoice.
    const apiPostData = {
      filename: "invoice.xml",
      content: encodedData,
      checksum: checksum
    };

    // Next iteration: add customerName by extracting it from the invoice.
    const apiQueryData = {
      rules: ruleSet
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
    return res.json(createReport(apiResponse.data, ruleSet));

  } catch(error) {
    // If a HTTP error is thrown, propagate it to the user
    if (error.status && error.status >= 400 && error.status < 600) {
      return res.status(error.status).send(error.message);
    }
    console.log(error);
    res.status(INTERNAL_SERVER_ERROR).send('Internal Server Error');
  }
});
// End Pre file format implementation
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////


app.post('/validate/specific/v1', uploads.single('invoice'), async (req: Request, res: Response) => {
  try {
    const ruleSet = req.headers['rule'];
    const format = req.headers['format'];
    const report = await requestHelper(req, res, ruleSet);

    if (format === 'pdf' || format === 'docx') {
    res.sendFile(report);
  } else {
    res.send(report);
  }

  } catch(error) {
    // If a HTTP error is thrown, propagate it to the user
    if (error.status && error.status >= 400 && error.status < 600) {
      return res.status(error.status).header('X-Error-Message', error.message).send(error.message);
    }
    console.log(error);
    res.status(INTERNAL_SERVER_ERROR).send('Internal Server Error');
  }
});


app.post('/validate/v2', uploads.single('invoice'), async (req: Request, res: Response) => {
  try {
    const format = req.headers['format'];
    const report = await requestHelper(req, res, DEFAULT_RULESET);

    if (format === 'pdf' || format === 'docx') {
      res.sendFile(report);
    } else {
      res.send(report);
    }

  } catch (error) {
    // If a HTTP error is thrown, propagate it to the user
    if (error.status && error.status >= 400 && error.status < 600) {
      return res.status(error.status).header('X-Error-Message', error.message).send(error.message);
    }
    console.log(error);
    res.status(INTERNAL_SERVER_ERROR).send('Internal Server Error');
  }
});

// End Pre authentication implementation
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////

app.post('/auth/register/v1', async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, username, password } = req.body;

    // Check if a user with the same username already exists
    const existingUser = await UserModel.findOne({ username });
    if (existingUser) {
        return res.status(BAD_REQUEST).header('X-Error-Message', 'Username already exists').send('Username already exists');
    }

    // Hash the password
    const hashedPassword = bcrypt.hashSync(password as string, 5);
    const newUser = new UserModel({ firstName, lastName, username, password: hashedPassword, tokens: await apiAuthHelper('register', username, hashedPassword, firstName, lastName), uploadedFiles: [] });
    
    // Save the user to the database
    await newUser.save();

    res.send({
      "token": generateUserToken(username)
    });

  } catch (error) {
    // If a HTTP error is thrown, propagate it to the user
    if (error.status && error.status >= 400 && error.status < 600) {
      return res.status(error.status).header('X-Error-Message', error.message).send(error.message);
    }
    console.log(error);
    res.status(INTERNAL_SERVER_ERROR).send('Internal Server Error');
  }
});


app.post('/auth/login/v1', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    // Find the user by username
    const user = await UserModel.findOne({ username });

    if (!user) {
      return res.status(UNAUTHORIZED).header('X-Error-Message', 'Invalid username or password').send('Invalid username or password');
    }

    // Compare passwords
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(UNAUTHORIZED).header('X-Error-Message', 'Invalid username or password').send('Invalid username or password');
    }

    // Modify tokens object and save it to the database
    user.tokens = await apiAuthHelper('login', user.username, user.password, user.firstName, user.lastName);
    await user.save();

    res.status(201).send({
      "Authorization": generateUserToken(username)
    });

  } catch (error) {
    // If a HTTP error is thrown, propagate it to the user
    if (error.status && error.status >= 400 && error.status < 600) {
      return res.status(error.status).header('X-Error-Message', error.message).send(error.message);
    }
    console.log(error);
    res.status(INTERNAL_SERVER_ERROR).send('Internal Server Error');
  }
});

app.post('/auth/remove/v1', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    const storedUsername = authenticateToken(req);
    if (storedUsername !== username) {
      return res.status(FORBIDDEN).send('Forbidden');
    }
    // Find the user by username
    const user = await UserModel.findOne({ username });

    if (!user) {
      return res.status(UNAUTHORIZED).header('X-Error-Message', 'Invalid username or password').send('Invalid username or password');
    }

    // Compare passwords
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(UNAUTHORIZED).header('X-Error-Message', 'Invalid username or password').send('Invalid username or password');
    }

    // If the username and password are valid, delete the user
    await UserModel.deleteOne({ username });
    return res.send('User deleted successfully');

  } catch (error) {
    // If a HTTP error is thrown, propagate it to the user
    if (error.status && error.status >= 400 && error.status < 600) {
      return res.status(error.status).header('X-Error-Message', error.message).send(error.message);
    }
    console.log(error);
    res.status(INTERNAL_SERVER_ERROR).send('Internal Server Error');
  }
});

app.get('/auth/renderToken', async (req: Request, res: Response) => {
  try {
    const user = await routeAuthFlow(req, UserModel);
    return res.send(user.tokens.renderAPI);
  } catch(error) {
    if (error.status && error.status >= 400 && error.status < 600) {
      return res.status(error.status).header('X-Error-Message', error.message).send(error.message);
    }
    console.log(error);
    res.status(INTERNAL_SERVER_ERROR).send('Internal Server Error');
  }
});

app.post('/upload/v1', dbUpload.single('invoice'), async (req: Request, res: Response) => {
  try {
    const user = await routeAuthFlow(req, UserModel);

    // Generate a unique filename using crypto
    const fileKey = crypto.randomBytes(16).toString('hex');

    // Upload the file to S3
    const s3Params = {
      Bucket: process.env.BUCKET_NAME,
      Key: fileKey,
      Body: req.file.buffer,
      ContentType: req.file.mimetype
    };
    await new Upload({
      client: s3,
      params: s3Params,
    }).done();

    // Add the file key to the user's uploaded files array
    const fileName = req.file.originalname;
    
    // Format date to DD-MM-YYYY format
    const currentDate = new Date();
    const day = String(currentDate.getDate()).padStart(2, '0');
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const year = currentDate.getFullYear();
    const date = `${day}-${month}-${year}`;

    user.uploadedFiles.push({fileName, fileKey, date});
    await user.save();

    res.status(201).send({'File uploaded successfully': req.file.originalname});

  } catch (error) {
    if (error.status && error.status >= 400 && error.status < 600) {
      return res.status(error.status).header('X-Error-Message', error.message).send(error.message);
    }
    console.log(error);
    res.status(INTERNAL_SERVER_ERROR).send('Internal Server Error');
  }
});

app.get('/download/v1', async (req: Request, res: Response) => {
  try {
    const user = await routeAuthFlow(req, UserModel);
    const fileName = req.query.fileName as string;

    const url = await generateDownloadLink(user, fileName, s3);
    return res.json({ url });

  } catch (error) {
    if (error.status && error.status >= 400 && error.status < 600) {
      return res.status(error.status).header('X-Error-Message', error.message).send(error.message);
    }
    console.log(error);
    res.status(INTERNAL_SERVER_ERROR).send('Internal Server Error');
  }
});

app.get('/download/all', async (req: Request, res: Response) => {
  try {
    const user = await routeAuthFlow(req, UserModel);
    const resultArray = [];
    
    for (const fileObj of user.uploadedFiles) {
      const fileInfo = {
        "fileName": fileObj.fileName,
        "uploadedDate": fileObj.date,
        "url": await generateDownloadLink(user, fileObj.fileName, s3)
      }
      resultArray.unshift(fileInfo);
    }

    return res.json({ "files": resultArray });

  } catch(error) {
    if (error.status && error.status >= 400 && error.status < 600) {
      return res.status(error.status).header('X-Error-Message', error.message).send(error.message);
    }
    console.log(error);
    res.status(INTERNAL_SERVER_ERROR).send('Internal Server Error');
  }

});

app.get('/auth/renderToken', async (req: Request, res: Response) => {
  const user = await routeAuthFlow(req, UserModel);
  return res.send(user.tokens.renderAPI);
});

app.post('/validate/specific/v2', uploads.single('invoice'), async (req: Request, res: Response) => {
  try {
    await routeAuthFlow(req, UserModel);

    const ruleSet = req.headers['rule'];
    const format = req.headers['format'];
    const report = await requestHelper(req, res, ruleSet);

    if (format === 'pdf' || format === 'docx') {
    res.sendFile(report);
  } else {
    res.send(report);
  }

  } catch(error) {
    // If a HTTP error is thrown, propagate it to the user
    if (error.status && error.status >= 400 && error.status < 600) {
      return res.status(error.status).header('X-Error-Message', error.message).send(error.message);
    }
    console.log(error);
    res.status(INTERNAL_SERVER_ERROR).send('Internal Server Error');
  }
});


app.post('/validate/v3', uploads.single('invoice'), async (req: Request, res: Response) => {
  try {
    await routeAuthFlow(req, UserModel);

    const format = req.headers['format'];
    const report = await requestHelper(req, res, DEFAULT_RULESET);

    if (format === 'pdf' || format === 'docx') {
      res.sendFile(report);
    } else {
      res.send(report);
    }

  } catch (error) {
    // If a HTTP error is thrown, propagate it to the user
    if (error.status && error.status >= 400 && error.status < 600) {
      return res.status(error.status).header('X-Error-Message', error.message).send(error.message);
    }
    console.log(error);
    res.status(INTERNAL_SERVER_ERROR).send('Internal Server Error');
  }
});

// Keep this BENEATH route definitions
// handles errors nicely
app.use(errorHandler());

// Start server
const server = app.listen(PORT, HOST, () => {
  // DO NOT CHANGE THIS LINE
  console.log(`⚡️ Server started on port ${PORT} at ${HOST}`);
});

mongoose.connect(dbURL)
  .then(() => {
    console.log('Connected to MongoDB!!');
  })
  .catch(() => {
    console.log(dbURL);
    console.log('Error connecting to MongoDB :(');
  });

// For coverage, handle Ctrl+C gracefully
let shuttingDown = false;
async function handleSignal() {
  if (shuttingDown) {
    return;
  }
  // dealing with SIGINT being sent multiple times because of child processes (backups).
  shuttingDown = true;

  try {
    // Wait for any pending database operations to complete
    await mongoose.connection.db.command({ ping: 1 });
    console.log('\nAll pending database operations completed');

    server.close(() => console.log('Shutting down server gracefully.'));
    // Close the MongoDB connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');

    // Exit the process with a status code of 0 (success)
    process.exit(0);
  } catch (error) {
    console.error(`Error closing MongoDB connection: ${error}`);
    process.exit(1);
  }
}

process.on('SIGINT', handleSignal);

module.exports = app;
