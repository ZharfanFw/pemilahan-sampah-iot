const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
};

const logger = {
  info: (message) => {
    console.log(
      `${colors.cyan}ℹ INFO${colors.reset} ${new Date().toISOString()} - ${message}`,
    );
  },

  success: (message) => {
    console.log(
      `${colors.green}✓ SUCCESS${colors.reset} ${new Date().toISOString()} - ${message}`,
    );
  },

  warning: (message) => {
    console.log(
      `${colors.yellow}⚠ WARNING${colors.reset} ${new Date().toISOString()} - ${message}`,
    );
  },

  error: (message, error) => {
    console.log(
      `${colors.red}✗ ERROR${colors.reset} ${new Date().toISOString()} - ${message}`,
    );
    if (error) {
      console.error(error);
    }
  },

  mqtt: (message) => {
    console.log(
      `${colors.magenta}📡 MQTT${colors.reset} ${new Date().toISOString()} - ${message}`,
    );
  },
};

module.exports = logger;
