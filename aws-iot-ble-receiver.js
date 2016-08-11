// AWS IoT Device app that continuously scans for and reports detected iBeacons - Receiver

var os = require('os');
var awsIot = require('aws-iot-device-sdk');




// use the hostname to identify this instance of the receiver
const receiver = os.hostname().split('.').shift() + '-receiver';

// use this topic for heartbeats
const topicHeartbeat = 'heartbeat';

// use this topic for detections
const topicDetection = 'detection';



// connect to AWS IoT
const aws = awsIot.device({
    keyPath: './certs/private.pem.key',
    certPath: './certs/certificate.pem.crt',
    caPath: './certs/root-CA.crt',
    region: 'eu-central-1',
    clientId: receiver
});



// subscribe to the topics
aws.subscribe(topicHeartbeat);
aws.subscribe(topicDetection);



// 
// AWS IoT event handlers
//

aws
    .on('connect', function() {
        console.log('AWS IoT Device Gateway: Connected');
    });
aws
    .on('close', function() {
        console.log('AWS IoT Device Gateway: Closed');
    });
aws
    .on('reconnect', function() {
        console.log('AWS IoT Device Gateway: Reconnected');
    });
aws
    .on('offline', function() {
        console.log('AWS IoT Device Gateway: Offline');
    });
aws
    .on('error', function(error) {
        console.log('AWS IoT Device Gateway: Error -', error);
    });
aws
    .on('message', function(topic, payload) {
       console.log(payload.toString());
    });
