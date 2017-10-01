var path = require('path');
var webpack = require('webpack');
var express = require('express');
var config = require('./webpack.config');
const io = require('socket.io')();
var dotenv = require('dotenv')
dotenv.load()
var app = express();
var compiler = webpack(config);

app.use(require('webpack-dev-middleware')(compiler, {
  publicPath: config.output.publicPath
}));

app.use(require('webpack-hot-middleware')(compiler));

app.get('*', function(req, res) {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(3000, function(err) {
  if (err) {
    return console.error(err);
  }

  console.log('Listening at http://localhost:3000/');
});

/********************** Bing API Setup ******************************/

var Bing = require('node-bing-api')({ accKey: process.env.BING_SEARCH_KEY });
var util = require('util'),
  Bing = require('node-bing-api')({ accKey: process.env.BING_SEARCH_KEY }),
  searchBing = util.promisify(Bing.web.bind(Bing));

/********************** Cloud Speech API Setup ******************************/

const record = require('node-record-lpcm16');

// Imports the Google Cloud client library
const Speech = require('@google-cloud/speech');

// Instantiates a client
const speech = Speech();

// The encoding of the audio file, e.g. 'LINEAR16'
const encoding = 'LINEAR16';

// The sample rate of the audio file in hertz, e.g. 16000
const sampleRateHertz = 16000;

// The BCP-47 language code to use, e.g. 'en-US'
const languageCode = 'en-US';

const request = {
  config: {
    encoding: encoding,
    sampleRateHertz: sampleRateHertz,
    languageCode: languageCode
  },
  interimResults: false // If you want interim results, set this to true
};

// Create a recognize stream

function speechRec(){
  const recognizeStream = speech.streamingRecognize(request)
      .on('error', console.log)
      .on('data', (data) => display(data.results[0]));
    // Start recording and send the microphone input to the Speech API
    record
      .start({
        sampleRateHertz: sampleRateHertz,
        threshold: 0,
        // Other options, see https://www.npmjs.com/package/node-record-lpcm16#options
        verbose: false,
        recordProgram: 'rec', // Try also 'arecord' or 'sox'
        silence: '100.0'
      })
      .on('error', console.error)
      .pipe(recognizeStream);
}

/********************** API AI Setup ******************************/

var apiai = require('apiai');
 
var app = apiai(process.env.API_AI_KEY);
 
var so = null;

/*******************************************************************/

function display(log) {
  try{  	
    var request = app.textRequest(log.alternatives[0].transcript, {
      sessionId: Math.floor(Math.random()*10e5)
    });
     
    request.on('response', function(response) {
      if (response.result.fulfillment.speech != ''){
        if (response.result.fulfillment.speech == 'image'){
          let src = null;
          console.log(response.result.parameters.object)
          Bing.images(response.result.parameters.object, {count: 1, market: 'es-ES'}
            , function(error, res, body){
                if (response.result.contexts.hasOwnProperty('name')){
                  console.log('template', 'imageList');
                  so.emit('template', 'imageList');
                }
                else {
                  console.log('template', response.result.fulfillment.speech);
                  so.emit('template', response.result.fulfillment.speech);
                }
                if (body){
                  src = body.value[0].contentUrl;
                }
                else{
                  src = null;
                }
                console.log('image', src)
                so.emit('image', src);
          });
          
          
        }
        else{
          console.log('template', response.result.fulfillment.speech);
          so.emit('template', response.result.fulfillment.speech);
        }
      }
      else {
          console.log('speech', log.alternatives[0].transcript);
          so.emit('speech', log.alternatives[0].transcript);
      }
    });
     
    request.on('error', function(error) {
        console.log(error);
    });
     
    request.end();
  }
  catch(e) {
      console.log(e.error);
  }
}

function timeout() {
  setTimeout(function () {
    speechRec()
    timeout();
  }, 50000);
}


io.on('connection', function (socket) {
	so = socket;
	speechRec()
	timeout();
});

const port = 8000;
io.listen(port);
console.log('listening socket on port ', port);
