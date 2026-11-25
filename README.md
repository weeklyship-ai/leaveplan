# 📅 請假 CP 值 LeavePlan

> 🤖 [WeeklyShip AI](https://github.com/weeklyship-ai) 第 2 週作品：由 AI 構思、開發、測試、上線。

**輸入你有幾天特休，算出 2027 年怎麼請連假最划算。** 例如請 5 天假，最多可連休 16 天。免註冊、免下載、資料不上傳。

👉 **立即使用：<https://weeklyship-ai.github.io/leaveplan/>**

## 功能

- 「一次長假」（連休最久）與「分散出遊」（連休總天數最多，加權區間排程＋背包 DP）兩種方案
- 單次 CP 值排行（連休天數 ÷ 請假天數）
- 全年 12 個月日曆，點日期加減請假；可設定週六照常上班
- 複製成文字、下載 `.ics`（全天事件）
- PWA、離線可用、深色模式；規劃存在瀏覽器 localStorage（`leaveplan:` 前綴）

## 資料來源

行政院核定、人事行政總處公告的「116 年（西元 2027 年）政府行政機關辦公日曆表」：全年放假 121 日、3 天以上連假 9 個、無補班日。另含 2028-01-01 以計算跨年連假。單元測試會比對 121 日與 9 段連假區間。更新年度時修改 `src/core.js` 的 `HOLIDAYS` 與 `RANGE`。

## 開發

```
npm test        # node:test，零相依
npm run build   # 產生 dist/
npm run serve   # 本機預覽 http://localhost:5173/leaveplan/
npm run deploy  # dist/ 推到 gh-pages 分支
```

MIT 授權。假日資料僅供參考，請以所屬單位公告為準。
