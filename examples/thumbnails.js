var ffmpeg = require('../index');

var proc = ffmpeg('/path/to/your_movie.avi')
  // setup event handlers
  .on('filenames', (filenames) => {
    console.log('screenshots are ' + filenames.join(', '));
  })
  .on('end', () => {
    console.log('screenshots were saved');
  })
  .on('error', (err) => {
    console.log('an error happened: ' + err.message);
  })
  // take 2 screenshots at predefined timemarks and size
  .takeScreenshots({ count: 2, timemarks: [ '00:00:02.000', '6' ], size: '150x100' }, '/path/to/thumbnail/folder');
