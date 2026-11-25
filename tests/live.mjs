// 測試用：與遊戲相同，直接讀最新資料（不在儲存庫保存任何資料備份）。需要網路。
import {loadSheetData} from '../dist/sheet-data.js';
import {loadEnforcement} from '../dist/enforcement.js';
export const data=await loadSheetData();
export const enforcement=await loadEnforcement();
