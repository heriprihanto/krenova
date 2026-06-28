const fs = require('fs');
const path = require('path');
const Terser = require('terser');
const CleanCSS = require('clean-css');
const { minify: minifyHtml } = require('html-minifier-terser');

const SRC_DIR = path.join(__dirname, 'src');
const BUILD_DIR = path.join(__dirname, 'build');

// Helper to recursively ensure directory exists
function ensureDirExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// Recursive function to walk directories and minify files
async function processDirectory(srcDir, destDir) {
  ensureDirExists(destDir);
  const items = fs.readdirSync(srcDir);

  for (const item of items) {
    const srcPath = path.join(srcDir, item);
    const destPath = path.join(destDir, item);
    const stat = fs.statSync(srcPath);

    if (stat.isDirectory()) {
      await processDirectory(srcPath, destPath);
    } else if (stat.isFile()) {
      const ext = path.extname(item).toLowerCase();
      if (ext === '.js') {
        console.log(`Minifying JS: ${srcPath} -> ${destPath}`);
        const content = fs.readFileSync(srcPath, 'utf8');
        try {
          const minified = await Terser.minify(content, {
            module: true,
            compress: true,
            mangle: true
          });
          if (minified.error) {
            throw minified.error;
          }
          fs.writeFileSync(destPath, minified.code, 'utf8');
        } catch (err) {
          console.error(`Error minifying JS file ${srcPath}:`, err);
          throw err;
        }
      } else if (ext === '.css') {
        console.log(`Minifying CSS: ${srcPath} -> ${destPath}`);
        const content = fs.readFileSync(srcPath, 'utf8');
        try {
          const minifier = new CleanCSS({});
          const minified = minifier.minify(content);
          if (minified.errors.length > 0) {
            throw new Error(minified.errors.join(', '));
          }
          fs.writeFileSync(destPath, minified.styles, 'utf8');
        } catch (err) {
          console.error(`Error minifying CSS file ${srcPath}:`, err);
          throw err;
        }
      } else {
        // Copy as-is for other assets (images, etc.)
        console.log(`Copying asset: ${srcPath} -> ${destPath}`);
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}

async function run() {
  try {
    console.log('Starting minification build process...');

    // Ensure clean/empty or prepared build directory
    ensureDirExists(BUILD_DIR);

    // 1. Process index.html at root
    const indexSrc = path.join(__dirname, 'index.html');
    const indexDest = path.join(BUILD_DIR, 'index.html');

    if (fs.existsSync(indexSrc)) {
      console.log(`Minifying HTML: ${indexSrc} -> ${indexDest}`);
      const htmlContent = fs.readFileSync(indexSrc, 'utf8');
      const minifiedHtml = await minifyHtml(htmlContent, {
        collapseWhitespace: true,
        removeComments: true,
        minifyJS: true,
        minifyCSS: true,
        useShortDoctype: true,
        removeEmptyAttributes: true,
        removeRedundantAttributes: true,
      });
      fs.writeFileSync(indexDest, minifiedHtml, 'utf8');
    } else {
      console.warn('Warning: index.html not found in root directory.');
    }

    // 1b. Process polling.html at root
    const pollingSrc = path.join(__dirname, 'polling.html');
    const pollingDest = path.join(BUILD_DIR, 'polling.html');

    if (fs.existsSync(pollingSrc)) {
      console.log(`Minifying HTML: ${pollingSrc} -> ${pollingDest}`);
      const htmlContent = fs.readFileSync(pollingSrc, 'utf8');
      const minifiedHtml = await minifyHtml(htmlContent, {
        collapseWhitespace: true,
        removeComments: true,
        minifyJS: true,
        minifyCSS: true,
        useShortDoctype: true,
        removeEmptyAttributes: true,
        removeRedundantAttributes: true,
      });
      fs.writeFileSync(pollingDest, minifiedHtml, 'utf8');
    } else {
      console.warn('Warning: polling.html not found in root directory.');
    }

    // 2. Process all files in src/
    if (fs.existsSync(SRC_DIR)) {
      await processDirectory(SRC_DIR, path.join(BUILD_DIR, 'src'));
    } else {
      console.warn('Warning: src/ directory not found.');
    }

    console.log('\nBuild completed successfully! All files are minified and stored in the "build" folder.');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

run();
