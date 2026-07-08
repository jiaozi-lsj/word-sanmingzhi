/**
 * @typedef {Object} WordItem
 * @property {string} id
 * @property {string} en
 * @property {string} zh
 * @property {1|2|3=} difficulty
 */

/**
 * @typedef {Object} WordPerformance
 * @property {string} wordId
 * @property {number} attempts
 * @property {number} wrongCount
 * @property {number} correctCount
 * @property {boolean|null} firstAttemptCorrect
 * @property {number[]} reactionTimesMs
 * @property {boolean} resolved
 * @property {number} repeatCount
 * @property {number} targetStartedAt
 */

/**
 * @typedef {Object} GameSession
 * @property {string} sessionId
 * @property {number} startedAt
 * @property {number=} endedAt
 * @property {'playing'|'completed'|'timeout'|'no_lives'} status
 * @property {number} score
 * @property {number} lives
 * @property {string[]} completedWordIds
 * @property {Record<string, WordPerformance>} performance
 */

/**
 * @typedef {Object} SnakeSegment
 * @property {string} id
 * @property {'word'|'ghost'} type
 * @property {string=} wordId
 * @property {string=} label
 * @property {number} x
 * @property {number} y
 * @property {number} width
 * @property {number} height
 * @property {number} alpha
 */

export {};
