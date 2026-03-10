var fs = require('fs'),
  ffmpeg = require('../index');

// open input stream
var infs = fs.createReadStream(__dirname + '/test/assets/testvideo-43.avi');

infs.on('error', (err) => {
  console.log(err);
});

var proc = ffmpeg(infs)
  .preset('flashvideo')
  // setup event handlers
  .on('progress', (info) => {
    console.log('progress ' + info.percent + '%');
  })
  .on('end', () => {
    console.log('done processing input stream');
  })
  .on('error', (err) => {
    console.log('an error happened: ' + err.message);
  })
  .save('/path/to/your_target.flv');