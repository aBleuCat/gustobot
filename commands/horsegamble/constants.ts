import path from 'path';
import { config } from '../../lib/config';

export const HOUSE_USER_ID = '1469509600561729710';
export const COMMON_HORSE = 'common_horse';
export const ADMIN_IDS = ['934290747623096381', '853658523786412063'];
export const STREAK_HORSE = 'gamble_streak';
export const STREAK_REQUIRED = 6;
export const STREAKS_PATH = path.join(__dirname, '../runtime_jsons/gamble_streaks.json');
export const SAFE_LENGTH = 1800;

export const MIN_ROLL = config.MIN_ROLL;
export const MAX_ROLL = config.MAX_ROLL;
export const ROLL_FACTOR = MAX_ROLL - MIN_ROLL + 1;