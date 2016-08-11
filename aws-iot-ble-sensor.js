// AWS IoT Device app that continuously scans for and reports detected iBeacons

var version = "0.1.0";



//
// Parse command line arguments
//

var commandLineArgs = require('command-line-args');

var args = commandLineArgs([
  { name: 'verbose', alias: 'v', type: Boolean, defaultValue: false },
  { name: 'led', alias: 'l', type: Boolean, defaultValue: false },
])

var options = args.parse()



//
// Status LED blinking
//

// which gpio pins correspond to the r, g & b leds
// rgb led recommended, eg: http://www.monkmakes.com/squid/
const led_r = 12;
const led_g = 16;
const led_b = 18;

// start with red
var led=led_r;

// to switch color, set this to the new one
var led_switch=0;

// set the blink frequency
var blink_on = 10;
var blink_off = 4990;

if (options.led) {
  try {
     var gpio = require('rpi-gpio');
  } catch(err) {
     console.error("LED: Not found");
     options.led=false;
  }
}

if (options.led) {
  // setup gpio for the led
  gpio.setup(led_r, gpio.DIR_OUT);
  gpio.setup(led_g, gpio.DIR_OUT);
  gpio.setup(led_b, gpio.DIR_OUT);

  // start blinking LED
  led_on();

  function led_on() {
      setTimeout(function() {
          gpio.write(led, 1, led_off);
      }, blink_off);
  }

  function led_off() {
      setTimeout(function() {
        gpio.write(led, 0, led_on);
        if (led_switch !=0) {
            led=led_switch;
            led_switch=0;
        }
    }, blink_on);
  }
}



//
// AWS IoT connection
//

// use the hostname to identify this instance of the sensor
var os = require('os');
const sensor = os.hostname().split('.').shift();

// use this topic for heartbeats
const topicHeartbeat = 'heartbeat';

// use this topic for detections
const topicDetection = 'detection';

// connect to AWS IoT
var awsIot = require('aws-iot-device-sdk');
const aws = awsIot.device({
    keyPath: './certs/private.pem.key',
    certPath: './certs/certificate.pem.crt',
    caPath: './certs/root-CA.crt',
    region: 'eu-central-1',
    clientId: sensor,
    offlineQueueing: true,
    offlineQueueMaxSize: 0,
    drainTimeMs: 10
});

// publish a heartbeat every 5 seconds
timeout = setInterval(function() {

    // prepare JSON message
    var message = JSON.stringify({
        timestamp: new Date().toJSON(),
        type: 'heartbeat',
        version: version,
        uptime: os.uptime(),
        loadavg: os.loadavg(),
        sensor: sensor,
    })

    // publish to the heartbeat topic
    aws.publish(topicHeartbeat, message, { qos: 1 });

    if (options.verbose) {
      // also log to console
      console.log(message);
    }
}, 5000);

// event handlers
aws
    .on('connect', function() {
        console.log('AWS IoT Device Gateway: Connected');
        if (options.led) {
          // switch led to blue
          led_switch=led_b;
        }
    });
aws
    .on('close', function() {
        console.log('AWS IoT Device Gateway: Closed');
        if (options.led) {
          // switch led to red
          led_switch=led_r;
        }
    });
aws
    .on('reconnect', function() {
        console.log('AWS IoT Device Gateway: Reconnected');
        if (options.led) {
          // switch led to blue
          led_switch=led_b;
        }
    });
aws
    .on('offline', function() {
        console.log('AWS IoT Device Gateway: Offline');
        if (options.led) {
          // switch led to red
          led_switch=led_r;
        }
    });
aws
    .on('error', function(error) {
        console.log('AWS IoT Device Gateway: Error -', error);
        if (options.led) {
          // switch led to red
          led_switch=led_r;
        }
    });
aws
    .on('message', function(topic, payload) {
       console.log(payload.toString());
    });



//
// iBeacon scanning
//

var ble = require('bleacon');
ble.startScanning();

// event handler
ble
    .on('discover', function(beacon) {

        // prepare JSON message
        var message = JSON.stringify({
            timestamp: new Date().toJSON(),
            type: 'detection',
            uuidmm: beacon.uuid + ':' + beacon.major + '/' + beacon.minor,
            proximity: beacon.proximity,
            sensor: sensor
        });

        // publish to the detection topic
        aws.publish(topicDetection, message, { qos: 1 });

        if (options.verbose) {
          // also log to console
          console.log(message);
        }
    });
