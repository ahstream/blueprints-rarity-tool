// import * as path from 'path';
const path = require('path');

module.exports = {
  mode: 'development',
  entry: './src/index.js',
  output: {
    filename: 'main.js',
    path: path.resolve(__dirname, 'dist'),
  },
  devServer: {
    static: './dist',
  },
  devtool: 'eval-source-map',
  module: {
    rules: [
      { test: /\.(js)$/, exclude: /node_modules/, use: ['babel-loader'] },
      { test: /\.(pug)$/, exclude: /node_modules/, use: ['pug-loader'] },
    ]
  },
  resolve: {
    extensions: ['*', '.js'],
    fallback: {
      'child_process': false,
      'assert': false,
      'os': false,
      'fs': false,
      'tls': false,
      'net': false,
      'path': false,
      'zlib': false,
      'http': false,
      'https': false,
      'stream': false,
      'crypto': false,
      // 'crypto-browserify': require.resolve('crypto-browserify'), //if you want to use this module also don't forget npm i crypto-browserify
    }
  },
};
