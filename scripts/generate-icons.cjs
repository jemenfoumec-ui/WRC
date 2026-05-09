/**
 * Generate PWA PNG icons from SVG
 */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const svgPath = path.join(projectRoot, 'public', 'pwa-icon.svg');
const outputDir = path.join(projectRoot, 'public');

async function generateIcons() {
    console.log('Generating PWA icons...');
    
    // Read SVG
    const svgBuffer = fs.readFileSync(svgPath);
    
    // Generate 192x192
    await sharp(svgBuffer)
        .resize(192, 192)
        .png()
        .toFile(path.join(outputDir, 'pwa-192x192.png'));
    console.log('Created pwa-192x192.png');
    
    // Generate 512x512
    await sharp(svgBuffer)
        .resize(512, 512)
        .png()
        .toFile(path.join(outputDir, 'pwa-512x512.png'));
    console.log('Created pwa-512x512.png');
    
    // Generate 32x32 (favicon)
    await sharp(svgBuffer)
        .resize(32, 32)
        .png()
        .toFile(path.join(outputDir, 'pwa-32x32.png'));
    console.log('Created pwa-32x32.png');
    
    console.log('All icons generated successfully!');
}

generateIcons().catch(console.error);