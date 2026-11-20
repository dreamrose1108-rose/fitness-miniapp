// utils/date.js — 日期工具

function pad(n) { return n < 10 ? '0' + n : '' + n; }

// 返回 YYYY-MM-DD
function formatDate(date) {
  const d = date || new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// 返回最近 n 天的日期数组（含今天），从早到晚
function lastDays(n) {
  const arr = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    arr.push(formatDate(d));
  }
  return arr;
}

// YYYY-MM-DD → M/D
function shortLabel(dateStr) {
  const parts = dateStr.split('-');
  return `${Number(parts[1])}/${Number(parts[2])}`;
}

module.exports = { formatDate, lastDays, shortLabel };
