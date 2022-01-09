/**
 * Copyright (c) 2021
 * FILE DESCRIPTION
 */

// const log4js = require('log4js');

export const log = createLogger();

function createLogger() {
  return {
    info: (...args) => console.log(...args),
    debug: (...args) => console.log(...args),
    verbose: (...args) => console.log(...args),
  };
}

/*
function createLogger() {
  const logger = log4js.getLogger();
  logger.level = 'debug';
  return logger;
}
 */

