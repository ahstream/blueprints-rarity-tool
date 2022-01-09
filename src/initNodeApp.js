/**
 * Copyright (c) 2021
 * FILE DESCRIPTION
 */

const path = require('path');

global.__basedir = path.resolve(__dirname, '..');
global.__datadir = path.resolve(__dirname, '../data');
global.__configdir = path.resolve(__dirname, '../config');
global.__logdir = path.resolve(__dirname, '../logfiles');
