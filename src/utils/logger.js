const winston = require('winston');

// Define log format
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ level, message, timestamp, stack }) => {
        if (stack) {
            return `${timestamp} [${level.toUpperCase()}]: ${message}\n${stack}`;
        }
        return `${timestamp} [${level.toUpperCase()}]: ${message}`;
    })
);

// Create logger instance
const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: logFormat,
    defaultMeta: { service: 'lapaknesa-api' },
    transports: [
        // Console transport for all environments
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                logFormat
            )
        }),
    ],
});

// Add file transports in production
if (process.env.NODE_ENV === 'production') {
    logger.add(new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        maxsize: 5242880, // 5MB
        maxFiles: 5,
    }));
    logger.add(new winston.transports.File({
        filename: 'logs/combined.log',
        maxsize: 5242880, // 5MB
        maxFiles: 5,
    }));
}

// Stream for Morgan HTTP logging (if needed later)
logger.stream = {
    write: (message) => {
        logger.info(message.trim());
    },
};

module.exports = logger;
