/**
 *   Gulp with TailwindCSS - An CSS Utility framework
 *   Author : Manjunath G
 *   URL : manjumjn.com | lazymozek.com
 *   Twitter : twitter.com/manju_mjn
 **/

/*
  Usage:
  1. npm install //To install all dev dependencies of package
  2. npm run dev //To start development and server for live preview
  3. npm run prod //To generate minifed files for live server
*/

const { src, dest, task, watch, series, parallel } = require('gulp');
const del = require('del'); //For Cleaning build/dist for fresh export
const options = require('./config'); //paths and other options from config.js
const browserSync = require('browser-sync').create();
const glob = require('glob');
const path = require('path');
const gulpIf = require('gulp-if');

const webpack = require('webpack-stream');
const sass = require('gulp-sass')(require('sass')); //For Compiling SASS files
const postcss = require('gulp-postcss'); //For Compiling tailwind utilities with tailwind config
const concat = require('gulp-concat'); //For Concatinating js,css files
const imagemin = require('gulp-imagemin'); //To Optimize Images
const cleanCSS = require('gulp-clean-css'); //To Minify CSS files
const purgecss = require('gulp-purgecss'); // Remove Unused CSS from Styles

//Note : Webp still not supported in major browsers including forefox
//const webp = require('gulp-webp'); //For converting images to WebP format
//const replace = require('gulp-replace'); //For Replacing img formats to webp in html
const logSymbols = require('log-symbols'); //For Symbolic Console logs :) :P

const webpackConfig = require('./webpack.config');
let isProd = false;

//Load Previews on Browser on dev
function livePreview(done) {
  browserSync.init({
    server: {
      baseDir: options.paths.dist.base,
    },
    port: options.config.port || 5000,
  });
  done();
}

// Triggers Browser reload
function previewReload(done) {
  console.log('\n\t' + logSymbols.info, 'Reloading Browser Preview.\n');
  browserSync.reload();
  done();
}

function html() {
  const destPath = isProd ? options.paths.build.base : options.paths.dist.base;
  return src(`${options.paths.src.base}/**/*.html`).pipe(dest(destPath));
}

function mainStyle() {
  const tailwindcss = require('tailwindcss');
  const destPath = isProd ? options.paths.build.css : options.paths.dist.css;
  return src(`${options.paths.src.css}/main.scss`)
    .pipe(
      sass({
        includePaths: options.paths.src.css,
      }).on('error', sass.logError)
    )
    .pipe(gulpIf(!isProd, dest(options.paths.src.css)))
    .pipe(
      postcss([tailwindcss(options.config.tailwindjs), require('autoprefixer')])
    )
    .pipe(
      gulpIf(
        isProd,
        purgecss({
          content: ['src/**/*.{html,js}'],
          defaultExtractor: (content) => {
            const broadMatches = content.match(/[^<>"'`\s]*[^<>"'`\s:]/g) || [];
            const innerMatches =
              content.match(/[^<>"'`\s.()]*[^<>"'`\s.():]/g) || [];
            return broadMatches.concat(innerMatches);
          },
        })
      )
    )
    .pipe(gulpIf(isProd, cleanCSS()))
    .pipe(concat({ path: 'style.css' }))
    .pipe(dest(destPath));
}

function pageStyles() {
  const destPath = isProd ? options.paths.build.css : options.paths.dist.css;
  return src(`${options.paths.src.css}/**/pages/*.scss`)
    .pipe(
      sass({
        includePaths: options.paths.src.css,
      }).on('error', sass.logError)
    )
    .pipe(gulpIf(!isProd, dest(options.paths.src.css)))
    .pipe(postcss([require('autoprefixer')]))
    .pipe(dest(destPath));
}

function getPageEntries() {
  const entries = {
    main: `${options.paths.src.js}/main.js`,
  };
  glob.sync(`${options.paths.src.js}/**/pages/*`).forEach((fileName) => {
    var extension = path.extname(fileName);
    var file = path.basename(fileName, extension);
    entries[`pages/${file}`] = fileName;
  });
  return entries;
}

function externalScripts() {
  const destPath = isProd ? options.paths.build.js : options.paths.dist.js;
  return src([`${options.paths.src.js}/**/external/*`]).pipe(dest(destPath));
}

function scripts() {
  const entries = getPageEntries();
  const destPath = isProd ? options.paths.build.js : options.paths.dist.js;
  // console.log('entries', entries);
  return src([`${options.paths.src.js}/**/pages/*`])
    .pipe(
      webpack({
        ...webpackConfig,
        mode: isProd ? 'production' : 'development',
        entry: entries,
      })
    )
    .pipe(dest(destPath));
}

function images() {
  const destPath = isProd ? options.paths.build.img : options.paths.dist.img;
  return src(`${options.paths.src.img}/**/*`)
    .pipe(gulpIf(isProd, imagemin()))
    .pipe(dest(destPath));
}

function watchFiles() {
  watch(
    `${options.paths.src.base}/**/*.html`,
    series(html, mainStyle, pageStyles, previewReload)
  );
  watch(
    [
      options.config.tailwindjs,
      `${options.paths.src.css}/**/*.scss`,
      `!${options.paths.src.css}/**/pages/*.scss`,
    ],
    series(mainStyle, previewReload)
  );
  watch(
    [`${options.paths.src.css}/**/pages/*.scss`],
    series(pageStyles, previewReload)
  );
  watch(`${options.paths.src.js}/**/*.js`, series(scripts, previewReload));
  watch(`${options.paths.src.img}/**/*`, series(images, previewReload));
  console.log('\n\t' + logSymbols.info, 'Watching for Changes..\n');
}

function cleanFolder() {
  const destPath = isProd ? options.paths.build.base : options.paths.dist.base;
  console.log(
    '\n\t' + logSymbols.info,
    isProd
      ? 'Cleaning build folder for fresh start.\n'
      : 'Cleaning dist folder for fresh start.\n'
  );
  return del([destPath]);
}

function buildFinish(done) {
  console.log(
    '\n\t' + logSymbols.info,
    `Production build is complete. Files are located at ${options.paths.build.base}\n`
  );
  done();
}

exports.default = series(
  cleanFolder,
  parallel(mainStyle, pageStyles, scripts, externalScripts, images, html), //Run All tasks in parallel
  livePreview, // Live Preview Build
  watchFiles // Watch for Live Changes
);

exports.prod = (...args) => {
  isProd = true;
  series(
    cleanFolder,
    parallel(mainStyle, pageStyles, scripts, externalScripts, images, html), //Run All tasks in parallel
    buildFinish
  )(...args);
};

exports.test = (callback) => {
  console.log(args);
};
