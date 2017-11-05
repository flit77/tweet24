const Hapi = require('hapi');
const debug = require('debug');
const { HighLevelProducer, Client } = require('kafka-node');
const uuidv4 = require('uuid/v4');

require('dotenv').config();

const dLog = debug('log');
const dError = debug('error');

const TOPIC_NAME = process.env.TOPIC_NAME || 'tweet24';
const HAPI_SERVER_HOST = process.env.HAPI_SERVER_HOST || 'localhost';
const HAPI_SERVER_PORT = process.env.HAPI_SERVER_PORT || 8000;

const server = new Hapi.Server();
server.connection({
  host: HAPI_SERVER_HOST,
  port: HAPI_SERVER_PORT
});

const client = new Client('localhost:2181', 'tweet24app', {
  sessionTimeout: 300,
  spinDelay: 100,
  retries: 2
});

client.on('error', error => {
  dError(error);
});

const producer = new HighLevelProducer(client);

producer.on('error', error => {
  dError(error);
});

server.route({
  method: ['PUT', 'POST'],
  path: '/tweet/add',
  handler: (request, reply) => {
    const { tweet, latitude, longitude } = request.payload;

    if (!tweet) {
      const errorMessage = 'tweet param missed';
      dError(errorMessage);
      return reply({
        error: errorMessage
      }).code(400);
    }

    dLog('request.params: ', request.payload);

    return new Promise((resolve, reject) => {
      dLog('in promise');

      try {
        dLog('in producer');

        const messageBuffer = JSON.stringify({
          id: uuidv4(),
          body: tweet,
          latitude,
          longitude,
          timestamp: Date.now()
        });

        const payload = [
          {
            topic: TOPIC_NAME,
            messages: messageBuffer,
            attributes: 1
          }
        ];

        return producer.send(payload, (error, result) => {
          dLog('Sent payload to Kafka: ', payload);
          if (error) {
            dError(error);
            return reject(
              new Error('Server Error, please contact administrator')
            );
          }
          dLog('result: ', result);
          return resolve('Tweet added');
        });
      } catch (error) {
        return reject(new Error('Server Error, producer is not ready'));
      }
    })
      .then(success =>
        reply({
          success
        })
      )
      .catch(error =>
        reply({
          error
        }).code(400)
      );
  }
});

// Start the server
server.start(err => {
  if (err) {
    throw err;
  }
  dLog('Server running at:', server.info.uri);
});
