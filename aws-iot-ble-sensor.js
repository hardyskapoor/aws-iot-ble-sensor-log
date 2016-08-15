// AWS IoT Device app that continuously scans for and reports detected iBeacons

var version = "0.2.2";



//
// Parse command line arguments
//

var commandLineArgs = require('command-line-args');

var args = commandLineArgs([
  { name: 'verbose', alias: 'v', type: Boolean, defaultValue: false },
  { name: 'throttle', alias: 't', type: Boolean, defaultValue: true },
  { name: 'led', alias: 'l', type: Boolean, defaultValue: false },
])
function GetFormattedDate() {
    var todayTime = new Date();
    var month = todayTime .getMonth() + 1;
    var day = todayTime .getDate();
    var year = todayTime .getFullYear();
    var hours = todayTime .getHours();
    var minutes = todayTime .getMinutes();
    return month + "-" + day + "-" + year+"-"+hours+"_00";

}

function addLog(message) {
	var today = GetFormattedDate();
	var logFile = '/opt/aws-iot-ble-sensor-log/logs/beacon-log-'+today+'.log';
	var stream = fs.createWriteStream(logFile, {'flags': 'a'});
	stream.write(message+"\n");
	stream.end();
}
var options = args.parse()

const fs = require('fs');

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
//manager = levelStore('E:\nodejs\ascential\aws-iot-ble-sensor');
const aws = awsIot.device({
    keyPath: './certs/private.pem.key',
    certPath: './certs/certificate.pem.crt',
    caPath: './certs/root-CA.crt',
    region: 'eu-west-1',
    clientId: sensor,
    offlineQueueing: true,
    offlineQueueMaxSize: 0,
		//incomingStore: manager.incoming,
		//outgoingStore: manager.outgoing,
    drainTimeMs: 10
});


// publish a heartbeat every 60 seconds
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
		//console.log(aws.getOfflineOperations().length);
    if (options.verbose) {
      // also log to console
			//console.log(awsIot.offlineOperations);
			//console.log(aws.offlineOperations);
      console.log(message);
			//addLog(message)
    }
}, 60000);

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

if (options.throttle) {
   var HashMap = require('hashmap');
   var map = new HashMap();
}

// event handler
ble
    .on('discover', function(beacon) {

        discoverTimestamp = new Date();
        var discoverUuidmm = beacon.uuid + ':' + beacon.major + '/' + beacon.minor

        if ((options.throttle) && ((discoverTimestamp - map.get(discoverUuidmm)) < 10000)) {
          // ignore detections reported less than 10 seconds ago

          if (options.verbose) {
            // also log to console
            console.log('Ignoring ' + discoverUuidmm + ' last detected ' + (discoverTimestamp - map.get(discoverUuidmm)) + 'ms ago');
          }
        } else {
          // prepare JSON message
          var message = JSON.stringify({
              timestamp: discoverTimestamp.toJSON().replace("T", " "),
              type: 'detection',
              uuidmm: discoverUuidmm,
              proximity: beacon.proximity,
              sensor: sensor
          })

          // publish to the detection topic
          aws.publish(topicDetection, message, { qos: 1 });
					addLog(message);
          if (options.throttle) {
            // update the timestamp of last publish for that uuidmm
            map.set(discoverUuidmm, discoverTimestamp);
          };
          if (options.verbose) {
            // also log to console
            console.log(message);
          }
        }
    });
