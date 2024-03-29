const AWS = require('aws-sdk');
const config = require('config');
const _ = require('lodash');

const awsConfig = config.get('dataSources.awsS3');

const s3 = new AWS.S3(awsConfig);
let thisBucket = null;

/**
 * Set the bucket to be used for subsequent function calls.
 *
 * @param {string} bucket The bucket to be set
 */
const setBucket = (bucket) => {
  thisBucket = bucket;
};

/**
 * Checks if a bucket exists
 *
 * @param {string} bucket The bucket to be checked
 * @returns {Promise} Promise object represents a boolean indicating if the bucket exists or not
 */
const bucketExists = (bucket = thisBucket) => new Promise((resolve, reject) => {
  const params = { Bucket: bucket };
  s3.headBucket(params).promise().then(() => {
    resolve(true);
  }).catch((err) => {
    if (err.code === 'NotFound') {
      resolve(false);
    } else {
      reject(err);
    }
  });
});

/** Verify the AWS S3 data source */
const validateAwsS3 = async () => {
  const { bucket } = config.get('dataSources.awsS3');
  if (!await bucketExists(bucket)) {
    throw new Error('Error: AWS bucket does not exist');
  } else {
    setBucket(bucket);
  }
};

/**
 * Checks if an object exists in a bucket
 *
 * @param {string} key The key of the object to be checked
 * @param {string} bucket The bucket where the key will be searched
 * @returns {Promise} Promise object represents a boolean indicating if the key exists or not
 */
const objectExists = (key, bucket = thisBucket) => new Promise((resolve, reject) => {
  const params = { Bucket: bucket, Key: key };
  s3.headObject(params).promise().then(() => {
    resolve(true);
  }).catch((err) => {
    if (err.code === 'NotFound') {
      resolve(false);
    } else {
      reject(err);
    }
  });
});

/**
 * Gets metadata on an object by making a head-object request
 *
 * @param {string} key Key of the object
 * @param {string} bucket Bucket where the object exists
 * @returns {Promise} Promise object representing the response
 */
const headObject = (key, bucket = thisBucket) => {
  const params = { Bucket: bucket, Key: key };
  return s3.headObject(params).promise();
};

/**
 * List objects in a bucket
 *
 * @param {object} params Additional params to be used in the search
 * @param {string} bucket The bucket to search for objects
 * @returns {Promise} Promise object representing the objects
 */
const listObjects = (params = {}, bucket = thisBucket) => {
  const newParams = Object.assign({ Bucket: bucket }, params);
  return s3.listObjectsV2(newParams).promise();
};

/**
 * Gets an object from a bucket
 *
 * @param {string} key The key of the object
 * @param {string} bucket The bucket where the object exists
 * @returns {Promise} Promise object representing the object response. undefined if the object does
 * not exist
 */
const getObject = (key, bucket = thisBucket) => new Promise((resolve, reject) => {
  const params = { Bucket: bucket, Key: key };
  s3.getObject(params).promise().then((data) => {
    resolve(data);
  }).catch((err) => {
    if (err.code === 'NoSuchKey') {
      resolve(undefined);
    } else {
      reject(err);
    }
  });
});

/**
 * Uploads a new directory object to a bucket
 *
 * @param {string} key The key of the object. Must end with "/"
 * @param {object} params Additional params to be used when creating the directory
 * @param {string} bucket The bucket that the object will be uploaded to
 * @returns {Promise} Promise object representing the response
 */
const putDir = (key, params = {}, bucket = thisBucket) => {
  if (_.last(key) !== '/') {
    throw new Error(`Error: directory key: "${key}" does not end with "/"`);
  }
  const newParams = Object.assign(
    { Key: key, Bucket: bucket, ContentType: 'application/x-directory' },
    params,
  );
  return s3.putObject(newParams).promise();
};

/**
 * Uploads an object to a bucket as JSON
 *
 * @param {object} object The object to be uploaded
 * @param {string} key The desired key name of the object
 * @param {object} params Additional params to be used in put-object
 * @param {string} bucket The bucket to upload the object to
 * @returns {Promise} Promise object representing the response
 */
const putObject = (object, key, params = {}, bucket = thisBucket) => {
  const newParams = Object.assign(
    {
      Body: JSON.stringify(object, null, 2),
      Key: key,
      Bucket: bucket,
      ContentType: 'application/json',
    },
    params,
  );
  return s3.putObject(newParams).promise();
};

/**
 * Update an existing object's metadata by copying the object to itself
 *
 * @param {object} metadata The desired metadata that will be added to or replace existing metadata
 * @param {string} key The key of the object
 * @param {string} bucket The bucket where the object is located
 * @returns {Promise} Promise object representing the response
 */
const updateMetadata = async (metadata, key, bucket = thisBucket) => {
  const currentHead = await headObject(key, bucket);
  const newMetadata = Object.assign(currentHead.Metadata, metadata);
  const params = {
    Bucket: bucket,
    Key: key,
    CopySource: `${bucket}/${key}`,
    ContentType: currentHead.ContentType,
    Metadata: newMetadata,
    MetadataDirective: 'REPLACE',
  };
  return s3.copyObject(params).promise();
};

/**
 * Delete an existing object
 *
 * @param {string} key The key of the object to be deleted
 * @param {string} bucket The bucket where the object is located
 * @returns {Promise} Promise object representing the response. undefined if the key was not found
 */
const deleteObject = (key, bucket = thisBucket) => new Promise((resolve, reject) => {
  const params = { Bucket: bucket, Key: key };
  s3.deleteObject(params).promise().then((data) => {
    resolve(data);
  }).catch((err) => {
    if (err.code === 'NotFound') {
      resolve(undefined);
    } else {
      reject(err);
    }
  });
});

module.exports = {
  setBucket,
  bucketExists,
  validateAwsS3,
  objectExists,
  headObject,
  listObjects,
  getObject,
  putDir,
  putObject,
  updateMetadata,
  deleteObject,
};
