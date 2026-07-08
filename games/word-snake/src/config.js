export const CONFIG = {
  WORLD_WIDTH: 1200,
  WORLD_HEIGHT: 675,
  MAP_WIDTH: 2800,
  MAP_HEIGHT: 1900,
  ROUND_TIME_SEC: 180,
  WORD_COUNT: 10,
  INITIAL_LIVES: 3,
  SNAKE_SPEED: 145,
  BOOST_SPEED_MULTIPLIER: 1.75,
  TURN_RATE: 4.6,
  ORB_COUNT: 4,
  INVINCIBLE_MS: 1000,
  SLOW_THRESHOLD_MS: 8000,
  GHOST_ALPHA: 0.35,
  SEGMENT_SPACING: 34,
  SAMPLE_GAP: 7,
  BASE_BODY_BEADS: 1,
  SLITHER_AMPLITUDE: 0.32,
  SLITHER_FREQUENCY: 0.006,
  MIN_TURN_INTERVAL_MS: 80,
  MAX_REPEAT_PER_WORD: 2,
  ENABLE_REVIEW_REINSERTION: false,
  SAFE_EDGE: 80,
  SAFE_HEAD_DISTANCE: 220,
  SAFE_ORB_DISTANCE: 110,
  SAFE_BODY_DISTANCE: 70,
  MAX_SPAWN_ATTEMPTS: 70,
  CAMERA_LERP: 0.08,
  VIEW_SPAWN_PADDING: 130,
  JOYSTICK_RADIUS: 72,
  ENEMY_SNAKE_COUNT: 5,
  ENEMY_SEGMENTS: 12,
  ENEMY_SPEED: 92,
  POWER_UP_COUNT: 3,
  POWER_UP_RADIUS: 24,
  POWER_UP_DURATION_MS: 7000,
  ORB_CLUSTER_MIN_RADIUS: 230,
  ORB_CLUSTER_MAX_RADIUS: 430
};

export const DIRECTIONS = {
  up: { x: 0, y: -1, label: '上' },
  down: { x: 0, y: 1, label: '下' },
  left: { x: -1, y: 0, label: '左' },
  right: { x: 1, y: 0, label: '右' }
};

export const ORB_PALETTES = [
  { fill: '#FFE8A3', stroke: '#DFAE2B', ink: '#3F3420' },
  { fill: '#C7F4D4', stroke: '#54B86A', ink: '#173A23' },
  { fill: '#CFE4FF', stroke: '#4D96FF', ink: '#18314F' },
  { fill: '#FFD7DF', stroke: '#FF6B8B', ink: '#4B1F2A' },
  { fill: '#E7D6FF', stroke: '#8B64D8', ink: '#2D2148' },
  { fill: '#CFF7F0', stroke: '#38B8A6', ink: '#163D39' }
];

export const GAME_COPY = {
  title: 'Word Snake',
  subtitle: '看英文，吃中文，让小蛇越长越聪明',
  completed: '小蛇长大啦！',
  timeout: '时间到，看看这次记住了哪些词',
  no_lives: '再想一想，下一局会更稳'
};
