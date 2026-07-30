const { createWorker } = require('tesseract.js');
const path = require('path');

async function test() {
  const worker = await createWorker('spa');
  const imagePath = '/tmp/file_attachments/Captura de pantalla 2026-07-02 121247.png';
  console.log('Recognizing', imagePath);
  const { data: { text } } = await worker.recognize(imagePath);
  console.log('--- OCR EXTRACTED TEXT ---');
  console.log(text);
  console.log('--- END OF TEXT ---');
  await worker.terminate();
}

test().catch(console.error);
