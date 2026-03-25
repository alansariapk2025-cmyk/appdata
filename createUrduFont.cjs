const fs = require('fs');
const path = require('path');

const fontPath = path.join(__dirname, 'src', 'fonts', 'NotoNastaliqUrdu-Bold.ttf');
const outputPath = path.join(__dirname, 'src', 'fonts', 'NotoNastaliqUrdu-Bold-normal.js');

console.log('Starting font conversion...');
console.log('Font path:', fontPath);

try {
  if (!fs.existsSync(fontPath)) {
    console.error('ERROR: Font file not found!');
    console.log('Path:', fontPath);
    process.exit(1);
  }

  const fontBuffer = fs.readFileSync(fontPath);
  const base64Font = fontBuffer.toString('base64');

  console.log('TTF Size:', (fontBuffer.length / 1024).toFixed(2), 'KB');
  console.log('Base64 Size:', (base64Font.length / 1024).toFixed(2), 'KB');

  const jsContent = `import { jsPDF } from "jspdf";
var font = '${base64Font}';
var callAddFont = function () {
  this.addFileToVFS('NotoNastaliqUrdu-Bold-normal.ttf', font);
  this.addFont('NotoNastaliqUrdu-Bold-normal.ttf', 'NotoNastaliqUrdu-Bold', 'normal');
};
jsPDF.API.events.push(['addFonts', callAddFont]);`;

  fs.writeFileSync(outputPath, jsContent, 'utf8');
  
  console.log('SUCCESS! Font file created!');
  console.log('Output:', outputPath);

} catch (error) {
  console.error('ERROR:', error.message);
}